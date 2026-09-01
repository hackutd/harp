import { getRequest } from "@/shared/lib/api";

interface AppleWalletStatus {
  available: boolean;
}

export async function getAppleWalletStatus(signal?: AbortSignal) {
  return getRequest<AppleWalletStatus>(
    "/wallet/apple-pass/status",
    "Apple Wallet availability",
    signal,
  );
}

export const APPLE_WALLET_PASS_URL = "/v1/wallet/apple-pass";
