---
name: ci-pipeline
description: >-
  Authoritative reference for HARP's CI/CD pipeline — what GitHub Actions run and
  when, PR title validation, the release-please release flow and how the version
  in version.txt is bumped, how that feeds the Cloud Build → Cloud Run deploy,
  and the local git hooks (pre-commit gofmt + commit-msg Conventional Commits). Use this skill whenever
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

The source of truth is the three workflow files in `.github/workflows/`
(`audit.yaml`, `conventional-commits.yaml`, `release-please.yaml`), the git hooks
in `.github/hooks/`, `scripts/check-migrations.sh`, and `Taskfile.yml`. If a question
goes beyond what's described here, read those files directly rather than
inventing an answer — pipelines drift, and a wrong answer about CI wastes a push
cycle.

## The big picture

Four pipelines, triggered by different events:

| Pipeline            | Where                               | Trigger                   | What it does                                                   |
| ------------------- | ----------------------------------- | ------------------------- | -------------------------------------------------------------- |
| **CI**              | `audit.yaml`                        | push **or** PR to `main`  | Validate migrations, lint, build, test Go and the portal       |
| **Commits**         | `conventional-commits.yaml`         | PR opened/edited/synced   | PR **title** must be a Conventional Commit                     |
| **release-please**  | `release-please.yaml`               | push to `main`, **upstream repo only** | Maintain release PR → on merge: tag, GitHub Release, `version.txt`, `CHANGELOG.md`, snapshot branch |
| **Deploy (CD)**     | Google Cloud Build (not in repo)    | merge to `main`           | Build `Dockerfile` → Cloud Run                                 |

And two **local** git hooks (they run on your machine, not in CI) keep commits
clean before they ever reach GitHub.

A normal change flows: branch → commit (hooks run locally) → open PR (CI +
Commits run) → squash-merge to `main` (CI runs again, deploy fires, and on
upstream release-please updates the release PR).

### Two repositories

This checkout's `origin` is `hackutd/hackutd-harp` (HackUTD's deployment);
`upstream` is `hackutd/harp` (the open-source project). The workflows are the
same files in both, but `release-please.yaml` is guarded by
`if: github.repository == 'hackutd/harp'`, so **releases are only cut upstream**.
In `hackutd-harp`, a new version arrives when upstream is merged in, bringing
its `version.txt` and `CHANGELOG.md` with it.

## CI — `.github/workflows/audit.yaml`

Workflow name: **CI**. Runs on `push` to `main` and on `pull_request` targeting
`main`. Two independent jobs run in parallel on `ubuntu-latest`. If either job
fails, the check is red and the PR can't merge cleanly.

### `backend-audit` job (Go)

Go version **1.27.x**. Steps, in order — each is a gate:

0. **Validate database migrations** — `./scripts/check-migrations.sh` (runs
   before Go is even set up). Checks every file in `cmd/migrate/migrations/` is
   named `NNNNNN_description.{up,down}.sql`, versions start at `000001`, and
   every version has exactly one up and one down. Same check locally:
   `task migrate-check`.
1. **Check gofmt** — `gofmt -l .`; fails if any file is unformatted. Fix with
   `gofmt -w .`.
2. **Verify Dependencies** — `go mod verify`.
3. **Build** — `go build -v ./...`.
4. **go vet** — `go vet ./...`.
5. **staticcheck** — installs `honnef.co/go/tools/cmd/staticcheck@v0.8.1`, then
   `staticcheck ./...`.
6. **Tests** — `go test -race ./...` (race detector on).

### `frontend-audit` job (React, in `client/portal`)

Node **22**, npm cache keyed on `client/portal/package-lock.json`. Runs with working
directory `client/portal`. Steps, in order:

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
pushing (or use the `/ci-audit` command). The key mirrors are
`task migrate-check`, `gofmt -l .`, `go vet ./...`, `staticcheck ./...`,
`go test -race ./...` for the backend and
`npm run format:check && npm run lint && npm run build` in `client/portal` for
the frontend.

## PR title check — `conventional-commits.yaml`

Workflow name: **Commits**. Runs on PR `opened`, `edited`, `reopened`,
`synchronize`, using `amannn/action-semantic-pull-request@v5` with the same type
list as the local hook (`feat fix docs style refactor perf test build ci chore
revert`). PRs are squash-merged and the **PR title becomes the commit on
`main`**, which is what release-please reads — so a sloppy title is a sloppy
changelog entry even if every branch commit was clean. Fix it by editing the PR
title; the `edited` trigger re-runs the check.

## Release — `release-please.yaml`

One workflow, triggered on **push to `main`**, and only in `hackutd/harp`
(see [Two repositories](#two-repositories)). There is no separate
version-bump workflow.

It runs `googleapis/release-please-action@v4` with **`release-type: simple`**,
authenticated by the `MY_RELEASE_PLEASE_TOKEN` secret (a PAT, so its pushes can
trigger other workflows). There is no `release-please-config.json` or manifest;
the options are inline in the workflow.

How it works: release-please scans Conventional Commits since the last release
and maintains an open **release PR** that bumps `version.txt` and prepends to
`CHANGELOG.md`.

- `fix:` → **patch**. `feat:` → **minor**.
- Breaking changes (`feat!:` or a `BREAKING CHANGE:` footer) also bump **minor**,
  not major, because of `bump-minor-pre-major: true` — the project stays on
  `0.x` until 1.0 is cut deliberately.
- `chore:`, `docs:`, `refactor:` etc. may appear in the changelog but don't
  drive a bump on their own.
- **Nothing is released until the release PR is merged.** Then release-please
  creates the `vX.Y.Z` tag and GitHub Release, and the workflow pushes a
  **snapshot branch named after the version** (e.g. `0.14.0`) at the release
  commit. It refuses to overwrite a branch that already exists.

release-please finds the previous version from GitHub Releases/tags (anchored
by `v0.9.0`), **not** from `version.txt`. If every tag and release were deleted
it would propose `1.0.0` again (this happened in PR #85). Don't hand-edit
`version.txt` or `CHANGELOG.md` to "fix" a version — fix the tags/releases.

### Where the version ends up

`version.txt` is the single source of truth. The `Dockerfile` injects it at
build time with `-ldflags "-X main.version=$(cat version.txt)"`, overriding
`var version = "dev"` in `cmd/api/main.go`. It shows up in `/v1/health`, the
`starting` log line, and `/v1/debug/vars`. A local `go build` / `air` without
that flag reports `dev` — expected, not a bug. (The `@version 1.0` Swagger
annotation in `main.go` is the API doc version and is unrelated.)

## Deploy (CD) — Cloud Build → Cloud Run

Merges to `main` trigger **Google Cloud Build**, which builds the `Dockerfile`
and deploys to **Cloud Run**. The trigger lives in the GCP console — there is no
`cloudbuild.yaml` — and it is independent of GitHub Actions, so a red CI run
does not, as far as this repo shows, block the deploy. Migrations are **not**
run by the deploy.

For the image stages, serving model, env vars, migrations against prod,
rollback, and deploy-time failures, use the **deployment** skill — this skill
only covers how a merge reaches the build.

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

- **"What runs when I open a PR?"** → **CI** (backend-audit + frontend-audit)
  and **Commits** (PR title check). Release and deploy are `main`-only.
- **"What happens when something merges to `main`?"** → CI runs again and Cloud
  Build deploys to Cloud Run. On upstream (`hackutd/harp`) release-please also
  updates or creates the release PR.
- **"How do I cut a release?"** → merge the open release-please PR in
  `hackutd/harp`. You don't tag manually. `hackutd-harp` picks it up by merging
  upstream.
- **"Why did CI fail on a migration I didn't touch?"** → the migration check
  looks at the whole directory; a bad name or missing up/down pair anywhere
  fails it. Run `task migrate-check`.
- **"Why does my PR fail the Commits check?"** → the PR title isn't a
  Conventional Commit. Edit the title.
- **"Why was my commit rejected?"** → the `commit-msg` hook; your subject isn't a
  Conventional Commit. (See the regex above.)
- **"Why does my local build say version `dev`?"** → the version is injected
  from `version.txt` only by the Docker build's ldflags.
- **"My hooks aren't running."** → `core.hooksPath` isn't set to `.github/hooks`;
  run `task setup-hooks`.
