# Writing Frontend Tests (Vitest)

Every new feature ships with unit tests. This reference covers how the suite is wired, what to test for each kind of module, copy-ready recipes, and the mistakes that have already bitten this codebase.

## How the Suite Is Wired

| Piece | Where | What it means for you |
| --- | --- | --- |
| Runner | Vitest + jsdom, `vitest.config.ts` | `npm test` (once), `npm run test:watch`, `npm run test:coverage` |
| Discovery | `src/**/*.test.{ts,tsx}` | Tests elsewhere are ignored. `scripts/*.test.mjs` are separate `node --test` regression checks |
| Globals | `globals: false` | Always `import { describe, expect, it, vi } from "vitest"` |
| Setup | `src/test/setup.ts` | jest-dom matchers (`toBeInTheDocument`…), DOM cleanup, `ResizeObserver` stub for Radix |
| Timezone | `process.env.TZ = "America/Chicago"` in the config | Local-time results are deterministic — assert exact values |
| Mock hygiene | `mockReset: true`, `unstubGlobals: true` | Every `vi.fn()` loses its implementation and every `vi.stubGlobal` is undone **before each test**. Set behavior inside the test or its `beforeEach` |
| Aliases | `vite.aliases.ts` (shared with `vite.config.ts`) | `@/…` and `@/branding` resolve exactly like the app |
| Type check | `npm run build` runs `tsc -b` over `src/`, tests included | Fixtures must satisfy the full type — a missing field fails CI |
| Lint | ESLint runs on tests | Import sorting and import boundaries apply to test files too |

## Placement and Naming

- Co-locate: `<source>.test.ts` beside the module it covers — `store.ts` → `store.test.ts`, `createStore.ts` → `createStore.test.ts`, `SearchBar.tsx` → `SearchBar.test.tsx`.
- Name the file after the module it exercises, not the module that re-exports it.
- `describe` per behavior area; `it` names state the observable behavior ("drops a response that lands after the tab changed"), and the body must actually prove that name.

## What to Test per Layer

| Layer | Test | Don't test |
| --- | --- | --- |
| Pure utils (`utils.ts`, `mappers/`, `shared/lib/`) | Every branch, boundaries (0, max, empty, invalid), timezone edges (DST, day rollover) | Constants echoing themselves (`expect(MAX).toBe(5)`) |
| Zustand stores | State after success, after failure, loading/submitting flags cleared, abort handling, stale-response guards, toasts/`errorAlert` on the right paths | Internal sequence counters, private helpers |
| Page `api.ts` wrappers | Usually nothing — they're thin. Test only real logic (query-string building, response reshaping) | Re-testing the shared client |
| Zod / form schemas | Required vs optional, each constraint at and past its bound, conditional rules, default values | Zod itself |
| Components | Rendered output and user interactions via roles/labels/placeholder text | CSS classes, internal state, snapshots |

Priority when time is short: logic with branches > stores with async/race handling > forms > components.

## Recipe: Store Test

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFeatureStore } from "./store";
import type { Item } from "./types";

// vi.hoisted so the mock fns exist before vi.mock's hoisted factory runs.
const api = vi.hoisted(() => ({
  fetchItems: vi.fn(),
  deleteItem: vi.fn(),
}));
// Mock every export the store imports from the module, or the import is undefined.
vi.mock("./api", () => ({
  fetchItems: api.fetchItems,
  deleteItem: api.deleteItem,
}));

// Include every toast method the store calls (success/error/info).
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

/** Full, type-complete fixture with per-test overrides. */
function item(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    name: `Item ${id}`,
    created_at: "2026-03-14T15:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  // Full reset, including fields a partial setState would miss.
  useFeatureStore.setState(useFeatureStore.getInitialState(), true);
});

describe("fetchItems", () => {
  it("loads items and clears loading", async () => {
    api.fetchItems.mockResolvedValue({
      status: 200,
      data: { items: [item("1")] },
    });

    const p = useFeatureStore.getState().fetchItems();
    expect(useFeatureStore.getState().loading).toBe(true);
    await p;

    const s = useFeatureStore.getState();
    expect(s.items.map((i) => i.id)).toEqual(["1"]);
    expect(s.loading).toBe(false);
  });

  it("clears the list on failure", async () => {
    useFeatureStore.setState({ items: [item("old")] });
    api.fetchItems.mockResolvedValue({ status: 500, error: "boom" });

    await useFeatureStore.getState().fetchItems();

    expect(useFeatureStore.getState().items).toEqual([]);
    expect(useFeatureStore.getState().loading).toBe(false);
  });

  it("ignores an aborted request", async () => {
    useFeatureStore.setState({ items: [item("keep")] });
    api.fetchItems.mockResolvedValue({
      status: 200,
      data: { items: [item("new")] },
    });
    const controller = new AbortController();
    controller.abort();

    await useFeatureStore.getState().fetchItems(undefined, controller.signal);

    expect(useFeatureStore.getState().items.map((i) => i.id)).toEqual(["keep"]);
  });
});
```

Notes:

- For a store built by a factory (`createXStore(config)`), create a fresh instance per test instead of resetting a singleton.
- Mock modules by the specifier that resolves to the same file: `"./api"` from a sibling test, `"@/pages/admin/all-applicants/api"` for a cross-page import.
- If you mock `@/shared/lib/api` (for `errorAlert`), **every** module that still loads for real and imports from it must find its exports — otherwise you get `No "getRequest" export is defined on the mock`. Either mock those modules too (e.g. `vi.mock("./contract", …)`) or add the missing exports to the factory.
- Modules the store pulls in that need browser APIs jsdom lacks (canvas, `createImageBitmap` — e.g. `@/shared/lib/logo-image`) must be mocked at the module boundary.

## Recipe: Stale / Out-of-Order Responses

Stores guard against late responses with a module-level sequence counter. Prove the guard with a promise you resolve by hand:

```typescript
it("drops a response that lands after a newer request", async () => {
  let resolveOld!: (v: unknown) => void;
  api.fetchItems
    .mockReturnValueOnce(new Promise((resolve) => (resolveOld = resolve)))
    .mockResolvedValueOnce({ status: 200, data: { items: [item("new")] } });

  const older = useFeatureStore.getState().fetchItems();
  await useFeatureStore.getState().fetchItems();
  resolveOld({ status: 200, data: { items: [item("old")] } });
  await older;

  expect(useFeatureStore.getState().items.map((i) => i.id)).toEqual(["new"]);
  expect(useFeatureStore.getState().loading).toBe(false);
});
```

Use the same shape for "tab changed mid-flight", "navigated to another application", and "claim replaced the queue".

## Recipe: Pure Utility Test

```typescript
import { describe, expect, it } from "vitest";

import { formatSlot } from "./utils";

// Tests run under TZ=America/Chicago (pinned in vitest.config.ts).
describe("formatSlot", () => {
  it.each([
    ["midnight", 0, "12:00 AM"],
    ["noon", 48, "12:00 PM"],
    ["last slot", 95, "11:45 PM"],
    ["end-of-day boundary", 96, "12:00 AM"],
  ])("formats %s", (_label, slot, expected) => {
    expect(formatSlot(slot)).toBe(expected);
  });
});
```

- Prefer `it.each` tables with a human label as the first column.
- Cover boundaries explicitly: first/last value, one past each end, empty input, malformed input.
- For instants, build ISO strings in UTC and assert the exact Chicago result. Include one DST case (March 8, 2026 switches CST → CDT) and one that rolls into the previous local day (`03:00Z` is 10 PM the day before).
- For "now"-dependent code: `vi.setSystemTime(new Date("…Z"))` inside the test, plus `afterEach(() => vi.useRealTimers())` in the file.
- For `Intl` fallbacks you can't reach naturally, spy and restore: `vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts").mockReturnValue([...])`.

## Recipe: Schema / Form Validation Test

```typescript
function validate(fields: ApplicationSchemaField[], values: Record<string, unknown>) {
  // Pass values so show_if / required_if conditions resolve like the form does.
  return buildZodSchema(fields, values).safeParse(values);
}

it("requires the field once its controller shows it", () => {
  const optIn = field({ id: "travel", type: "checkbox" });
  const city = field({ id: "city", required: true, validation: { show_if: "travel" } });
  expect(validate([optIn, city], { travel: false, city: "" }).success).toBe(true);
  expect(validate([optIn, city], { travel: true, city: "" }).success).toBe(false);
});
```

- Test each rule at its bound and one past it (min, max, length).
- Test that whitespace-only answers fail required text.
- Test conditional rules **while another field is still invalid** — Zod drops object-level refinements once any property fails, which once let a required section through.
- For a React Hook Form resolver, call it directly: `await resolver(values, undefined, { fields: {}, shouldUseNativeValidation: false } as ResolverOptions<FieldValues>)` and assert on `errors`.

## Recipe: Component Test

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchBar } from "./SearchBar";

describe("SearchBar", () => {
  const onChange = vi.fn();

  it("clears and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<SearchBar value="ada" onChange={onChange} />);

    await user.type(screen.getByPlaceholderText("Search by name or email"), "{Escape}");

    expect(onChange).toHaveBeenCalledWith("");
    expect(screen.queryByPlaceholderText("Search by name or email")).not.toBeInTheDocument();
  });
});
```

- Query by role and accessible name first (`getByRole("button", { name: "Search" })`), then label, then placeholder/text. Never by class or test id unless nothing semantic exists.
- Drive interactions with `userEvent.setup()`, not `fireEvent`.
- Use `findBy…` / `waitFor` for anything that appears asynchronously.
- For controlled inputs, re-`render`/`rerender` with the new `value` to simulate the parent.
- Mock only what the component actually reaches (its store's API module, `sonner`). Don't add speculative mocks.
- No snapshots.

## Recipe: Shared API Client

Only `src/shared/lib/api.test.ts` stubs `fetch`. Everything else mocks the page `api.ts` module. If you touch the shared client:

```typescript
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock); // unstubGlobals restores it after each test
});
```

## Mistakes Already Made Here — Don't Repeat Them

| Mistake | Why it's wrong | Do instead |
| --- | --- | --- |
| `if (result.success) expect(...)` with no prior assertion | Passes silently when validation fails | `expect(result.success).toBe(true)` first |
| Calling an async action in `beforeEach` without awaiting it, before its mocks are set | Unhandled rejection; only "passed" because a previous test's mock leaked | Set mocks first, `await` the call, or don't call it at all |
| Regex/either-or assertions for dates (`/Mar 1[45]/`) | The timezone is pinned — a loose match hides real bugs | Assert the exact string |
| Assertions that are always true (e.g. "offset is a whole minute") | Proves nothing | Assert the concrete output |
| Already-sorted input in a "sorts" test | Sorting is never exercised | Feed deliberately unsorted input |
| Test name promises one thing, body checks another | Misleads the next reader | Rename it or test what it says |
| Asserting a known-wrong value to make a test green (`96 → "12:00 PM"`) | Locks the bug in | Fix the source, assert the correct value |
| Partial `setState({...})` resets | Leaves `error`, `leaderboard`, etc. from earlier tests | `setState(getInitialState(), true)` |
| Re-declaring a source type in the test | Drifts silently | Export the type from the source and import it |
| Fixtures missing new fields | `npm run build` fails on type errors | Fixture factory returns the full type; update it when the type grows |
| `vi.clearAllMocks()` in every file | Redundant — the config resets mocks | Rely on `mockReset` |

## Running

```bash
npm test                                         # whole suite
npx vitest run src/pages/admin/sponsors          # one directory
npx vitest run path/to/file.test.ts -t "name"    # one test — also proves it doesn't depend on order
TZ=UTC npm test                                  # confirm nothing depends on the host timezone
npm run build                                    # type-checks tests along with the app
```

## Checklist for a New Feature

- [ ] Every new util / mapper / schema has a `*.test.ts` beside it covering branches and boundaries
- [ ] Every new or changed store action has success, failure, and (if async with guards) stale/abort tests
- [ ] New components with interaction logic have a Testing Library test using roles/labels
- [ ] Fixtures are typed factories with `Partial<T>` overrides
- [ ] Stores reset with `getInitialState()`; mocks set inside the test or `beforeEach`
- [ ] Each new test passes when run alone (`-t "…"`)
- [ ] `npm test`, `npm run lint`, `npm run format:check`, and `npm run build` pass
