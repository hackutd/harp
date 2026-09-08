# HARP Portal

HackUTD's hacker, admin, and super-admin portal. Built with Vite, React,
Zustand, React Hook Form + Zod, and shadcn/Radix.

## Commands

```bash
npm run dev            # Start the dev server (port 3000)
npm run build          # Type-check and build for production
npm run lint           # ESLint
npm run format         # Prettier write
npm run format:check   # Prettier check

npm test               # Run unit tests once
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with a coverage report (no threshold enforced)
```

## Testing

Unit tests use **Vitest** with the **jsdom** environment and **Testing
Library**.

- **Placement:** tests are co-located with the code they exercise as
  `<name>.test.ts(x)` beside the source module (e.g.
  `src/shared/lib/datetime.test.ts`). Shared setup — DOM matchers and cleanup —
  lives in `src/test/setup.ts` and runs before every test file.
- **Timezone:** all test commands pin `TZ=America/Chicago` so date- and
  schedule-dependent assertions are deterministic on any machine. Don't remove
  this when adding new scripts; local-time behavior tests depend on it.
- **Style:** assert observable behavior (returned values, rendered content,
  store state, API requests at the boundary), not implementation details.
  Mock auth, toasts, and API modules at their module boundaries; mock `fetch`
  only when testing the centralized API client itself.
- **Config:** test configuration lives in `vitest.config.ts`, separate from
  `vite.config.ts` so the PWA plugin never loads during tests.

- **Component tests:** use semantic Testing Library queries and
  `@testing-library/user-event` for interactions — no snapshots, no
  implementation-detail assertions. Radix-based components work in jsdom;
  shared setup stubs `ResizeObserver` for them.

## Testing roadmap

The initial suite covers pure utilities (date/time, schema validation,
notification/user helpers), the centralized API client, all Zustand stores
(applicant/review, grading, sponsor/notification, application-schema/
user-management), and one representative component test (`SearchBar`).

Future component coverage is staged in priority order:

1. High-risk forms and dialogs (application submit, destructive admin actions)
2. Grading and schedule interactions (drag-select, vote/advance flows)
3. Hacker pages (schedule rendering, application status)
4. Auth and layout behavior (route guards, session-aware chrome)

Each stage should follow the `SearchBar` conventions: mock external boundaries
at module level, query semantically, assert observable behavior only.
