import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const project = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
const bundle = await build({
  absWorkingDir: project,
  stdin: {
    contents: `
      export * from './src/pages/hacker/apply/draft.ts';
      export { updateMyApplication } from './src/pages/hacker/apply/api.ts';
      export { buildApplicationResolver } from './src/pages/hacker/apply/validations.ts';
      export { buildZodSchema, getObsoleteOptions, isFieldVisible } from './src/shared/lib/schema-utils.ts';
      export * from './src/shared/lib/phone-input.ts';
    `,
    resolveDir: project,
    loader: "ts",
  },
  platform: "node",
  format: "cjs",
  bundle: true,
  write: false,
});
const module = { exports: {} };
new Function("module", "exports", "require", bundle.outputFiles[0].text)(
  module,
  module.exports,
  require,
);
const {
  buildZodSchema,
  buildApplicationResolver,
  getObsoleteOptions,
  isFieldVisible,
  reconcileDraftValues,
  reconcileDraftStep,
  draftResponses,
  createDraftSaver,
  updateMyApplication,
} = module.exports;
const originalFetch = globalThis.fetch;
const { splitPhoneNumber, formatPhoneNational, joinPhoneNumber } =
  module.exports;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const field = (extra = {}) => ({
  id: "level_of_study",
  type: "select",
  label: "Level of Study",
  required: true,
  section: "education",
  display_order: 0,
  options: ["Undergraduate", "Graduate"],
  ...extra,
});
const schema = [
  field(),
  field({
    id: "first_name",
    type: "text",
    section: "personal",
    options: undefined,
  }),
];
const answers = { level_of_study: "Senior", first_name: "Ada" };

test("outdated draft choices allow Continue but fail final validation until corrected", async () => {
  const resolver = buildApplicationResolver(schema);
  const navigation = await resolver(
    answers,
    {},
    { fields: {}, shouldUseNativeValidation: false },
  );
  assert.deepEqual(navigation.errors, {});
  const validation = buildZodSchema(schema, answers).safeParse(answers);
  assert.equal(validation.success, false);
  assert.deepEqual(
    validation.error.issues.map((issue) => issue.path[0]),
    ["level_of_study"],
  );
  assert.equal(
    buildZodSchema(schema).safeParse({
      ...answers,
      level_of_study: "Undergraduate",
    }).success,
    true,
  );
  const missing = await resolver(
    { ...answers, first_name: "" },
    {},
    { fields: {}, shouldUseNativeValidation: false },
  );
  assert.ok(missing.errors.first_name, "required fields still gate navigation");
});

test("membership is exact, optional blanks pass, and empty option lists remain unrestricted", () => {
  for (const [f, value, valid] of [
    [field(), "undergraduate", false],
    [field(), " Undergraduate ", false],
    [field(), 123, false],
    [field(), "", false],
    [field({ required: false }), "", true],
    [field({ required: false }), " ", true],
    [field({ options: [] }), "Senior", true],
    [field({ type: "multi_select" }), ["Undergraduate", "Senior"], false],
    [field({ type: "multi_select" }), ["Undergraduate"], true],
    [field({ type: "multi_select" }), [123], false],
    [field({ type: "multi_select", required: false }), [], true],
    [field({ type: "multi_select", options: [] }), ["Senior"], true],
  ]) {
    assert.equal(
      buildZodSchema([f]).safeParse({ [f.id]: value }).success,
      valid,
      JSON.stringify({ f, value }),
    );
  }
});

test("obsolete choices include hidden questions and can be removed without losing valid selections", () => {
  const f = field({ type: "multi_select", validation: { show_if: "travel" } });
  const values = {
    travel: false,
    level_of_study: ["Senior", "Graduate", "Senior"],
  };
  assert.equal(isFieldVisible(f, values), false);
  const obsolete = getObsoleteOptions(f, values.level_of_study);
  assert.deepEqual(obsolete, ["Senior"]);
  const corrected = values.level_of_study.filter(
    (choice) => !obsolete.includes(choice),
  );
  assert.deepEqual(corrected, ["Graduate"]);
  assert.equal(buildZodSchema([f], values).safeParse(values).success, false);
  assert.equal(
    buildZodSchema([f], values).safeParse({
      ...values,
      level_of_study: corrected,
    }).success,
    true,
  );
  assert.deepEqual(
    getObsoleteOptions(field({ type: "text" }), "Free text"),
    [],
  );
});

test("schema reconciliation preserves answers and the active section", () => {
  const additional = field({
    id: "new_question",
    type: "text",
    section: "new",
    section_order: 0,
  });
  const expanded = [additional, ...schema];
  const values = reconcileDraftValues(answers, expanded);
  assert.deepEqual(values, { ...answers, new_question: "" });
  assert.deepEqual(answers, { level_of_study: "Senior", first_name: "Ada" });
  assert.equal(reconcileDraftStep(0, schema, expanded), 1);
  assert.equal(
    reconcileDraftStep(2, schema, expanded),
    3,
    "review stays selected",
  );
  assert.equal(
    reconcileDraftStep(3, expanded, schema),
    2,
    "removed section clamps safely",
  );
  assert.deepEqual(
    draftResponses(values, schema),
    answers,
    "removed questions are excluded from requests",
  );
});

test("PATCH errors preserve the offending question ids", async () => {
  globalThis.fetch = async () =>
    Response.json(
      { error: "validation errors", fields: ["level_of_study"] },
      { status: 400 },
    );
  assert.deepEqual(await updateMyApplication({ responses: answers }), {
    status: 400,
    error: "validation errors",
    fields: ["level_of_study"],
  });
});

test("serialized saves preserve edits made during a request and use refreshed questions for queued saves", async () => {
  let state = { values: { ...answers }, schema, revision: 0 };
  const writes = [];
  const completions = [];
  let release;
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    writes.push(payload);
    if (writes.length === 1)
      await new Promise((resolve) => {
        release = resolve;
      });
    return Response.json({
      data: {
        id: "draft",
        responses: payload.responses,
        application_schema: [
          ...schema,
          field({ id: "new_question", type: "text" }),
        ],
      },
    });
  };
  const save = createDraftSaver({
    read: () => state,
    request: updateMyApplication,
    onStart() {},
    onSaved(app) {
      state = {
        ...state,
        schema: app.application_schema,
        values: reconcileDraftValues(state.values, app.application_schema),
      };
    },
    async onFailure() {
      assert.fail("unexpected failure");
    },
    onFinish(result) {
      completions.push(result);
    },
  });
  const first = save();
  await new Promise((resolve) => setImmediate(resolve));
  state.values.first_name = "New edit";
  state.revision++;
  const second = save();
  assert.equal(writes.length, 1, "no concurrent writes");
  release();
  await Promise.all([first, second]);
  assert.equal(writes[0].responses.first_name, "Ada");
  assert.equal(writes[1].responses.first_name, "New edit");
  assert.equal(writes[1].responses.new_question, "");
  assert.equal(state.values.level_of_study, "Senior");
  assert.equal(
    completions[0].current,
    false,
    "old response cannot report current edits saved",
  );
  assert.equal(completions[1].current, true);
});

test("a failed save leaves values intact and a later retry succeeds", async () => {
  const state = { values: { ...answers }, schema, revision: 0 };
  let offline = true;
  let failure;
  globalThis.fetch = async () => {
    if (offline) throw new Error("Offline");
    return Response.json({
      data: { id: "draft", responses: answers, application_schema: schema },
    });
  };
  const save = createDraftSaver({
    read: () => state,
    request: updateMyApplication,
    onStart() {},
    onSaved() {},
    async onFailure(res) {
      failure = res;
    },
    onFinish() {},
  });
  assert.equal((await save()).response.status, 500);
  assert.equal(failure.error, "Offline");
  assert.deepEqual(state.values, answers);
  offline = false;
  assert.equal((await save()).response.status, 200);
});

test("phone validation accepts editable country codes and preserves existing US numbers", () => {
  const phone = field({ id: "phone", type: "phone" });
  for (const value of [
    "+12025551234",
    "+442079460958",
    "+919876543210",
    "+61293744000",
  ]) {
    assert.equal(
      buildZodSchema([phone]).safeParse({ phone: value }).success,
      true,
      value,
    );
  }
  for (const value of [
    "2025551234",
    "+",
    "+0123456789",
    "+12025551234123456",
    "+1202abc1234",
  ]) {
    assert.equal(
      buildZodSchema([phone]).safeParse({ phone: value }).success,
      false,
      value,
    );
  }
  assert.equal(
    buildZodSchema([{ ...phone, required: false }]).safeParse({ phone: "" })
      .success,
    true,
  );
});

test("phone entry adds the plus automatically and restores the US mask", () => {
  const parts = { countryCode: "1", national: "2025551234" };
  assert.equal(formatPhoneNational(parts), "(202) 555-1234");
  assert.equal(joinPhoneNumber(parts), "+12025551234");
  assert.deepEqual(splitPhoneNumber("+1 (202) 555-1234"), parts);
  assert.deepEqual(splitPhoneNumber(""), { countryCode: "1", national: "" });
  assert.equal(joinPhoneNumber({ countryCode: "44", national: "" }), "");
  assert.equal(
    joinPhoneNumber({ countryCode: "", national: "2025551234" }),
    "2025551234",
  );
});

test("international phone numbers round-trip without lost digits or country codes", () => {
  for (const value of [
    "+442079460958",
    "+919876543210",
    "+61293744000",
    "+971501234567",
    "+74951234567",
  ]) {
    const parts = splitPhoneNumber(value);
    assert.equal(joinPhoneNumber(parts), value);
    assert.equal(formatPhoneNational(parts).replace(/\D/g, ""), parts.national);
  }
  const longer = { countryCode: "49", national: "1234567890123" };
  assert.equal(formatPhoneNational(longer).replace(/\D/g, ""), longer.national);
});
