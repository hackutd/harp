import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { SuperTokensWrapper } from "supertokens-auth-react";
import { initSuperTokens } from "./lib/supertokens";
import { Toaster } from "./components/ui/sonner";
import "./index.css";

// init SuperTokens before rendering
initSuperTokens();

// Auth pages
import Login from "./pages/auth/Login";
import AuthCallback from "./pages/auth/AuthCallback";
import AuthVerify from "./pages/auth/AuthVerify";
import AuthOAuthCallback from "./pages/auth/AuthOAuthCallback";

// Protected route wrappers
import RequireAuth from "./components/guards/RequireAuth";
import RequireAdmin from "./components/guards/RequireAdmin";
import RequireSuperAdmin from "./components/guards/RequireSuperAdmin";

// Hacker pages
import Dashboard from "./pages/hacker/Dashboard";
import Apply from "./pages/hacker/Apply";
import Status from "./pages/hacker/Status";

// Admin pages
import AdminLayout from "./layouts/AdminLayout";
import ApplicationsList from "./pages/admin/applications/ApplicationsList";
import ApplicationDetail from "./pages/admin/applications/ApplicationDetail";
import Assigned from "./pages/admin/reviews/Assigned";
import Completed from "./pages/admin/reviews/Completed";
import Scans from "./pages/admin/scans/Scans";
import Groups from "./pages/admin/groups/Groups";
import HackerPack from "./pages/admin/hacker-pack/HackerPack";

// Super Admin pages
import SuperAdminDashboard from "./pages/superadmin/Dashboard";

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
        <Dashboard />
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

  // Admin routes with shared sidebar layout
  {
    path: "/admin",
    element: (
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/admin/applications" replace />,
      },
      {
        path: "applications",
        element: <ApplicationsList />,
      },
      {
        path: "applications/:id",
        element: <ApplicationDetail />,
      },
      {
        path: "scans",
        element: <Scans />,
      },
      {
        path: "assigned",
        element: <Assigned />,
      },
      {
        path: "completed",
        element: <Completed />,
      },
      {
        path: "groups",
        element: <Groups />,
      },
      {
        path: "hacker-pack",
        element: <HackerPack />,
      },
    ],
  },

  // Super Admin routes
  {
    path: "/superadmin",
    element: (
      <RequireSuperAdmin>
        <SuperAdminDashboard />
      </RequireSuperAdmin>
    ),
  },
]);

root.render(
  <React.StrictMode>
    <SuperTokensWrapper>
      <RouterProvider router={router} />
      <Toaster />
    </SuperTokensWrapper>
  </React.StrictMode>
);
