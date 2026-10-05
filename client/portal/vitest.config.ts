import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { aliases } from "./vite.aliases";

// Pin the test timezone so local-time assertions are deterministic regardless
// of the host (CI runners default to UTC). Set here rather than in the npm
// scripts so every invocation — `npm test`, bare `npx vitest`, an editor
// plugin — gets the same zone.
process.env.TZ = "America/Chicago";

// Test-only Vite config. Kept separate from vite.config.ts so the PWA plugin
// and dev-server proxy never load during unit tests.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: aliases },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Every test starts from fresh mocks and real globals, so no test can pass
    // on an implementation or stub another test left behind.
    mockReset: true,
    unstubGlobals: true,
  },
});
