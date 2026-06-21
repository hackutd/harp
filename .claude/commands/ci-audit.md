6s
Run npm run build

> web@0.0.0 build
> tsc -b && vite build

Error: src/pages/admin/assigned/components/ApplicationDetailsPanel.tsx(57,7): error TS2722: Cannot invoke an object which is possibly 'undefined'.
Error: Process completed with exit code 2.Run all CI audit checks locally to catch issues before pushing. Go through each check sequentially and report results. Fix any issues you find automatically.

## Backend checks (from repo root)

1. **gofmt** — Run `gofmt -l .` and verify no files are unformatted. If any are, run `gofmt -w .` to fix them.
2. **go mod verify** — Run `go mod verify`.
3. **go build** — Run `go build -v ./...`.
4. **go vet** — Run `go vet ./...`.
5. **go test** — Run `go test -race ./...`.

## Frontend checks (from `client/web/`)

6. **Format check** — Run `npm run format:check`. If it fails, run `npm run format` to fix, then re-check.
7. **Lint** — Run `npm run lint`. If it fails, report the errors and attempt to fix them.
8. **Build** — Run `npm run build` (includes TypeScript type checking).
9. **Dependency audit** — Run `npm audit --audit-level=high --omit=dev`.

## Output

After all checks complete, print a summary table showing each check's pass/fail status. If any check failed and could not be auto-fixed, explain what needs to be done.
