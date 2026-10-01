/**
 * Recovers from a page that outlived a deploy.
 *
 * Every route is lazy-loaded from a content-hashed chunk, so a tab or
 * home-screen PWA that was open before a deploy still holds the previous
 * build's chunk names. The first navigation after the deploy asks the server
 * for a file that no longer exists, the dynamic import rejects, and the router
 * would show the 500 page for what is really "you need the new build". A
 * reload picks up the current shell (served no-cache) and its live chunks.
 *
 * Vite dispatches `vite:preloadError` for that failure when the import goes
 * through its preload helper; imports that bypass it (router lazy loaders,
 * `import()` inside effects) surface as an unhandled rejection or a global
 * error instead, so those are watched too.
 *
 * One reload per short window: if the fresh build also fails to load, the
 * problem is not staleness and the error should surface instead of looping.
 */
const RELOAD_STAMP_KEY = "harp:stale-chunk-reload";
const RELOAD_COOLDOWN_MS = 10_000;

const CHUNK_LOAD_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
];

export function isChunkLoadError(message: string): boolean {
  return CHUNK_LOAD_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function errorMessage(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  return "";
}

/** Reloads unless a reload already happened within the cooldown window. */
export function reloadOnce(): boolean {
  const last = Number(sessionStorage.getItem(RELOAD_STAMP_KEY) ?? 0);
  if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;

  sessionStorage.setItem(RELOAD_STAMP_KEY, String(Date.now()));
  window.location.reload();
  return true;
}

export function installStaleChunkReload(): void {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    reloadOnce();
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (!isChunkLoadError(errorMessage(event.reason))) return;
    event.preventDefault();
    reloadOnce();
  });

  window.addEventListener("error", (event) => {
    const message = errorMessage(event.error) || event.message;
    if (!isChunkLoadError(message)) return;
    reloadOnce();
  });
}
