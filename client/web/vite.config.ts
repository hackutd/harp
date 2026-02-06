import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        bypass: (req) => {
          // Frontend routes that React Router should handle
          const frontendRoutes = ['/auth/callback', '/auth/verify'];

          // Check if this is a frontend route (without OAuth query params)
          for (const route of frontendRoutes) {
            if (req.url?.startsWith(route)) {
              // If it has OAuth params (code, error), it's a backend callback - proxy it
              // Exception: /auth/callback/google with params should go to frontend
              const url = new URL(req.url, 'http://localhost');
              const hasOAuthParams = url.searchParams.has('code') || url.searchParams.has('error');

              // /auth/callback/google is always a frontend route (handles OAuth response)
              if (req.url.startsWith('/auth/callback/google')) {
                return req.url;
              }

              // Other /auth/callback and /auth/verify are frontend routes
              if (!hasOAuthParams) {
                return req.url;
              }
            }
          }
        },
      },
      '/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/components": path.resolve(__dirname, "./src/components"),
      "@/shared": path.resolve(__dirname, "./src/shared"),
      "@/layouts": path.resolve(__dirname, "./src/layouts"),
      "@/pages": path.resolve(__dirname, "./src/pages"),
    },
  },
});
