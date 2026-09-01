import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

// Pin the test timezone so local-time assertions are deterministic regardless
// of the host (CI runners default to UTC). The npm scripts also set
// TZ=America/Chicago via cross-env; this config-level pin guards against any
// invocation that bypasses them (e.g. bare `npx vitest run` in CI).
process.env.TZ = "America/Chicago";

// Test-only Vite config. Kept separate from vite.config.ts so the PWA plugin
// and dev-server proxy never load during unit tests.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/components": path.resolve(__dirname, "./src/components"),
      "@/shared": path.resolve(__dirname, "./src/shared"),
      "@/layouts": path.resolve(__dirname, "./src/layouts"),
      "@/pages": path.resolve(__dirname, "./src/pages"),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // No coverage thresholds during the initial rollout (per testing spec).
  },
});
