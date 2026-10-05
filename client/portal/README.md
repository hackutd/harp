# HARP Portal

HARP's hacker, admin, and super-admin portal. Built with Vite, React,
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

npm run test:reviews       # Node regression checks for the review flow
npm run test:applications  # Node regression checks for the application flow
npm run test:auth          # Node regression checks for the auth flow
```

## Testing

Unit tests use **Vitest** with the **jsdom** environment and **Testing
Library**.

- **Placement:** tests are co-located with the code they exercise as
  `<name>.test.ts(x)` beside the source module (e.g.
  `src/shared/lib/datetime.test.ts`). Shared setup — DOM matchers and cleanup —
  lives in `src/test/setup.ts` and runs before every test file.
- **Timezone:** `vitest.config.ts` pins `TZ=America/Chicago` so date- and
  schedule-dependent assertions are deterministic on any machine, however
  Vitest is launched. Local-time behavior tests depend on it.
- **Mocks:** the config resets every mock and restores stubbed globals before
  each test (`mockReset`, `unstubGlobals`), so set up the mock behavior a test
  needs inside that test or its `beforeEach`. Reset Zustand stores with
  `useStore.setState(useStore.getInitialState(), true)`.
- **Style:** assert observable behavior (returned values, rendered content,
  store state, API requests at the boundary), not implementation details.
  Mock auth, toasts, and API modules at their module boundaries; mock `fetch`
  only when testing the centralized API client itself.
- **Config:** test configuration lives in `vitest.config.ts`, separate from
  `vite.config.ts` so the PWA plugin never loads during tests. Both read their
  path aliases from `vite.aliases.ts`, so tests resolve imports like the app.

- **Component tests:** use semantic Testing Library queries and
  `@testing-library/user-event` for interactions — no snapshots, no
  implementation-detail assertions. Radix-based components work in jsdom;
  shared setup stubs `ResizeObserver` for them.

## Testing roadmap

The initial suite covers pure utilities (date/time, schema validation,
notification/user helpers), the centralized API client, the main Zustand
stores (applicant/review, grading, sponsor/notification, application-schema/
user-management), and one representative component test (`SearchBar`). The
older `scripts/*.test.mjs` regression checks run under `node --test` and are
candidates to move into Vitest.

Future component coverage is staged in priority order:

1. High-risk forms and dialogs (application submit, destructive admin actions)
2. Grading and schedule interactions (drag-select, vote/advance flows)
3. Hacker pages (schedule rendering, application status)
4. Auth and layout behavior (route guards, session-aware chrome)

Each stage should follow the `SearchBar` conventions: mock external boundaries
at module level, query semantically, assert observable behavior only.
