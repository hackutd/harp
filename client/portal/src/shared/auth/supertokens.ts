import SuperTokens from "supertokens-auth-react";
import Passwordless from "supertokens-auth-react/recipe/passwordless";
import Session from "supertokens-auth-react/recipe/session";
import ThirdParty, { Google } from "supertokens-auth-react/recipe/thirdparty";

import { branding } from "@/branding";
import {
  clearReferralOnceSent,
  withReferralHeader,
} from "@/shared/lib/referral";

import { withAccountSelection } from "./account-selection";

export const isGoogleAuthEnabled =
  import.meta.env.VITE_GOOGLE_AUTH_ENABLED === "true";

export function initSuperTokens() {
  SuperTokens.init({
    appInfo: {
      appName: branding.authAppName,
      apiDomain: window.location.origin,
      websiteDomain: window.location.origin,
      apiBasePath: "/auth",
    },
    recipeList: [
      Passwordless.init({
        contactMethod: "EMAIL",
        // The two requests that reveal a new user's email carry the referral
        // code, so the backend can credit the link once the account exists.
        // The code is dropped as soon as the backend holds it: the magic link
        // may be opened on another device, and a code left here would credit
        // the next person to sign up in this browser.
        preAPIHook: async (context) =>
          context.action === "PASSWORDLESS_CREATE_CODE"
            ? {
                ...context,
                requestInit: withReferralHeader(context.requestInit),
              }
            : context,
        postAPIHook: async (context) => {
          if (context.action === "PASSWORDLESS_CREATE_CODE") {
            await clearReferralOnceSent(context.fetchResponse);
          }
        },
      }),
      // Only Google OAuth is enabled
      ...(isGoogleAuthEnabled
        ? [
            ThirdParty.init({
              override: { functions: withAccountSelection },
              preAPIHook: async (context) =>
                context.action === "THIRD_PARTY_SIGN_IN_UP"
                  ? {
                      ...context,
                      requestInit: withReferralHeader(context.requestInit),
                    }
                  : context,
              postAPIHook: async (context) => {
                if (context.action === "THIRD_PARTY_SIGN_IN_UP") {
                  await clearReferralOnceSent(context.fetchResponse);
                }
              },
              signInAndUpFeature: {
                providers: [Google.init()],
              },
            }),
          ]
        : []),
      Session.init(),
    ],
  });
}
