package auth

import (
	"net/url"
	"testing"

	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/require"
	"github.com/supertokens/supertokens-golang/recipe/thirdparty"
	"github.com/supertokens/supertokens-golang/recipe/thirdparty/providers"
	"github.com/supertokens/supertokens-golang/supertokens"
)

func TestGoogleLoginUsesDefaultAccountSelection(t *testing.T) {
	supertokens.ResetForTest()
	t.Cleanup(supertokens.ResetForTest)
	require.NoError(t, InitSuperTokens(Config{
		AppName: "test", ConnectionURI: "http://localhost:3567",
		APIBasePath: "/auth", APIURL: "http://localhost:8080",
		FrontendURL:    "http://localhost:3000",
		GoogleClientID: "test-client", GoogleClientSecret: "test-secret",
	}, store.Storage{}, nil))

	recipe, err := thirdparty.GetRecipeInstanceOrThrowError()
	require.NoError(t, err)
	require.Len(t, recipe.Providers, 1)
	provider := providers.Google(recipe.Providers[0])
	userContext := &map[string]interface{}{}
	provider.Config, err = provider.GetConfigForClientType(nil, userContext)
	require.NoError(t, err)
	// Supply the discovery result locally; URL generation needs no Google session
	// or running SuperTokens core. All query parameters come from the real recipe.
	provider.Config.AuthorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth"
	callback := "http://localhost:3000/auth/callback/google"
	redirect, err := provider.GetAuthorisationRedirectURL(callback, userContext)
	require.NoError(t, err)
	authorizationURL, err := url.Parse(redirect.URLWithQueryParams)
	require.NoError(t, err)
	params := authorizationURL.Query()
	require.Equal(t, callback, params.Get("redirect_uri"))
	require.Equal(t, "test-client", params.Get("client_id"))
	require.Equal(t, "code", params.Get("response_type"))
	// The frontend requests account selection only after an explicit logout.
	// Session expiration must retain Google's default sign-in behavior.
	require.Empty(t, params.Get("prompt"))
}
