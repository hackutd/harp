/**
 * Brand identity — this file is yours to change.
 *
 * Upstream Harp ships neutral defaults here and will not edit this file
 * again, so a fork can rebrand the portal without conflicting on a merge.
 *
 * Keep this module free of DOM types and imports. It is consumed by three
 * separate TypeScript projects — the app (DOM lib), the service worker
 * (WebWorker lib), and vite.config.ts (node, no DOM) — so anything
 * browser-specific here breaks the build in one of them.
 *
 * Event-level values (hackathon name, dates, contact address, application
 * questions) do NOT belong here. Those are database settings a super admin
 * edits from the portal at runtime, and hardcoding them would mean a
 * redeploy every time the event is renamed.
 */
export const branding = {
  /**
   * Product name for the portal itself. Appears in the browser tab, install
   * prompts, and as the fallback title on a push notification that arrives
   * without one.
   */
  appName: "Zero Day Harp",

  /** Full name in the PWA manifest — shown on the install prompt. */
  fullName: "Zero Day Harp",

  /**
   * Home-screen label once installed. Kept short deliberately: most launchers
   * truncate past roughly 12 characters.
   */
  shortName: "Zero Day Harp",

  /** PWA manifest description, shown in some install UIs and app listings. */
  description:
    "The official hacker portal for HackUTD 2026 Zero Day—applications, event access, schedules, and updates.",

  /**
   * Application name registered with SuperTokens. Appears in the subject and
   * body of magic-link sign-in emails, so it should read as something a
   * hacker recognises.
   */
  authAppName: "Zero Day Harp",

  /**
   * Browser UI colour — Android's status bar and the PWA splash screen.
   * Applied to both index.html's meta tag and the manifest from this one
   * value, so the two cannot drift apart.
   *
   * Must be a plain hex/rgb colour, not an oklch() token: this is consumed by
   * the browser chrome rather than CSS, and support for modern colour
   * functions here is inconsistent.
   */
  themeColor: "#020307",

  /** Splash-screen background while the installed app starts up. */
  backgroundColor: "#020307",
} as const;
