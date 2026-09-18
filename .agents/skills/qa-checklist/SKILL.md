---
name: qa-checklist
description: "Read the relevant issue(s) or work on GitHub (or elsewhere) and produce a manual QA checklist for a human tester to verify the code behaves as the issue expects. Use when the user wants a verification/checklist for a completed piece of work, wraps up a feature/bugfix, or points at an issue to 'test'."
---

# QA Checklist

Turn the relevant issue(s) — on GitHub, Linear, a local spec/ticket file, or wherever — into a **manual QA checklist**: an ordered, concrete series of checks a human tester can run to confirm the code does what the issue asked for.

A QA checklist is the human counterpart of a test suite. It verifies **behaviour through public interfaces** (the UI, an API endpoint, a user-visible outcome) — never implementation details. Each check must be something a tester can *do* and get a clear *yes/no* from, ideally in one sentence.

## When to use

- The user points at an issue ("make a checklist for issue #12", "what should I verify?") and wants something to run against the running app.
- A feature, bugfix, or PR is finished and needs a manual verification pass.
- The user wants acceptance criteria turned into tester-runnable steps.

## Process

### 1. Identify what to verify

Take the reference the user gave. If they didn't give one, ask which issue / piece of work to checklist. The tracker config may have been provided (see `docs/agents/issue-tracker.md` if present); otherwise work from whatever the user supplies — an issue number or URL on GitHub, a Linear ticket, or a spec/ticket file path in the repo.

### 2. Read the issue and the change

- **Fetch the issue(s)**: read the full body **and the comments** (comments often carry acceptance criteria, edge cases, and clarifications that the body omits). For GitHub issues, fetch body + comments; for a local ticket/spec file, read the whole file.
- **Note the acceptance criteria** verbatim where they exist. These are your source of truth and become checks 1:1 where possible.
- **Understand the change** that addresses the issue (the related PR / branch / diff, or the relevant code) so the checklist covers the actual behaviour and the places it could break. The checklist is written for a **tester**, though: describe what to observe, not how the code works.
- Use the project's domain vocabulary (see `CONTEXT.md` if present) so checks read naturally to the tester.

### 3. Draft the checklist

Group checks into sections, ordered by flow. Run the draft by the user before finalising — confirm coverage and depth.

<checklist-rules>

- **Every check is an observable action + expected result.** Phrase each as "Given … / when I do … / I expect …", or at minimum "I can … and …". No check may reference files, functions, or internal structure.
- **Conformance is 1:1 with acceptance criteria.** Each acceptance criterion from the issue gets a check (or is explicitly folded into a bigger one and noted as such). Criteria the code doesn't satisfy must be called out — that's the point of QA.
- **Cover edge cases the issue implies**, not just the happy path (empty states, invalid input, auth/ownership, cancellation, double-submit, refresh/navigation).
- **Cover the seams the change touches** that a tester can reach: the user flow the issue describes, plus neighbours it could have broken (regression checks).
- **State setup** briefly at the top if any is needed ("signed in as X", "with two items in a category") — but don't bury the checks in prose.
- **Each check stands alone**: a tester can tick it without recalling the one above.
- **Keep it runnable.** Prefer the highest, most user-visible seam. Prefer a handful of meaningful checks over a sprawling list.

</checklist-rules>

Use this layout:

```markdown
## Setup
<one or two lines: anything the tester must have in place>

## <Section 1 — name the area/flow>
- [ ] <Given/when … I expect …>
- [ ] <…>

## <Section 2>
- [ ] <…>

## Regression
- [ ] <neighbouring flows that could have broken>

## Acceptance criteria traced
<map each acceptance criterion (by name/number) to the check(s) covering it>
```

### 4. Deliver

By default, publish the checklist as a new GitHub issue using the repository's configured GitHub issue tracker. Include the checklist in the issue body and report the created issue URL. Present it only in chat or write it to a local file (e.g. under `.scratch/<feature-slug>/qa-checklist.md` or next to the issue) when the user explicitly requests that format instead.

Each check is a tickbox (`- [ ]`) so it can be checked off while testing. End by noting anything the checklist could **not** cover (not testable manually, needs environment data, etc.).
