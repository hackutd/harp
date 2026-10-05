---
name: ci-pipeline
description: >-
  Authoritative reference for HARP's CI/CD pipeline — what GitHub Actions run and
  when, PR title validation, the release-please release flow and how the version
  in version.txt is bumped, how merges deploy staging and release tags deploy
  prod through Cloud Build → Cloud Run,
  and the local git hooks (pre-commit gofmt + commit-msg Conventional Commits). Use this skill whenever
  someone asks how CI works, what checks run on a PR or push, why a workflow
  exists, how releases or versioning happen, how deploys are triggered, what the
  git hooks do, or how to set them up — even if they don't say "CI" explicitly
  (e.g. "what runs when I open a PR?", "how does a new version ship?", "why is my
  commit being rejected?", "what does push to main do?", "when does my change
  reach prod?"). Prefer this over
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
| **Migrations**      | `migration-reminder.yaml`           | PR touching `cmd/migrate/migrations/` | Comments a reminder to apply the migration to staging before merging and prod before releasing (never fails) |
| **release-please**  | `release-please.yaml`               | push to `main`, **`hackutd/harp` only** | Maintain release PR → on merge: tag, GitHub Release, `version.txt`, `CHANGELOG.md`, snapshot branch |
| **Deploy staging**  | Google Cloud Build (not in repo)    | push to `main`            | Build `Dockerfile` → Cloud Run `harp-staging`                  |
| **Deploy prod**     | Google Cloud Build (not in repo)    | tag `vX.Y.Z` (release PR merged) | Build `Dockerfile` → Cloud Run `harp`                   |

And two **local** git hooks (they run on your machine, not in CI) keep commits
clean before they ever reach GitHub.

A normal change flows: branch → commit (hooks run locally) → open PR (CI +
Commits run) → squash-merge to `main` (CI runs again, staging deploys, and
release-please updates the release PR) → merge the release PR (tag → prod
deploys).

### One repository

`hackutd/harp` is both the open-source project and HackUTD's deployment (the
`hackutd/hackutd-harp` fork is archived). `release-please.yaml` is guarded by
`if: github.repository == 'hackutd/harp'` so that other schools' copies of the
repo never cut their own releases.

## CI — `.github/workflows/audit.yaml`

Workflow name: **CI**. Runs on `push` to `main` and on `pull_request` targeting
`main`. Jobs on `ubuntu-latest`: `changes`, then `backend-audit`,
`backend-lint`, `db-integration` and `frontend-audit` in parallel after it, and
`docker-build`, which doesn't wait for `changes`.

The `protect-main` ruleset (GitHub settings, not in repo) lists the required
checks, and the branch must be up to date. Check the ruleset before saying a
particular red job blocks the merge.

### Speed: path filter, cancellation, caches

- **`changes`** (`dorny/paths-filter`) decides what a PR needs. Go jobs run
  when any `*.go`, `go.mod`/`go.sum`, `cmd/**`, `internal/**`, `docs/**`, the
  migration check script, or `audit.yaml` changes. `frontend-audit` runs when
  `client/portal/**` or `audit.yaml` changes. `docker-build` always runs, since
  the image depends on everything. Pushes to `main` run every job.
- **A skipped job reports as passed** to required checks. That is what lets a
  frontend-only PR merge without the Go jobs, but it also means a failed
  `changes` job would skip everything green. So `changes` must itself be a
  required check.
- **Concurrency:** a new push to a PR cancels that PR's in-flight run. Runs on
  `main` never cancel each other.
- **Go caches** use `actions/cache` directly, with `setup-go`'s cache off.
  Keys are `go-test-…` (backend-audit; db-integration restores it read-only)
  and `go-lint-…` (backend-lint; also holds staticcheck's cache and the
  installed tools). Each key ends in the commit SHA, with restore-keys falling
  back to the newest entry, and **only pushes to `main` save**. Don't switch
  back to `setup-go`'s `cache: true` in more than one job. It keys on `go.sum`
  alone, so the first job to save owns the key until `go.sum` changes. That
  once left `main` with a 51MB store-only cache and made every build cold.

### `backend-audit` job (Go tests)

Kept under this name because the ruleset requires it. One gate:
**`go test -race ./...`** (race detector on). The store integration tests skip
here because `HARP_TEST_DSN` is unset; they run in `db-integration`.

### `backend-lint` job (Go static checks)

Go version **1.27.x**. Steps, in order — each is a gate:

1. **Validate database migrations** — `./scripts/check-migrations.sh`. Checks
   every file in `cmd/migrate/migrations/` is named
   `NNNNNN_description.{up,down}.sql`, versions start at `000001`, and every
   version has exactly one up and one down. Same check locally:
   `task migrate-check`.
2. **Check gofmt** — `gofmt -l .`; fails if any file is unformatted. Fix with
   `gofmt -w .`.
3. **Verify Dependencies** — `go mod verify`.
4. **go vet** — `go vet ./...`. It also type-checks the main packages that
   have no tests, which is why there's no separate `go build ./...` step.
5. **Install tools** — `staticcheck@v0.8.1`, `govulncheck@v1.8.0`,
   `swag@v1.16.6` (keep swag in step with `github.com/swaggo/swag` in `go.mod`).
6. **staticcheck** — `staticcheck ./...`.
7. **govulncheck** — `govulncheck ./...`. Fails only on vulnerabilities the
   code can reach. A newly published advisory can turn it red with no code
   change. Fix it by bumping the named module to its "Fixed in" version
   (`go get mod@ver && go mod tidy`).
8. **Swagger docs drift** — runs the same commands as `task gen-docs` and fails
   if the working tree changed. Fix by running `task gen-docs` and committing
   `docs/`.

### `db-integration` job (Postgres)

Starts a throwaway `postgres:16.3` **service container** that exists only for
the job. It never touches Neon or any shared database. With the golang-migrate
CLI v4.18.1, it runs:

1. **Apply all migrations** — `migrate ... up` on an empty database.
2. **Roll back all migrations** — `migrate ... down -all`. Proves every down
   migration works, which is what a rollback relies on.
3. **Re-apply all migrations** — `migrate ... up`. Proves the downs left a clean slate.
4. **Store integration tests** — `go test -race -count=1 ./internal/store/`
   with `HARP_TEST_DSN` set, so the hand-written SQL runs against real Postgres.

A red step names the failing migration version or test. To reproduce locally,
use a scratch database (the tests `TRUNCATE` tables). See the header comment in
`internal/store/integration_test.go`.

### `docker-build` job

Builds the production `Dockerfile` with Buildx (GitHub Actions layer cache) and
**does not push**. It exists because the Cloud Build deploy is the only other
thing that builds the image, so a broken `COPY` path or base-image problem would
otherwise first show up at deploy time.

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
6. **Regression Tests** — `npm run test:reviews`, `npm run test:applications`, and `npm run test:auth`
   (`node --test` over `client/portal/scripts/*.test.mjs`).
7. **Tests** — runs `npm test` (Vitest, timezone pinned in `vitest.config.ts`)
   **only if** test files exist (a `__tests__` dir or any `*.test.*` /
   `*.spec.*` under `src`); otherwise it prints "No test files found, skipping"
   and passes.

### Reproducing CI locally

The fastest way to predict a green/red CI run is to run the same commands before
pushing (or use the `/ci-audit` command). The key mirrors are
`task migrate-check`, `gofmt -l .`, `go vet ./...`, `staticcheck ./...`,
`govulncheck ./...`, `task gen-docs && git status --porcelain`,
`go test -race ./...` for the backend and
`npm run format:check && npm run lint && npm run build && npm run test:reviews && npm run test:applications && npm run test:auth`
in `client/portal` for the frontend. `db-integration` needs a scratch Postgres,
and `docker-build` needs `docker build .`.

## Migration reminder — `migration-reminder.yaml`

Workflow name: **Migrations**. Runs on `pull_request_target` for PRs that touch
`cmd/migrate/migrations/**`. It lists the changed `.up.sql` files and posts a
single comment, edited in place on later pushes, saying the deploy does not run
migrations and that additive ones go to prod before merge. It never fails. It
uses `pull_request_target` so it can comment on fork PRs, which is safe only
because it **never checks out or runs PR code**. Keep it that way.

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
  commit. It refuses to overwrite a branch that already exists. **The tag
  deploys prod** (see [Deploy](#deploy-cd--cloud-build--cloud-run)), so merging
  the release PR is the prod deploy.

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

Two **Google Cloud Build** triggers build the `Dockerfile` and deploy it to
**Cloud Run**:

- **Push to `main`** → `harp-staging` (`https://harp-staging.hackutd.co`).
- **Push of a tag matching `^v\d+\.\d+\.\d+$`** → `harp`, prod
  (`https://harp.hackutd.co`). release-please pushes that tag when the release
  PR merges, so nothing reaches prod until a release.

The triggers live in the GCP console — there is no `cloudbuild.yaml` — and they
are independent of GitHub Actions. Cloud Build never checks CI. What keeps red
code out is the `protect-main` ruleset: PRs need the required checks green
before they can merge. Members of the bypass team (`director-lead`, bypass mode
"always") can still push or merge red, and that deploys to staging, then to prod
with the next release. Migrations are **not** run by either deploy.

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

- **"What runs when I open a PR?"** → **CI** (`changes`, then whichever of
  backend-audit, backend-lint, db-integration and frontend-audit the changed
  paths need, plus docker-build always), **Commits** (PR title check), and
  **Migrations** if the PR touches migrations. Release and deploy are `main`-only.
- **"Why was a job skipped on my PR?"** → the `changes` path filter decided the
  PR doesn't touch that side. Skipped counts as passed.
- **"What happens when something merges to `main`?"** → CI runs again, Cloud
  Build deploys it to **staging** (`harp-staging`), and release-please updates
  or creates the release PR. Prod doesn't change.
- **"When does my change reach prod?"** → when the release-please PR merges.
  Its tag triggers the prod deploy.
- **"How do I cut a release?"** → merge the open release-please PR in
  `hackutd/harp`. You don't tag manually. That merge deploys prod, so apply any
  pending migrations to prod first.
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
