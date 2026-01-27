package auth

import (
	"context"
	"time"

	"github.com/hackutd/portal/internal/store"
	"github.com/supertokens/supertokens-golang/recipe/passwordless"
	"github.com/supertokens/supertokens-golang/recipe/passwordless/plessmodels"
	"github.com/supertokens/supertokens-golang/recipe/session"
	"github.com/supertokens/supertokens-golang/recipe/session/sessmodels"
	"github.com/supertokens/supertokens-golang/recipe/thirdparty"
	"github.com/supertokens/supertokens-golang/recipe/thirdparty/tpmodels"
	"github.com/supertokens/supertokens-golang/supertokens"
)

const DefaultSessionRole = store.RoleHacker

// Config holds the configuration needed for SuperTokens initialization.
type Config struct {
	AppName            string
	ConnectionURI      string
	APIKey             string
	APIBasePath        string
	APIURL             string
	FrontendURL        string
	GoogleClientID     string
	GoogleClientSecret string
}

// InitSuperTokens initializes the SuperTokens SDK with the given configuration.
func InitSuperTokens(cfg Config, appStore store.Storage) error {
	apiBasePath := cfg.APIBasePath

	recipes := []supertokens.Recipe{
		passwordlessRecipe(appStore),
		sessionRecipe(),
	}

	if googleEnabled(cfg) {
		recipes = append(recipes, googleRecipe(cfg, appStore))
	}

	return supertokens.Init(supertokens.TypeInput{
		Supertokens: &supertokens.ConnectionInfo{
			ConnectionURI: cfg.ConnectionURI,
			APIKey:        cfg.APIKey,
		},
		AppInfo: supertokens.AppInfo{
			AppName:       cfg.AppName,
			APIDomain:     cfg.APIURL,
			WebsiteDomain: cfg.FrontendURL,
			APIBasePath:   &apiBasePath,
		},
		RecipeList: recipes,
	})
}

// GoogleEnabled returns true if Google OAuth credentials are configured.
func GoogleEnabled(cfg Config) bool {
	return googleEnabled(cfg)
}

func googleEnabled(cfg Config) bool {
	return cfg.GoogleClientID != "" && cfg.GoogleClientSecret != ""
}

func passwordlessRecipe(appStore store.Storage) supertokens.Recipe {
	return passwordless.Init(plessmodels.TypeInput{
		ContactMethodEmail: plessmodels.ContactMethodEmailConfig{Enabled: true},
		FlowType:           "MAGIC_LINK",
		Override:           passwordlessOverrides(appStore),
	})
}

func sessionRecipe() supertokens.Recipe {
	return session.Init(&sessmodels.TypeInput{
		Override: sessionOverrides(),
	})
}

func googleRecipe(cfg Config, appStore store.Storage) supertokens.Recipe {
	return thirdparty.Init(&tpmodels.TypeInput{
		SignInAndUpFeature: tpmodels.TypeInputSignInAndUp{
			Providers: []tpmodels.ProviderInput{
				{
					Config: tpmodels.ProviderConfig{
						ThirdPartyId: "google",
						Clients: []tpmodels.ProviderClientConfig{
							{
								ClientID:     cfg.GoogleClientID,
								ClientSecret: cfg.GoogleClientSecret,
							},
						},
					},
				},
			},
		},
		Override: googleOverrides(appStore),
	})
}

func passwordlessOverrides(appStore store.Storage) *plessmodels.OverrideStruct {
	return &plessmodels.OverrideStruct{
		Functions: func(impl plessmodels.RecipeInterface) plessmodels.RecipeInterface {
			origCreateCode := *impl.CreateCode

			*impl.CreateCode = func(
				email *string,
				phoneNumber *string,
				userInputCode *string,
				tenantId string,
				userContext supertokens.UserContext,
			) (plessmodels.CreateCodeResponse, error) {
				if email != nil {
					if err := rejectIfExistingUserAuthDiffers(appStore, *email, store.AuthMethodPasswordless); err != nil {
						return plessmodels.CreateCodeResponse{}, err
					}
				}
				return origCreateCode(email, phoneNumber, userInputCode, tenantId, userContext)
			}

			return impl
		},
	}
}

func sessionOverrides() *sessmodels.OverrideStruct {
	return &sessmodels.OverrideStruct{
		Functions: func(impl sessmodels.RecipeInterface) sessmodels.RecipeInterface {
			origCreateNewSession := *impl.CreateNewSession

			*impl.CreateNewSession = func(
				userID string,
				accessTokenPayload map[string]interface{},
				sessionDataInDatabase map[string]interface{},
				disableAntiCsrf *bool,
				tenantId string,
				userContext supertokens.UserContext,
			) (sessmodels.SessionContainer, error) {
				if accessTokenPayload == nil {
					accessTokenPayload = map[string]interface{}{}
				}
				accessTokenPayload["role"] = string(DefaultSessionRole)

				// Store profile picture URL in session database (from Google OAuth)
				if userContext != nil {
					if pictureURL, ok := (*userContext)["profilePictureUrl"].(string); ok && pictureURL != "" {
						if sessionDataInDatabase == nil {
							sessionDataInDatabase = map[string]interface{}{}
						}
						sessionDataInDatabase["profilePictureUrl"] = pictureURL
					}
				}

				return origCreateNewSession(userID, accessTokenPayload, sessionDataInDatabase, disableAntiCsrf, tenantId, userContext)
			}

			return impl
		},
	}
}

func googleOverrides(appStore store.Storage) *tpmodels.OverrideStruct {
	return &tpmodels.OverrideStruct{
		Functions: func(impl tpmodels.RecipeInterface) tpmodels.RecipeInterface {
			origSignInUp := *impl.SignInUp

			*impl.SignInUp = func(
				thirdPartyID string,
				thirdPartyUserID string,
				email string,
				oAuthTokens tpmodels.TypeOAuthTokens,
				rawUserInfoFromProvider tpmodels.TypeRawUserInfoFromProvider,
				tenantId string,
				userContext supertokens.UserContext,
			) (tpmodels.SignInUpResponse, error) {
				if err := rejectIfExistingUserAuthDiffers(appStore, email, store.AuthMethodGoogle); err != nil {
					return tpmodels.SignInUpResponse{}, err
				}

				// grab picture from Google profile and pass to session via userContext
				var pictureURL string
				if rawUserInfoFromProvider.FromUserInfoAPI != nil {
					if url, ok := rawUserInfoFromProvider.FromUserInfoAPI["picture"].(string); ok && url != "" {
						pictureURL = url
					}
				}
				if pictureURL == "" && rawUserInfoFromProvider.FromIdTokenPayload != nil {
					if url, ok := rawUserInfoFromProvider.FromIdTokenPayload["picture"].(string); ok && url != "" {
						pictureURL = url
					}
				}
				if pictureURL != "" {
					(*userContext)["profilePictureUrl"] = pictureURL
				}

				return origSignInUp(thirdPartyID, thirdPartyUserID, email, oAuthTokens, rawUserInfoFromProvider, tenantId, userContext)
			}

			return impl
		},
	}
}

// attempted = the auth method the user is trying right now.
// If the user already exists with a different method, returns an error.
func rejectIfExistingUserAuthDiffers(appStore store.Storage, email string, attempted store.AuthMethod) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	existingUser, err := appStore.Users.GetByEmail(ctx, email)
	// user doesn't exist (registering for the first time) -> allow
	if err != nil {
		return nil
	}

	// user registered with a different auth method
	if existingUser.AuthMethod != attempted {
		return &AuthMethodMismatchError{
			Expected: existingUser.AuthMethod,
			Got:      attempted,
		}
	}

	return nil
}
