import path from "path";

// Shared by vite.config.ts and vitest.config.ts so tests resolve imports
// exactly like the app does.
export const aliases = {
  // Must precede "@": Vite matches aliases in order and "@" would
  // otherwise capture "@/branding/..." and send it into src/.
  "@/branding": path.resolve(__dirname, "./branding"),
  "@": path.resolve(__dirname, "./src"),
};
