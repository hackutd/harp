import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const project = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
const bundle = await build({
  absWorkingDir: project,
  stdin: {
    contents: `
      export { useAdminGradingStore as grading } from './src/pages/admin/reviews/grading/store.ts';
      export { useReviewsStore as list } from './src/pages/admin/reviews/store.ts';
      export { useReviewApplicationsStore as applications } from './src/pages/superadmin/reviews/store.ts';
    `,
    resolveDir: project,
    loader: "ts",
  },
  platform: "node",
  format: "cjs",
  bundle: true,
  write: false,
  plugins: [
    {
      name: "silent-toasts",
      setup(b) {
        b.onResolve({ filter: /^sonner$/ }, () => ({
          path: "toast",
          namespace: "test",
        }));
        b.onLoad({ filter: /.*/, namespace: "test" }, () => ({
          contents:
            "export const toast = { success(){}, warning(){}, error(){} };",
        }));
      },
    },
  ],
});
const module = { exports: {} };
new Function("module", "exports", "require", bundle.outputFiles[0].text)(
  module,
  module.exports,
  require,
);
const { grading, list, applications } = module.exports;
const reviews = [1, 2, 3].map((i) => ({
  id: `r${i}`,
  application_id: `a${i}`,
  vote: null,
  travel_status: "not_requested",
}));
const pendingPath = "/v1/admin/reviews/pending";
const completedPath = "/v1/admin/reviews/completed";
const appPath = "/v1/admin/applications";
let handlers;
let requests;
let failVote;

function ok(data) {
  return Response.json({ data });
}
function failed() {
  return Response.json({ error: "Database unavailable" }, { status: 500 });
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function appList(ids = ["a1"]) {
  return {
    applications: ids.map((id) => ({ id })),
    next_cursor: null,
    prev_cursor: null,
    has_more: false,
  };
}

beforeEach(() => {
  grading.getState().reset();
  list.getState().setTab("assigned");
  applications.getState().resetPagination();
  handlers = new Map();
  requests = [];
  failVote = false;
  // Exercise the real API wrappers as well as the actual bundled stores.
  globalThis.fetch = async (url, options) => {
    const path = new URL(url, "http://test.local").pathname;
    requests.push({ url, ...options });
    if (handlers.has(path)) return handlers.get(path)(url, options);
    if (path === pendingPath) return ok({ reviews });
    if (path === completedPath) return ok({ reviews: [] });
    if (path === appPath) return ok(appList());
    if (path === `${appPath}/stats`) return ok({ submitted: 1 });
    if (path.endsWith("/notes")) return ok({ notes: [] });
    if (path.startsWith(`${appPath}/`))
      return ok({ id: path.split("/").at(-1), ai_percent: null });
    if (path.startsWith("/v1/admin/reviews/") && options.method === "PUT") {
      return failVote ? failed() : ok({});
    }
    throw new Error(`Unexpected request: ${options.method} ${url}`);
  };
});

for (const tab of ["assigned", "completed"]) {
  test(`${tab} queue distinguishes failure from empty and supports retry`, async () => {
    list.getState().setTab(tab);
    const path = tab === "assigned" ? pendingPath : completedPath;
    handlers.set(path, failed);
    await list.getState().fetchReviews();
    assert.equal(list.getState().error, "Database unavailable");
    assert.equal(list.getState().loading, false);
    handlers.set(path, () => ok({ reviews }));
    await list.getState().fetchReviews();
    assert.equal(list.getState().error, null);
    assert.equal(list.getState().reviews.length, 3);
    handlers.set(path, () => ok({ reviews: [] }));
    await list.getState().fetchReviews();
    assert.equal(list.getState().error, null);
    assert.deepEqual(list.getState().reviews, []);
  });
}

test("network failures remain visible in both review queues", async () => {
  handlers.set(pendingPath, () => {
    throw new Error("Network offline");
  });
  await list.getState().fetchReviews();
  await grading.getState().fetchReviews();
  for (const store of [list, grading]) {
    assert.equal(store.getState().error, "Network offline");
    assert.equal(store.getState().loading, false);
  }
});

test("grading retry selects the requested review and loads its detail and notes", async () => {
  handlers.set(pendingPath, failed);
  await grading.getState().fetchReviews("r2");
  assert.equal(grading.getState().error, "Database unavailable");
  handlers.delete(pendingPath);
  await grading.getState().fetchReviews("r2");
  assert.equal(grading.getState().error, null);
  assert.equal(grading.getState().currentIndex, 1);
  assert.equal(grading.getState().detail.id, "a2");
  assert.equal(grading.getState().notesLoading, false);
  assert.ok(requests.some((r) => r.url === `${appPath}/a2/notes`));
  await grading.getState().fetchReviews("removed-review");
  assert.equal(grading.getState().currentIndex, 0);
  assert.equal(grading.getState().detail.id, "a1");
});

test("a successful empty grading queue has no error or stale detail", async () => {
  await grading.getState().fetchReviews();
  handlers.set(pendingPath, () => ok({ reviews: [] }));
  await grading.getState().fetchReviews();
  assert.equal(grading.getState().error, null);
  assert.equal(grading.getState().detail, null);
  assert.deepEqual(grading.getState().reviews, []);
});

test("grading advances through every assigned review and retains a failed vote", async () => {
  await grading.getState().fetchReviews();
  failVote = true;
  await grading.getState().submitVote("r1", "accept");
  assert.equal(grading.getState().reviews.length, 3);
  assert.equal(grading.getState().submitting, false);
  failVote = false;
  for (const id of ["r1", "r2", "r3"]) {
    const state = grading.getState();
    assert.equal(state.reviews[state.currentIndex].id, id);
    await state.submitVote(id, "accept");
  }
  assert.equal(grading.getState().reviews.length, 0);
  assert.equal(grading.getState().detail, null);
});

for (const [name, store] of [
  ["list", list],
  ["grading", grading],
]) {
  test(`${name} ignores superseded fetch responses`, async () => {
    const older = deferred();
    handlers.set(pendingPath, () => older.promise);
    const first = store.getState().fetchReviews();
    handlers.set(pendingPath, () => ok({ reviews: [reviews[2]] }));
    await store.getState().fetchReviews();
    older.resolve(failed());
    await first;
    assert.equal(store.getState().error, null);
    assert.equal(store.getState().reviews[0].id, "r3");
  });
  test(`${name} abort releases loading without presenting an error`, async () => {
    const response = deferred();
    handlers.set(pendingPath, () => response.promise);
    const controller = new AbortController();
    const request =
      name === "list"
        ? store.getState().fetchReviews(controller.signal)
        : store.getState().fetchReviews(undefined, controller.signal);
    controller.abort();
    response.resolve(failed());
    await request;
    assert.equal(store.getState().error, null);
    assert.equal(store.getState().loading, false);
    assert.deepEqual(store.getState().reviews, []);
  });
}

test("switching queue tabs invalidates the previous tab's request", async () => {
  const older = deferred();
  handlers.set(pendingPath, () => older.promise);
  const first = list.getState().fetchReviews();
  list.getState().setTab("completed");
  await list.getState().fetchReviews();
  older.resolve(ok({ reviews }));
  await first;
  assert.equal(list.getState().tab, "completed");
  assert.deepEqual(list.getState().reviews, []);
});

test("reset invalidates pending grading requests and detail requests", async () => {
  const detail = deferred();
  handlers.set(`${appPath}/a1`, () => detail.promise);
  const first = grading.getState().fetchReviews();
  await new Promise((r) => setImmediate(r));
  grading.getState().reset();
  await grading.getState().fetchReviews("r2");
  detail.resolve(ok({ id: "a1" }));
  await first;
  assert.equal(grading.getState().detail.id, "a2");
});

test("grading cannot submit or navigate while the queue is failed or loading", async () => {
  handlers.set(pendingPath, failed);
  await grading.getState().fetchReviews();
  await grading.getState().submitVote("r1", "accept");
  grading.getState().navigateNext();
  assert.equal(grading.getState().currentIndex, 0);
  assert.equal(requests.filter((r) => r.method === "PUT").length, 0);
});

test("application refresh preserves filters and sort, drops cursor, and exposes retry errors", async () => {
  await applications.getState().fetchApplications({
    status: "submitted",
    search: "alice",
    sort_by: "reject_votes",
    cursor: "page2",
  });
  handlers.set(appPath, failed);
  await applications.getState().fetchApplications();
  assert.equal(applications.getState().error, "Database unavailable");
  assert.equal(applications.getState().currentSearch, "alice");
  handlers.delete(appPath);
  await applications.getState().fetchApplications();
  assert.equal(applications.getState().error, null);
  const query = new URL(requests.at(-1).url, "http://test.local").searchParams;
  assert.equal(query.get("status"), "submitted");
  assert.equal(query.get("search"), "alice");
  assert.equal(query.get("sort_by"), "reject_votes");
  assert.equal(query.get("cursor"), null);
});

test("application and statistics refreshes ignore stale responses", async () => {
  for (const [path, action, errorKey] of [
    [appPath, "fetchApplications", "error"],
    [`${appPath}/stats`, "fetchStats", "statsError"],
  ]) {
    const older = deferred();
    handlers.set(path, () => older.promise);
    const first = applications.getState()[action]();
    handlers.delete(path);
    await applications.getState()[action]();
    older.resolve(failed());
    await first;
    assert.equal(applications.getState()[errorKey], null);
  }
});

test("a vote response from before a queue reset cannot change the new queue", async () => {
  await grading.getState().fetchReviews();
  const vote = deferred();
  handlers.set("/v1/admin/reviews/r1", () => vote.promise);
  const first = grading.getState().submitVote("r1", "accept");
  grading.getState().reset();
  await grading.getState().fetchReviews("r2");
  grading.getState().setLocalNotes("New session notes");
  vote.resolve(ok({}));
  await first;
  assert.equal(grading.getState().reviews.length, 3);
  assert.equal(grading.getState().currentIndex, 1);
  assert.equal(grading.getState().localNotes, "New session notes");
});

test("completing the last review invalidates its outstanding detail request", async () => {
  handlers.set(pendingPath, () => ok({ reviews: [reviews[0]] }));
  const detail = deferred();
  handlers.set(`${appPath}/a1`, () => detail.promise);
  const first = grading.getState().fetchReviews();
  await new Promise((r) => setImmediate(r));
  await grading.getState().submitVote("r1", "accept");
  detail.resolve(ok({ id: "a1" }));
  await first;
  assert.equal(grading.getState().reviews.length, 0);
  assert.equal(grading.getState().detail, null);
  assert.equal(grading.getState().detailLoading, false);
});
