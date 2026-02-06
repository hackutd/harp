import { createBrowserRouter, Navigate } from "react-router-dom";

import { AdminLayout } from "@/layouts";
import {
  AllApplicantsPage,
  AssignedPage,
  CompletedPage,
  GroupsPage,
  HackerPackPage,
  ScansPage,
} from "@/pages/admin";
import {
  ApplyPage,
  DashboardPage,
  StatusPage,
} from "@/pages/hacker";
import {
  AuthCallbackPage,
  AuthOAuthCallbackPage,
  AuthVerifyPage,
  LoginPage,
} from "@/pages/public";
import { DashboardPage as SuperAdminDashboardPage } from "@/pages/superadmin";
import {
  RequireAdmin,
  RequireAuth,
  RequireSuperAdmin,
} from "@/shared/auth";

export const router = createBrowserRouter([
  // Public routes
  {
    path: "/",
    element: <LoginPage />,
  },
  {
    path: "/auth/callback",
    element: <AuthCallbackPage />,
  },
  {
    path: "/auth/verify",
    element: <AuthVerifyPage />,
  },
  {
    path: "/auth/callback/google",
    element: <AuthOAuthCallbackPage />,
  },

  // Hacker routes
  {
    path: "/app",
    element: (
      <RequireAuth>
        <DashboardPage />
      </RequireAuth>
    ),
  },
  {
    path: "/app/apply",
    element: (
      <RequireAuth>
        <ApplyPage />
      </RequireAuth>
    ),
  },
  {
    path: "/app/status",
    element: (
      <RequireAuth>
        <StatusPage />
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
        element: <Navigate to="/admin/all-applicants" replace />,
      },
      {
        path: "all-applicants",
        element: <AllApplicantsPage />,
      },
      {
        path: "scans",
        element: <ScansPage />,
      },
      {
        path: "assigned",
        element: <AssignedPage />,
      },
      {
        path: "completed",
        element: <CompletedPage />,
      },
      {
        path: "groups",
        element: <GroupsPage />,
      },
      {
        path: "hacker-pack",
        element: <HackerPackPage />,
      },
    ],
  },

  // Super Admin routes
  {
    path: "/superadmin",
    element: (
      <RequireSuperAdmin>
        <SuperAdminDashboardPage />
      </RequireSuperAdmin>
    ),
  },
]);
