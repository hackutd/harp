import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const bundle = await build({
  absWorkingDir: fileURLToPath(new URL("../", import.meta.url)),
  entryPoints: ["src/shared/auth/account-selection.ts"],
  platform: "node",
  format: "cjs",
  bundle: true,
  write: false,
  external: ["supertokens-auth-react/recipe/session"],
});

function loadAuth(signOut = async () => {}) {
  const module = { exports: {} };
  new Function("module", "exports", "require", bundle.outputFiles[0].text)(
    module,
    module.exports,
    () => ({ signOut }),
  );
  return module.exports;
}

test("explicit logout persists through restart and OAuth cancellation until portal login", async () => {
  const previousStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  try {
    const input = { thirdPartyId: "google" };
    const originalURL =
      "https://accounts.google.com/o/oauth2/v2/auth?state=saved-state&code_challenge=saved-challenge&redirect_uri=https%3A%2F%2Fportal.example%2Fauth%2Fcallback%2Fgoogle";
    const original = {
      getAuthorisationURLWithQueryParamsAndSetState: async (received) => {
        assert.equal(received, input);
        return originalURL;
      },
    };
    let auth = loadAuth();
    const redirect = () =>
      auth
        .withAccountSelection(original)
        .getAuthorisationURLWithQueryParamsAndSetState(input);

    // Fresh login and session expiration preserve the SDK URL unchanged.
    assert.equal(await redirect(), originalURL);
    const failingAuth = loadAuth(async () => {
      throw new Error("logout failed");
    });
    await assert.rejects(failingAuth.signOutExplicitly(), /logout failed/);
    assert.equal(await redirect(), originalURL);

    await auth.signOutExplicitly();
    auth = loadAuth(); // App restart: only persistent storage survives.
    for (let attempt = 0; attempt < 2; attempt++) {
      const url = new URL(await redirect());
      assert.equal(url.searchParams.get("prompt"), "select_account");
      for (const [key, value] of new URL(originalURL).searchParams) {
        assert.equal(url.searchParams.get(key), value);
      }
    }
    // Both Google and magic-link callbacks complete the same portal login.
    auth.completePortalLogin();
    assert.equal(await redirect(), originalURL);
    auth = loadAuth();
    assert.equal(await redirect(), originalURL);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});

test("storage denial does not prevent logout or login", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("storage denied");
    },
  });
  try {
    const auth = loadAuth();
    const originalURL =
      "https://accounts.google.com/o/oauth2/v2/auth?state=saved";
    const recipe = auth.withAccountSelection({
      getAuthorisationURLWithQueryParamsAndSetState: async () => originalURL,
    });
    await auth.signOutExplicitly();
    assert.equal(
      new URL(
        await recipe.getAuthorisationURLWithQueryParamsAndSetState({
          thirdPartyId: "google",
        }),
      ).searchParams.get("prompt"),
      "select_account",
    );
    assert.equal(
      await recipe.getAuthorisationURLWithQueryParamsAndSetState({
        thirdPartyId: "other",
      }),
      originalURL,
    );
    auth.completePortalLogin();
    assert.equal(
      await recipe.getAuthorisationURLWithQueryParamsAndSetState({
        thirdPartyId: "google",
      }),
      originalURL,
    );
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});
