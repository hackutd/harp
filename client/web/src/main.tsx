import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { SuperTokensWrapper } from "supertokens-auth-react";
import { initSuperTokens } from "./lib/supertokens";
import "./index.css";

// init SuperTokens before rendering
initSuperTokens();

// Public pages
import Login from "./pages/public/Login";
import AuthCallback from "./pages/public/AuthCallback";
import AuthVerify from "./pages/public/AuthVerify";
import AuthOAuthCallback from "./pages/public/AuthOAuthCallback";

// Protected route wrappers
import RequireAuth from "./components/guards/RequireAuth";
import RequireAdmin from "./components/guards/RequireAdmin";
import RequireSuperAdmin from "./components/guards/RequireSuperAdmin";

// Hacker pages
import App from "./pages/app/App";
import Apply from "./pages/app/Apply";
import Status from "./pages/app/Status";

// Admin pages
import Applications from "./pages/admin/Applications";
import ApplicationDetail from "./pages/admin/ApplicationDetail";
import Settings from "./pages/admin/Settings";
import Scans from "./pages/admin/Scans";
import SuperAdmin from "./pages/superadmin/SuperAdmin";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

const router = createBrowserRouter([
  // Public routes
  {
    path: "/",
    element: <Login />,
  },
  {
    path: "/auth/callback",
    element: <AuthCallback />,
  },
  {
    path: "/auth/verify",
    element: <AuthVerify />,
  },
  {
    path: "/auth/callback/google",
    element: <AuthOAuthCallback />,
  },

  // Hacker routes
  {
    path: "/app",
    element: (
      <RequireAuth>
        <App />
      </RequireAuth>
    ),
  },
  {
    path: "/app/apply",
    element: (
      <RequireAuth>
        <Apply />
      </RequireAuth>
    ),
  },
  {
    path: "/app/status",
    element: (
      <RequireAuth>
        <Status />
      </RequireAuth>
    ),
  },

  // Admin routes
  {
    path: "/admin/applications",
    element: (
      <RequireAdmin>
        <Applications />
      </RequireAdmin>
    ),
  },
  {
    path: "/admin/applications/:id",
    element: (
      <RequireAdmin>
        <ApplicationDetail />
      </RequireAdmin>
    ),
  },
  {
    path: "/admin/settings",
    element: (
      <RequireAdmin>
        <Settings />
      </RequireAdmin>
    ),
  },
  {
    path: "/admin/scans",
    element: (
      <RequireAdmin>
        <Scans />
      </RequireAdmin>
    ),
  },

  // Super Admin routes
  {
    path: "/superadmin",
    element: (
      <RequireSuperAdmin>
        <SuperAdmin />
      </RequireSuperAdmin>
    ),
  },
]);

root.render(
  <React.StrictMode>
    <SuperTokensWrapper>
      <RouterProvider router={router} />
    </SuperTokensWrapper>
  </React.StrictMode>
);


