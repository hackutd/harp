import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { initSuperTokens } from "@/shared/auth";

import { Providers } from "./providers";
import { router } from "./routes";

// Initialize SuperTokens before rendering
initSuperTokens();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </React.StrictMode>,
);
