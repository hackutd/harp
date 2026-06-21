---
name: ci-pipeline
description: >-
  Authoritative reference for HARP's CI/CD pipeline — what GitHub Actions run and
  when, the release-please release flow, automated version bumping, the
  Cloud Build → Cloud Run deploy, the Docker build, and the local git hooks
  (pre-commit gofmt + commit-msg Conventional Commits). Use this skill whenever
  someone asks how CI works, what checks run on a PR or push, why a workflow
  exists, how releases or versioning happen, how deploys are triggered, what the
  git hooks do, or how to set them up — even if they don't say "CI" explicitly
  (e.g. "what runs when I open a PR?", "how does a new version ship?", "why is my
  commit being rejected?", "what does push to main do?"). Prefer this over
  guessing from memory; it reflects the actual workflow files in this repo.
---

# HARP CI/CD Pipeline

This skill explains how HARP's continuous integration, release, and deployment
machinery actually works. It is a **reference** — answer questions accurately and
cite the concrete file/step the behavior comes from, so the user can verify.

The source of truth is three workflow files in `.github/workflows/`, the git
hooks in `.github/hooks/`, the `Dockerfile`, and `Taskfile.yml`. If a question
goes beyond what's described here, read those files directly rather than
inventing an answer — pipelines drift, and a wrong answer about CI wastes a push
cycle.

## The big picture

There are three pipelines, triggered by different events:

| Pipeline            | Trigger                       | What it does                                              |
| ------------------- | ----------------------------- | -------------------------------------------------------- |
| **CI / audit**      | push **or** PR to `main`      | Lint, build, and test the Go backend and React frontend  |
| **Release**         | push to `main`                | release-please PR → tag/release → bump `version` in code |
| **Deploy (CD)**     | merge to `main`               | Google Cloud Build → Cloud Run (auto-deploy)             |

And two **local** git hooks (they run on your machine, not in CI) keep commits
clean before they ever reach GitHub.

A normal change flows: branch → commit (hooks run locally) → open PR (CI runs) →
merge to `main` (CI runs again + release + deploy fire).

## CI — `.github/workflows/audit.yaml`

Workflow name: **CI**. Runs on `push` to `main` and on `pull_request` targeting
`main`. Two independent jobs run in parallel on `ubuntu-latest`. If either job
fails, the check is red and the PR can't merge cleanly.

### `backend-audit` job (Go)

Go version **1.24.x**. Steps, in order — each is a gate:

1. **Check gofmt** — `gofmt -l .`; fails if any file is unformatted. Fix with
   `gofmt -w .`.
2. **Verify Dependencies** — `go mod verify`.
3. **Build** — `go build -v ./...`.
4. **go vet** — `go vet ./...`.
5. **staticcheck** — installs `honnef.co/go/tools/cmd/staticcheck@v0.6.1`, then
   `staticcheck ./...`.
6. **Tests** — `go test -race ./...` (race detector on).

### `frontend-audit` job (React, in `client/web`)

Node **22**, npm cache keyed on `client/web/package-lock.json`. Runs with working
directory `client/web`. Steps, in order:

1. **Install** — `npm ci` (clean install from lockfile).
2. **Format Check** — `npm run format:check` (Prettier `--check`).
3. **Lint** — `npm run lint` (ESLint).
4. **Type Check & Build** — `npm run build` (which is `tsc -b && vite build`, so
   this is *both* the TypeScript type check and the production build).
5. **Dependency Audit** — `npm audit --audit-level=high --omit=dev` (prod deps
   only; high+ severity fails).
6. **Tests** — runs `npx vitest run` **only if** test files exist (a `__tests__`
   dir or any `*.test.*` / `*.spec.*` under `src`); otherwise it prints "No test
   files found, skipping" and passes.

### Reproducing CI locally

The fastest way to predict a green/red CI run is to run the same commands before
pushing. The CLAUDE.md command tables list them; the key mirrors are
`gofmt -l .`, `go vet ./...`, `staticcheck ./...`, `go test -race ./...` for the
backend and `npm run format:check && npm run lint && npm run build` in
`client/web` for the frontend.

## Release — `release-please.yaml` + `update-api-version.yaml`

Releasing is automated and driven by Conventional Commit messages. Two workflows
cooperate, both triggered on **push to `main`**.

### 1. release-please — `release-please.yaml`

Uses `googleapis/release-please-action@v4` with **`release-type: simple`**,
authenticated by the `MY_RELEASE_PLEASE_TOKEN` secret (a PAT, so its pushes can
re-trigger other workflows).

How it works: on every push to `main`, release-please scans Conventional Commits
since the last release and maintains an open **"release PR"**. That PR
accumulates the next version bump and the generated `CHANGELOG.md` entries.

- `feat:` commits → **minor** bump, `fix:` → **patch** bump, `feat!:`/`fix!:` or
  a `BREAKING CHANGE:` footer → **major** bump. `chore:`, `docs:`, `refactor:`,
  etc. show up in the changelog but don't drive the version on their own.
- **Nothing is released until you merge the release PR.** Merging it makes
  release-please create the git tag and the GitHub Release and finalize the
  `CHANGELOG.md` for that version.

This is why commit message format matters (and why the `commit-msg` hook exists).

### 2. Version bump in code — `update-api-version.yaml`

Workflow name: **Update Version and Release**. Also on push to `main`. It keeps
the Go binary's reported version in sync with the changelog:

1. Extract the latest version from `CHANGELOG.md` (first `[X.Y.Z]` it finds).
2. `sed` it into `const version = "..."` in `cmd/api/main.go`.
3. If that changed anything, commit as `chore: update api version to X.Y.Z` and
   push (as `GitHub Action <action@github.com>`, using `MY_RELEASE_PLEASE_TOKEN`).

So `const version` in `cmd/api/main.go` (currently `1.2.0`) is **machine-managed**
— don't hand-edit it; it follows the changelog after a release PR merges.

## Deploy (CD) — Cloud Build → Cloud Run

Merges to `main` trigger **Google Cloud Build**, which builds the container and
deploys to **Google Cloud Run** (auto-deploy). The build config lives in Google
Cloud (not a YAML in this repo), so there's nothing here to read for the trigger
itself — the contract is the `Dockerfile`.

### The Docker build — `Dockerfile`

Multi-stage, producing a tiny `scratch` image:

1. **Stage `frontend`** (`node:22-alpine`): `npm ci` then `npm run build` in
   `client/web`. Takes a build arg `VITE_GOOGLE_AUTH_ENABLED` (default `true`).
2. **Stage `builder`** (`golang:1.24`): `go mod download`, then a static build
   `CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /app/api ./cmd/api`.
3. **Stage final** (`scratch`): copies CA certs, the `api` binary, and the built
   frontend into `./static`. `EXPOSE 8080`, `CMD ["./api"]`.

Key consequence: **the frontend is compiled at image-build time and served as
static files by the Go binary** — there is no separate frontend server in prod.
The single container listens on **8080**.

Managed dependencies in prod: **Neon** (PostgreSQL), **Google Cloud Storage**
(file storage), **SuperTokens** (auth), **SendGrid** (email).

## Local git hooks — `.github/hooks/`

These run on the developer's machine, gating commits **before** code reaches
GitHub. They are not GitHub Actions. They live in `.github/hooks/` and are
activated by pointing git at that directory.

### Enabling them — `task setup-hooks`

Hooks are **opt-in per clone**. Run once after cloning:

```
task setup-hooks
```

which runs `git config core.hooksPath .github/hooks`. Verify with
`git config core.hooksPath` — it should print `.github/hooks`. If it prints
something else (e.g. a leftover `.husky/_` from another tool), the project hooks
are **not active** and you should re-run `task setup-hooks`.

### `pre-commit` — auto-format Go

On commit, runs `gofmt` against staged `.go` files (`--diff-filter=ACM`). Any
unformatted file is reformatted with `gofmt -w` **and re-staged automatically**,
so your commit ends up gofmt-clean. It never blocks the commit; it fixes and
continues. This is what keeps the CI `gofmt` gate green. No-ops if no `.go` files
are staged.

### `commit-msg` — enforce Conventional Commits

Validates the commit subject against:

```
^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?: .+
```

i.e. `type(optional-scope)!: description`. Merge commits (`^Merge `) are exempt.
A non-conforming message is **rejected** with a help text listing valid types and
examples. This matters because release-please parses these messages to compute
the next version and changelog — bad messages mean bad releases.

Valid: `feat(auth): add Google OAuth login`, `fix: resolve pagination bug`,
`chore!: drop Node 16 support`. Invalid: `updated stuff`, `WIP`.

## Quick answers to common questions

- **"What runs when I open a PR?"** → the **CI** workflow only (backend-audit +
  frontend-audit). Release and deploy are `main`-only.
- **"What happens when something merges to `main`?"** → CI runs again, *and*
  release-please updates/creates the release PR, *and* the version-bump workflow
  runs, *and* Cloud Build deploys to Cloud Run.
- **"How do I cut a release?"** → merge the open release-please PR. You don't tag
  manually.
- **"Why was my commit rejected?"** → the `commit-msg` hook; your subject isn't a
  Conventional Commit. (See the regex above.)
- **"Why is `const version` changing in commits I didn't make?"** → the
  `update-api-version.yaml` workflow syncs it from `CHANGELOG.md`.
- **"My hooks aren't running."** → `core.hooksPath` isn't set to `.github/hooks`;
  run `task setup-hooks`.
