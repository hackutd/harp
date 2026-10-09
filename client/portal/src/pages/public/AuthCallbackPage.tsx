import { IconAlertTriangle, IconArrowLeft } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Session, { signOut } from "supertokens-auth-react/recipe/session";
import { redirectToThirdPartyLogin } from "supertokens-auth-react/recipe/thirdparty";

import zeroDayTitle from "@/assets/title-login.webp";
import { AuthFlowSkeleton } from "@/components/AuthFlowSkeleton";
import { SkyBackdrop } from "@/components/SkyBackdrop";
import { Button } from "@/components/ui/button";
import { completePortalLogin, isGoogleAuthEnabled } from "@/shared/auth";
import { isMobileViewport } from "@/shared/hooks";
import { useUserStore } from "@/shared/stores";

export default function AuthCallback() {
  const fetchUser = useUserStore((state) => state.fetchUser);
  const authError = useUserStore((state) => state.authError);
  const clearAuthError = useUserStore((state) => state.clearAuthError);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      const sessionExists = await Session.doesSessionExist();

      if (sessionExists) {
        await fetchUser();

        const { user, authError: error } = useUserStore.getState();

        if (user) {
          completePortalLogin();
          // Redirect based on role. The admin portal is desktop-only, so
          // admins signing in on a small screen land in the hacker app.
          const isAdmin = user.role === "admin" || user.role === "super_admin";

          if (isAdmin && !isMobileViewport()) {
            navigate("/admin/all-applicants", { replace: true });
          } else {
            navigate("/app", { replace: true });
          }
        } else if (error && error.status === 409) {
          await signOut();
          setIsLoading(false);
        } else {
          navigate("/", { replace: true });
        }
      } else {
        navigate("/", { replace: true });
      }
    };

    handleCallback();
  }, [fetchUser, navigate]);

  const handleGoToLogin = () => {
    clearAuthError();
    navigate("/", { replace: true });
  };

  const handleGoogleLogin = async () => {
    clearAuthError();
    try {
      await redirectToThirdPartyLogin({ thirdPartyId: "google" });
    } catch {
      // If redirect fails, just go to login page
      navigate("/", { replace: true });
    }
  };

  // Show auth method mismatch error
  if (!isLoading && authError && authError.status === 409) {
    const isGoogleRequired = authError.message.includes("Google");

    return (
      <main className="zero-login relative isolate min-h-svh overflow-hidden bg-black text-white">
        <SkyBackdrop />

        <div className="relative z-30 flex min-h-svh items-center justify-center px-5 py-16">
          <div className="w-full max-w-[520px]">
            <img
              src={zeroDayTitle}
              alt="HackUTD Zero Day"
              className="mx-auto mb-5 w-full max-w-[430px] object-contain"
            />

            <section className="zero-login-panel relative p-px">
              <div className="zero-login-panel-inner px-5 py-6 sm:px-8 sm:py-8">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <p className="font-mono text-[10px] tracking-[0.28em] text-ice uppercase">
                    Access exception // Sign-in method
                  </p>
                  <span className="h-1.5 w-1.5 bg-ice" />
                </div>

                <div className="pt-6">
                  <div className="flex size-11 items-center justify-center border border-amber-400/40 bg-amber-400/10 text-amber-300">
                    <IconAlertTriangle aria-hidden className="size-5" />
                  </div>
                  <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-white">
                    Different sign-in method required
                  </h1>
                  <p className="mt-2 text-sm text-white/60">
                    This email is already registered with a different sign-in
                    method.
                  </p>
                </div>

                <div className="my-6 border-l-2 border-ice bg-ice/10 px-4 py-3.5 text-sm leading-6 text-white/75">
                  {authError.message}
                </div>

                <div className="space-y-3">
                  <Button
                    className="zero-cut-button h-12 w-full bg-tide text-xs font-semibold tracking-[0.18em] text-white uppercase hover:bg-tide-hover focus-visible:ring-ice/50"
                    onClick={
                      isGoogleRequired && isGoogleAuthEnabled
                        ? handleGoogleLogin
                        : handleGoToLogin
                    }
                  >
                    {isGoogleRequired && isGoogleAuthEnabled
                      ? "Continue with Google"
                      : "Sign in with magic link"}
                  </Button>
                  <Button
                    variant="outline"
                    className="zero-cut-button h-12 w-full border-ice/50 bg-transparent text-xs font-medium tracking-[0.16em] text-white uppercase hover:border-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-ice/50"
                    onClick={handleGoToLogin}
                  >
                    <IconArrowLeft aria-hidden className="size-4" />
                    Back to sign in
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  // Loading state
  return <AuthFlowSkeleton />;
}
