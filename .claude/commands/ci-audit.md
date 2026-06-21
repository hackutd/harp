---
description: Run all CI audit checks locally to catch issues before pushing. Go through each check sequentially and report results. Fix any issues you find automatically.
model: sonnet
---

Run the CI audit checks locally to catch issues before pushing. Only run the checks for the parts of the codebase that actually changed, go through each relevant check sequentially, report results, and fix any issues you find automatically.

## Determine what changed

First, figure out which sections have changes so you can skip irrelevant checks:

1. Run `git status --porcelain` and `git diff --name-only HEAD` to list modified, staged, and untracked files (include both committed-but-unpushed and working-tree changes).
2. Classify the changed paths:
   - **Backend changes** — any changed file ending in `.go`, plus `go.mod`/`go.sum`.
   - **Frontend changes** — any changed file under `client/web/`.
3. Decide which sections to run:
   - Backend changes present → run the **Backend checks**.
   - Frontend changes present → run the **Frontend checks**.
   - Both present → run both sections.
   - Neither (e.g. only docs/config) → report that there's nothing to audit and stop.

State up front which sections you're running and why (based on the detected changes).

## Backend checks (from repo root)

Run only if backend changes were detected.

1. **gofmt** — Run `gofmt -l .` and verify no files are unformatted. If any are, run `gofmt -w .` to fix them.
2. **go mod verify** — Run `go mod verify`.
3. **go build** — Run `go build -v ./...`.
4. **go vet** — Run `go vet ./...`.
5. **go test** — Run `go test -race ./...`.

## Frontend checks (from `client/web/`)

Run only if frontend changes were detected.

6. **Format check** — Run `npm run format:check`. If it fails, run `npm run format` to fix, then re-check.
7. **Lint** — Run `npm run lint`. If it fails, report the errors and attempt to fix them.
8. **Build** — Run `npm run build` (includes TypeScript type checking).
9. **Dependency audit** — Run `npm audit --audit-level=high --omit=dev`.

## Output

After all relevant checks complete, print a summary table showing each check's pass/fail status. Mark skipped sections as **skipped (no changes)**. If any check failed and could not be auto-fixed, explain what needs to be done.
