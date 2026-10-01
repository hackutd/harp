import "./index.css";

import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router/dom";

import { initSuperTokens } from "@/shared/auth";
import { installStaleChunkReload } from "@/shared/lib/stale-chunk-reload";

import { Providers } from "./providers";
import { router } from "./routes";

installStaleChunkReload();

// Initialize SuperTokens before rendering
initSuperTokens();

ReactDOM.createRoot(document.getElementById("root")!).render(
  // <React.StrictMode>
  <Providers>
    <RouterProvider router={router} />
  </Providers>,
  /* </React.StrictMode>, */
);
