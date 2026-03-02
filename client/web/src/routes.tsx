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
import { RequireAdmin, RequireAuth, RequireSuperAdmin } from "@/shared/auth";

// Lazy-loaded pages
const AdminLayout = lazy(() => import("@/layouts/AdminLayout"));
const AllApplicantsPage = lazy(
  () => import("@/pages/admin/all-applicants/AllApplicantsPage"),
);
const AssignedPage = lazy(() => import("@/pages/admin/assigned/AssignedPage"));
const CompletedPage = lazy(
  () => import("@/pages/admin/completed/CompletedPage"),
);
const FAQsPage = lazy(() => import("@/pages/admin/faqs/FAQsPage"));
const SchedulePage = lazy(() => import("@/pages/admin/schedule/SchedulePage"));
const ScansPage = lazy(() => import("@/pages/admin/scans/ScansPage"));
const DashboardPage = lazy(
  () => import("@/pages/hacker/dashboard/DashboardPage"),
);
const ApplyPage = lazy(() => import("@/pages/hacker/apply/ApplyPage"));
const StatusPage = lazy(() => import("@/pages/hacker/status/StatusPage"));
const SuperAdminUserManagementPage = lazy(
  () => import("@/pages/superadmin/user-management/UserManagementPage"),
);
const SuperAdminApplicationPage = lazy(
  () => import("@/pages/superadmin/application/ApplicationPage"),
);
const SuperAdminReviewsPage = lazy(
  () => import("@/pages/superadmin/reviews/ReviewsPage"),
);
const SuperAdminScansPage = lazy(
  () => import("@/pages/superadmin/scans/ScansPage"),
);
const SuperAdminEmailsPage = lazy(
  () => import("@/pages/superadmin/emails/EmailsPage"),
);

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
        path: "faqs",
        element: (
          <Suspense fallback={<PageLoader />}>
            <FAQsPage />
          </Suspense>
        ),
      },
      {
        path: "schedule",
        element: (
          <Suspense fallback={<PageLoader />}>
            <SchedulePage />
          </Suspense>
        ),
      },
      // Super Admin routes (nested under admin layout, guarded individually)
      {
        path: "sa/user-management",
        element: (
          <RequireSuperAdmin>
            <Suspense fallback={<PageLoader />}>
              <SuperAdminUserManagementPage />
            </Suspense>
          </RequireSuperAdmin>
        ),
      },
      {
        path: "sa/application",
        element: (
          <RequireSuperAdmin>
            <Suspense fallback={<PageLoader />}>
              <SuperAdminApplicationPage />
            </Suspense>
          </RequireSuperAdmin>
        ),
      },
      {
        path: "sa/reviews",
        element: (
          <RequireSuperAdmin>
            <Suspense fallback={<PageLoader />}>
              <SuperAdminReviewsPage />
            </Suspense>
          </RequireSuperAdmin>
        ),
      },
      {
        path: "sa/scans",
        element: (
          <RequireSuperAdmin>
            <Suspense fallback={<PageLoader />}>
              <SuperAdminScansPage />
            </Suspense>
          </RequireSuperAdmin>
        ),
      },
      {
        path: "sa/emails",
        element: (
          <RequireSuperAdmin>
            <Suspense fallback={<PageLoader />}>
              <SuperAdminEmailsPage />
            </Suspense>
          </RequireSuperAdmin>
        ),
      },
    ],
  },
]);
