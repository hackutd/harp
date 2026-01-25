// SuperTokens configuration for passwordless authentication (magic links) with optional Google OAuth

import SuperTokens from 'supertokens-auth-react';
import Passwordless from 'supertokens-auth-react/recipe/passwordless';
import ThirdParty, { Google } from 'supertokens-auth-react/recipe/thirdparty';
import Session from 'supertokens-auth-react/recipe/session';

export const isGoogleAuthEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true';

export function initSuperTokens() {
  SuperTokens.init({
    appInfo: {
      appName: 'HackUTD Portal',
      apiDomain: import.meta.env.VITE_API_URL || window.location.origin,
      websiteDomain: window.location.origin,
      apiBasePath: '/auth',
    },
    recipeList: [
      Passwordless.init({
        contactMethod: 'EMAIL',
      }),
      // Only Google OAuth is enabled
      ...(isGoogleAuthEnabled
        ? [ThirdParty.init({
            signInAndUpFeature: {
              providers: [Google.init()],
            },
          })]
        : []),
      Session.init(),
    ],
  });
}
