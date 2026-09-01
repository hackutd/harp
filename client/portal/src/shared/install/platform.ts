// Platform detection for the "add to home screen" onboarding step. iOS Safari
// never fires beforeinstallprompt, so it needs its own manual-instructions path.

export type InstallPlatform = "ios" | "android" | "desktop";

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

export function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;

  // iPadOS 13+ reports as "Macintosh" but exposes touch support, unlike a
  // real Mac.
  const isIPadOS =
    /Macintosh/.test(ua) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || isIPadOS) return "ios";

  if (/Android/.test(ua)) return "android";

  return "desktop";
}
