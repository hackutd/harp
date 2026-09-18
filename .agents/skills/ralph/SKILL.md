---
name: ralph
description: "Loop orchestrator that takes tickets from the issue tracker, implements each one on its own branch via /implement, and opens a PR. Processes tickets in a loop until the frontier is cleared."
disable-model-invocation: true
---

# ralph

`ralph` is a **loop orchestrator**: it reads tickets from the issue tracker, spins up a fresh branch per ticket, delegates the actual implementation to the `/implement` skill, then opens a pull request and loops to the next ticket.

You invoke it as a slash command: `/ralph [args]`.

## When to use

Use `/ralph` when the user wants tickets shipped end-to-end with minimal orchestration:

- "Implement ticket #42 and open a PR" — `/ralph 42`
- "Work every ready ticket on the board" — `/ralph --all`
- "Keep going through the frontier" — `/ralph` (no args; keeps processing until no ready tickets remain)

It is the top of the loop. `/implement` owns the work inside each iteration.

## Prerequisites

- A git repo with a GitHub remote (`origin https://github.com/owner/repo.git`).
- The `/implement` skill available.
- The **GitHub MCP server** available with at least these tools: `create_branch`, `create_pull_request`, `list_issues`, `issue_read`, `get_me`.

## Arguments

| Argument | Meaning |
|---|---|
| *(none)* | Scan the tracker for the next ready ticket and process it; then keep going until the frontier is empty. |
| `<issue-number>` | Process that specific ticket. Stop after its PR is open. |
| `--all` | Process every ready ticket in the frontier, in a loop. (Default when no issue is given.) |
| `--owner <owner>` | Override the repo owner. Defaults to parsing `git remote -v`. |
| `--repo <repo>` | Override the repo name. Defaults to parsing `git remote -v`. |

## Steps

### Step 0 — Resolve repo context

Determine `<owner>` and `<repo>`:

1. If `--owner` / `--repo` were passed, use them.
2. Otherwise parse `git remote -v` → expect `https://github.com/<owner>/<repo>.git`.
3. Fallback: call `GitHub__get_me` to get the authenticated user as `<owner>`, paired with the repo name parsed from the remote.

### Step 1 — Acquire the next ticket

- If an issue number was passed as arg, fetch it with `GitHub__issue_read`.
- Otherwise, list open issues filtered by the `ready-for-agent` label (the triage label used by `/to-tickets`) using `GitHub__list_issues`. Pick the first whose blockers are all closed.
- Read the full ticket body. If it references a parent spec / issue, fetch that too so `/implement` gets the complete context.

### Step 2 — Create a branch

- Derive a branch name: **`feat/<issue>-<kebab-title>`**.
  - Strip or replace characters unsafe for branch names.
  - Example: issue #42 "Add star rating display" → `feat/42-add-star-rating-display`.
- Create the **remote** branch with `GitHub__create_branch`, branching from `main` (or the repo's default branch).
- Check it out **locally**: `git checkout -b <branch> origin/<branch>`.

If the branch already exists on the remote, fetch and check it out instead of failing:

```bash
git fetch origin <branch>
git checkout -b <branch> origin/<branch>
```

### Step 3 — Implement (delegated)

This is the heart of the loop. Ralph does **not** write code. It delegates:

- Invoke the `/implement` skill, passing the ticket number (or a reference to the fetched ticket body) as its argument.
- `/implement` handles TDD, writing code + tests, typechecking, and committing — leaving everything committed on the current branch.
- If `/implement` reports a failure or needs clarification, surface it to the user and **pause the loop** rather than pushing broken work.

### Step 4 — Push and open a PR

1. Push the local branch: `git push -u origin <branch>`.
2. Open a pull request with `GitHub__create_pull_request`:
   - `head`: the new branch
   - `base`: `main` (or the repo default)
   - `title`: the issue title, optionally prefixed with the issue number — match the repo's existing convention; when in doubt use `<issue title> (#<number>)`.
   - `body`: a short summary that references the ticket so it auto-closes on merge:
     ```
     Closes #<issue>

     Implemented end-to-end via /ralph → /implement.
     ```
   - `draft`: `false` (ready for review) unless the user explicitly asked for a draft.

### Step 5 — Loop

- If a specific issue was given, **stop** — report the PR URL.
- If `--all` was passed (or no issue was given), go back to **Step 1** for the next ready ticket.
- If no ready tickets remain, **stop** and report an empty frontier.
- Track what was done per iteration so the final summary is complete.

## Output

At the end (whether after one ticket or a full loop), report a summary table:

| Ticket | Branch | PR |
|---|---|---|
| #42 | `feat/42-add-star-rating-display` | [#43](https://github.com/owner/repo/pull/43) |
| … | … | … |

For each ticket that could not be shipped, list the reason (blocked, no ready label, implement failure, etc.).

## Conventions

- **Branch naming:** `feat/<issue>-<kebab-title>` — never reuse a branch across tickets.
- **PR titles:** match the repo's existing PR-title convention. When unsure, use `<title> (#<issue>)`.
- **Auto-close:** always reference `Closes #<issue>` (or `Fixes #<issue>`) in the PR body.
- **No direct edits:** ralph only orchestrates; implementation is delegated to `/implement`. If `/implement` is unavailable, tell the user rather than writing code by hand.
- **Pause on failure:** if `/implement` fails, do not push a broken branch. Report the issue and wait for user direction.
