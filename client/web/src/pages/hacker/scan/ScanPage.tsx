import { WalletCards } from "lucide-react";
import { type MouseEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import Session from "supertokens-auth-react/recipe/session";

import { useUserStore } from "@/shared/stores";

import { HackerQR } from "../components/HackerQR";
import { APPLE_WALLET_PASS_URL, getAppleWalletStatus } from "./api";

function isIOS(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /iPhone|iPod/.test(navigator.userAgent);
}

export default function ScanPage() {
  const { user } = useUserStore();
  const [walletAvailableForUser, setWalletAvailableForUser] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!user?.id || !isIOS()) return;

    const controller = new AbortController();
    void getAppleWalletStatus(controller.signal).then((response) => {
      if (response.status === 200 && response.data?.available) {
        setWalletAvailableForUser(user.id);
      }
    });

    return () => controller.abort();
  }, [user?.id]);

  // Anchor navigations bypass the SuperTokens fetch interceptor, so an
  // expired access token would return a JSON error instead of a pass.
  // Refresh the session first, then navigate.
  const handleAddToWallet = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    try {
      if (await Session.attemptRefreshingSession()) {
        window.location.assign(APPLE_WALLET_PASS_URL);
      } else {
        toast.error("Your session has expired. Please sign in again.");
      }
    } catch {
      toast.error("Couldn't add the pass to Apple Wallet. Please try again.");
    }
  };

  return (
    <div className="mx-auto flex min-h-[70svh] max-w-2xl flex-col items-center justify-center px-5 md:px-10">
      <h1 className="text-2xl font-light tracking-tight text-black">QR Code</h1>
      <p className="mt-1 text-center text-sm font-light text-[#8A8A8A]">
        Show this at check-in, meals, and events
      </p>

      {user?.id ? (
        <div className="mt-8 rounded-xl border border-[#E5E5E5] p-4 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
          <HackerQR value={user.id} size={240} />
        </div>
      ) : (
        <p className="mt-8 text-sm font-light text-[#8A8A8A]">
          Sign in to view your code.
        </p>
      )}

      {user?.email && (
        <p className="mt-6 text-xs font-light text-[#8A8A8A]">{user.email}</p>
      )}

      {walletAvailableForUser === user?.id && (
        <a
          href={APPLE_WALLET_PASS_URL}
          onClick={handleAddToWallet}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-black px-5 text-sm font-medium text-white transition-colors active:bg-black/80"
          aria-label="Add this hacker pass to Apple Wallet"
        >
          <WalletCards className="size-5" aria-hidden="true" />
          Add to Apple Wallet
        </a>
      )}
    </div>
  );
}
