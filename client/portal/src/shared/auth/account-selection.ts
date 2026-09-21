import { signOut } from "supertokens-auth-react/recipe/session";
import type { RecipeInterface } from "supertokens-web-js/recipe/thirdparty";

const storageKey = "harp:choose-google-account";
let selectionRequired = false;

function requiresAccountSelection() {
  try {
    return localStorage.getItem(storageKey) === "true" || selectionRequired;
  } catch {
    return selectionRequired;
  }
}

export async function signOutExplicitly() {
  await signOut();
  selectionRequired = true;
  try {
    localStorage.setItem(storageKey, "true");
    selectionRequired = false;
  } catch {
    // Storage restrictions must not prevent logout; retain intent in memory.
  }
}

export function completePortalLogin() {
  selectionRequired = false;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Login still succeeds when persistent storage is unavailable.
  }
}

export function withAccountSelection(
  original: RecipeInterface,
): RecipeInterface {
  return {
    ...original,
    getAuthorisationURLWithQueryParamsAndSetState: async (input) => {
      const authorizationURL =
        await original.getAuthorisationURLWithQueryParamsAndSetState(input);
      if (input.thirdPartyId !== "google" || !requiresAccountSelection()) {
        return authorizationURL;
      }
      const url = new URL(authorizationURL);
      url.searchParams.set("prompt", "select_account");
      // Keep intent through cancellation/errors, until portal login succeeds.
      return url.toString();
    },
  };
}
