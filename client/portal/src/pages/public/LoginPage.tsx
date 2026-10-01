import { ArrowLeft, ArrowRight, ArrowUpRight, Mail } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router";
import { createCode } from "supertokens-auth-react/recipe/passwordless";
import { useSessionContext } from "supertokens-auth-react/recipe/session";
import { redirectToThirdPartyLogin } from "supertokens-auth-react/recipe/thirdparty";

import googleIcon from "@/assets/google_icon.webp";
import mascots from "@/assets/mascots.webp";
import sky from "@/assets/sky.webp";
import wordmark from "@/assets/zero-day-wordmark.webp";
import { Button } from "@/components/ui/button";
import { checkEmailAuthMethod } from "@/shared/lib/api";

import { fetchLegalConfig } from "./api";
import type { LegalConfig } from "./types";

type LoginState = "email" | "sending" | "sent" | "error";

// The marketing site's chamfer: top-left and bottom-right corners cut, in px so
// the corners stay square at any width. A clip-path also clips focus rings, so
// buttons draw focus as an inset shadow instead.
const NOTCH =
  "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)";
const NOTCH_SM =
  "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)";
const NOTCH_LG =
  "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)";

const BUTTON =
  "h-14 w-full rounded-none text-[13px] font-medium tracking-[0.1em] uppercase focus-visible:ring-0 focus-visible:shadow-[inset_0_0_0_2px_#fff]";

const LEGAL_LINK = "login-sweep-link text-[#8b93a1]";

// The night sky from zeroday.hackutd.co behind a single card. The art is
// portrait and fades to black below the stars, so it is pinned to the top and
// the page's own black carries on underneath at any height. The art is
// mirrored so the moon sits on the left, and from `lg` the card moves right to
// leave the moon and the brightest clouds in view.
function ZeroDayShell({ children }: { children: ReactNode }) {
  return (
    <main className="zero-cursor font-satoshi relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-black px-5 pt-20 pb-12 text-[#f4f2ff] sm:px-8 lg:items-end lg:px-[9%]">
      <img
        src={sky}
        alt=""
        aria-hidden
        className="absolute inset-0 -z-10 size-full -scale-x-100 object-cover object-[60%_0%]"
      />
      <div aria-hidden className="star-field -z-10">
        <span className="shooting-star" />
      </div>
      <div aria-hidden className="star-field star-field-reverse -z-10">
        <span className="shooting-star [--star-delay:7s] [--star-top:12%]" />
      </div>

      <a
        href="https://zeroday.hackutd.co"
        aria-label="Back to HackUTD Zero Day"
        className="group absolute top-6 left-5 flex size-11 items-center justify-center bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25 focus-visible:shadow-[inset_0_0_0_2px_#fff] focus-visible:outline-none sm:left-8 lg:left-[9%]"
        style={{ clipPath: NOTCH_SM }}
      >
        <ArrowLeft
          aria-hidden
          strokeWidth={2.5}
          className="size-5 transition-transform group-hover:-translate-x-0.5"
        />
      </a>

      <div className="flex w-full max-w-[660px] flex-col items-center gap-6">
        <img
          src={wordmark}
          alt="HackUTD's Zero Day"
          className="w-[min(80%,360px)]"
        />

        <div
          className="login-glow w-full"
          style={{ "--notch": NOTCH_LG } as CSSProperties}
        >
          <div className="login-glow-card relative isolate flex flex-col justify-center overflow-hidden px-7 py-10 sm:px-14 sm:py-16 lg:min-h-[min(640px,70svh)]">
            {/* The mascots peek up from the card's bottom-right corner, cut off
              by its edge. Luminosity blending recolours them in the card's
              violet, and the mask fades them out before they reach the form.
              Only from `lg`, where the card is taller than its content and
              leaves them room. */}
            <img
              src={mascots}
              alt=""
              aria-hidden
              className="pointer-events-none absolute right-0 bottom-0 -z-10 hidden w-[60%] translate-x-[8%] translate-y-[14%] opacity-25 mix-blend-luminosity [mask-image:linear-gradient(to_top,black_35%,transparent_85%)] lg:block"
            />
            {children}
          </div>
        </div>

        <a
          href="https://github.com/hackutd/harp"
          target="_blank"
          rel="noreferrer"
          className="login-harp-link inline-flex items-center gap-1.5 text-[12px] tracking-[0.12em] text-[#b4b9c4] uppercase hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Powered by HARP
          <ArrowUpRight aria-hidden className="size-3" />
        </a>
      </div>
    </main>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] tracking-[0.18em] text-[#dbc4ff] uppercase sm:text-[12px]">
      {children}
    </p>
  );
}

// Hypik has no digits or punctuation, so headings passed here must be letters
// and spaces only. It runs about 10px wide per px of size in caps, so the size
// tracks the viewport to keep "Enter Zero Day" on one line inside the card.
function Heading({ children }: { children: ReactNode }) {
  return (
    <h1 className="font-hypik mt-3 text-[clamp(1.5rem,7vw,3.25rem)] leading-none tracking-[-0.02em] text-white uppercase">
      {children}
    </h1>
  );
}

export default function Login() {
  const session = useSessionContext();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<LoginState>("email");
  const [error, setError] = useState("");
  const [legal, setLegal] = useState<LegalConfig | null>(null);

  // Must run before the redirect below — hooks cannot sit after an early return.
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const res = await fetchLegalConfig(controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setLegal(res.data);
      }
      // Deliberately silent: an operator that has published no policies should
      // not greet every visitor with an error toast on the sign-in screen.
    }
    load();
    return () => controller.abort();
  }, []);

  // Redirect if already logged in
  if (!session.loading && session.doesSessionExist) {
    return <Navigate to="/app" replace />;
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError("");

    // Check if email exists with different auth method
    const checkRes = await checkEmailAuthMethod(email);
    if (checkRes.status === 200 && checkRes.data?.exists) {
      if (checkRes.data.auth_method === "google") {
        setState("error");
        setError(
          "This email is registered with Google. Please use the Google sign-in option instead.",
        );
        return;
      }
    }

    try {
      const response = await createCode({ email });

      if (response.status === "OK") {
        setState("sent");
      } else {
        setState("error");
        setError("Failed to send magic link. Please try again.");
      }
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  // No pre-check against the typed email: it need not match the Google account
  // the user picks. The backend rejects a mismatch using Google's own email.
  const handleGoogleLogin = async () => {
    try {
      await redirectToThirdPartyLogin({ thirdPartyId: "google" });
    } catch (err) {
      setState("error");
      setError(
        err instanceof Error ? err.message : "Failed to initiate Google login",
      );
    }
  };

  const handleReset = () => {
    setState("email");
    setError("");
  };

  // Email sent confirmation screen
  if (state === "sent") {
    return (
      <ZeroDayShell>
        <Mail aria-hidden className="size-6 text-[#dbc4ff]" />
        <div className="mt-6">
          <Eyebrow>Link dispatched</Eyebrow>
          <Heading>Check your inbox</Heading>
          <p className="mt-4 text-[15px] leading-[1.7] text-[#8b93a1]">
            We sent a secure sign-in link to{" "}
            <span className="font-medium break-all text-white">{email}</span>.
            Open it within 15 minutes to enter the hacker portal.
          </p>
        </div>

        <Button
          type="button"
          className={`${BUTTON} mt-8 bg-white/10 text-white hover:bg-white/20`}
          style={{ clipPath: NOTCH }}
          onClick={handleReset}
        >
          Use a different email
        </Button>
      </ZeroDayShell>
    );
  }

  // Email input form
  return (
    <ZeroDayShell>
      <Eyebrow>Hacker access</Eyebrow>
      <Heading>
        Enter Zero <span className="text-[#7828ff]">Day</span>
      </Heading>
      <p className="mt-4 text-[15px] leading-[1.7] text-[#8b93a1]">
        Sign in or create your hacker account with a secure magic link.
      </p>

      {state === "error" && error && (
        <p
          role="alert"
          className="mt-6 border-l-2 border-[#ff6467] bg-[#ff6467]/10 px-4 py-3 text-[13px] leading-[1.6] text-[#ffc7c8]"
        >
          {error}
        </p>
      )}

      <form onSubmit={handleEmailSubmit} className="mt-8">
        <label
          htmlFor="email"
          className="block text-[11px] tracking-[0.12em] text-[#8b93a1] uppercase"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={state === "sending"}
          className="mt-2 block h-14 w-full border-b border-white/15 bg-transparent text-[16px] text-white caret-[#dbc4ff] transition-colors placeholder:text-[#5a6270] hover:border-white/30 focus:border-[#7828ff] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          type="submit"
          className={`${BUTTON} group mt-6 bg-[#7828ff] text-[#f2f2f2] hover:bg-[#7828ff]/90`}
          style={{ clipPath: NOTCH }}
          disabled={!email}
          loading={state === "sending"}
        >
          {state === "sending" ? "Sending magic link..." : "Send magic link"}
          {state !== "sending" && (
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          )}
        </Button>
      </form>

      {/* TODO: UI preview. The Google option is always shown for now. Before
          shipping, restore the `isGoogleAuthEnabled` gate from
          "@/shared/auth" (set by VITE_GOOGLE_AUTH_ENABLED=true in
          client/portal/.env), or the button errors on click wherever Google
          sign-in is not configured. */}
      <div className="my-5 flex items-center gap-4 text-[11px] tracking-[0.12em] text-[#5a6270] uppercase">
        <span className="h-px flex-1 bg-white/10" />
        alternate route
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <Button
        type="button"
        className={`${BUTTON} bg-white/10 text-white hover:bg-white/20`}
        style={{ clipPath: NOTCH }}
        onClick={handleGoogleLogin}
      >
        <img src={googleIcon} alt="" className="size-4" />
        Continue with Google
      </Button>

      {/* TODO: UI preview. The legal line is always shown for now, with dead
          links until the Terms and Privacy Policy URLs are saved in the super
          admin settings. Before shipping, restore the gate that hides it (and
          each link) when no URL is configured. */}
      <p className="mt-8 text-[12px] leading-[1.6] text-[#5a6270]">
        By continuing, you agree to our{" "}
        <a
          href={legal?.terms_url || "#"}
          target="_blank"
          rel="noreferrer"
          className={LEGAL_LINK}
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          href={legal?.privacy_policy_url || "#"}
          target="_blank"
          rel="noreferrer"
          className={LEGAL_LINK}
        >
          Privacy Policy
        </a>
        .
      </p>
    </ZeroDayShell>
  );
}
