import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { PageLoader } from "@/components/PageLoader";
// Auth pages stay eager (critical path)
import {
  AuthCallbackPage,
  AuthOAuthCallbackPage,
  AuthVerifyPage,
  LoginPage,
} from "@/pages/public";
import {
  RequireAdmin,
  RequireAuth,
  RequireSuperAdmin,
} from "@/shared/auth";

// Lazy-loaded pages
const AdminLayout = lazy(() => import("@/layouts/AdminLayout"));
const AllApplicantsPage = lazy(() => import("@/pages/admin/all-applicants/AllApplicantsPage"));
const AssignedPage = lazy(() => import("@/pages/admin/assigned/AssignedPage"));
const CompletedPage = lazy(() => import("@/pages/admin/completed/CompletedPage"));
const GroupsPage = lazy(() => import("@/pages/admin/groups/GroupsPage"));
const HackerPackPage = lazy(() => import("@/pages/admin/hacker-pack/HackerPackPage"));
const ScansPage = lazy(() => import("@/pages/admin/scans/ScansPage"));
const DashboardPage = lazy(() => import("@/pages/hacker/dashboard/DashboardPage"));
const ApplyPage = lazy(() => import("@/pages/hacker/apply/ApplyPage"));
const StatusPage = lazy(() => import("@/pages/hacker/status/StatusPage"));
const SuperAdminDashboardPage = lazy(() => import("@/pages/superadmin/dashboard/DashboardPage"));

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
        <Suspense fallback={<PageLoader />}>
          <DashboardPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: "/app/apply",
    element: (
      <RequireAuth>
        <Suspense fallback={<PageLoader />}>
          <ApplyPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: "/app/status",
    element: (
      <RequireAuth>
        <Suspense fallback={<PageLoader />}>
          <StatusPage />
        </Suspense>
      </RequireAuth>
    ),
  },

  // Admin routes with shared sidebar layout
  {
    path: "/admin",
    element: (
      <RequireAdmin>
        <Suspense fallback={<PageLoader />}>
          <AdminLayout />
        </Suspense>
      </RequireAdmin>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/admin/all-applicants" replace />,
      },
      {
        path: "all-applicants",
        element: (
          <Suspense fallback={<PageLoader />}>
            <AllApplicantsPage />
          </Suspense>
        ),
      },
      {
        path: "scans",
        element: (
          <Suspense fallback={<PageLoader />}>
            <ScansPage />
          </Suspense>
        ),
      },
      {
        path: "assigned",
        element: (
          <Suspense fallback={<PageLoader />}>
            <AssignedPage />
          </Suspense>
        ),
      },
      {
        path: "completed",
        element: (
          <Suspense fallback={<PageLoader />}>
            <CompletedPage />
          </Suspense>
        ),
      },
      {
        path: "groups",
        element: (
          <Suspense fallback={<PageLoader />}>
            <GroupsPage />
          </Suspense>
        ),
      },
      {
        path: "hacker-pack",
        element: (
          <Suspense fallback={<PageLoader />}>
            <HackerPackPage />
          </Suspense>
        ),
      },
    ],
  },

  // Super Admin routes
  {
    path: "/superadmin",
    element: (
      <RequireSuperAdmin>
        <Suspense fallback={<PageLoader />}>
          <SuperAdminDashboardPage />
        </Suspense>
      </RequireSuperAdmin>
    ),
  },
]);
