import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

import { ErrorPage } from "@/components/ErrorPage";
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
const ReviewsPage = lazy(() => import("@/pages/admin/reviews/ReviewsPage"));
const SchedulePage = lazy(() => import("@/pages/admin/schedule/SchedulePage"));
const ScansPage = lazy(() => import("@/pages/admin/scans/ScansPage"));
const DashboardPage = lazy(
  () => import("@/pages/hacker/dashboard/DashboardPage"),
);
const ApplyPage = lazy(() => import("@/pages/hacker/apply/ApplyPage"));
const StatusPage = lazy(() => import("@/pages/hacker/status/StatusPage"));
const HackerLayout = lazy(() => import("@/layouts/HackerLayout"));
const HackerScanPage = lazy(() => import("@/pages/hacker/scan/ScanPage"));
const HackerSchedulePage = lazy(
  () => import("@/pages/hacker/schedule/SchedulePage"),
);
const HackerProfilePage = lazy(
  () => import("@/pages/hacker/profile/ProfilePage"),
);
const HackerNotificationsPage = lazy(
  () => import("@/pages/hacker/notifications/NotificationsPage"),
);
const SuperAdminUserManagementPage = lazy(
  () => import("@/pages/superadmin/user-management/UserManagementPage"),
);
const SuperAdminApplicationPage = lazy(
  () => import("@/pages/superadmin/application/ApplicationPage"),
);
const SuperAdminReviewsPage = lazy(
  () => import("@/pages/superadmin/reviews/ReviewsPage"),
);
const SuperAdminGradingPage = lazy(
  () => import("@/pages/superadmin/reviews/grading/GradingPage"),
);
const SuperAdminScansPage = lazy(
  () => import("@/pages/superadmin/scans/ScansPage"),
);
const SuperAdminNotificationsPage = lazy(
  () => import("@/pages/superadmin/notifications/NotificationsPage"),
);
const AdminGradingPage = lazy(
  () => import("@/pages/admin/reviews/grading/GradingPage"),
);
const SponsorsPage = lazy(() => import("@/pages/admin/sponsors/SponsorsPage"));

export const router = createBrowserRouter([
  {
    element: <Outlet />,
    errorElement: <ErrorPage />,
    children: [
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

      // Hacker routes with shared layout (bottom nav mobile / sidebar desktop)
      {
        path: "/app",
        element: (
          <RequireAuth>
            <Suspense fallback={<PageLoader />}>
              <HackerLayout />
            </Suspense>
          </RequireAuth>
        ),
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            ),
          },
          {
            path: "apply",
            element: (
              <Suspense fallback={<PageLoader />}>
                <ApplyPage />
              </Suspense>
            ),
          },
          {
            path: "status",
            element: (
              <Suspense fallback={<PageLoader />}>
                <StatusPage />
              </Suspense>
            ),
          },
          {
            path: "scan",
            element: (
              <Suspense fallback={<PageLoader />}>
                <HackerScanPage />
              </Suspense>
            ),
          },
          {
            path: "schedule",
            element: (
              <Suspense fallback={<PageLoader />}>
                <HackerSchedulePage />
              </Suspense>
            ),
          },
          {
            path: "profile",
            element: (
              <Suspense fallback={<PageLoader />}>
                <HackerProfilePage />
              </Suspense>
            ),
          },
          {
            path: "notifications",
            element: (
              <Suspense fallback={<PageLoader />}>
                <HackerNotificationsPage />
              </Suspense>
            ),
          },
        ],
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
            path: "reviews",
            element: (
              <Suspense fallback={<PageLoader />}>
                <ReviewsPage />
              </Suspense>
            ),
          },
          {
            path: "reviews/grade",
            element: (
              <Suspense fallback={<PageLoader />}>
                <AdminGradingPage />
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
          {
            path: "sponsors",
            element: (
              <Suspense fallback={<PageLoader />}>
                <SponsorsPage />
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
            path: "sa/reviews/grade",
            element: (
              <RequireSuperAdmin>
                <Suspense fallback={<PageLoader />}>
                  <SuperAdminGradingPage />
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
            path: "sa/notifications",
            element: (
              <RequireSuperAdmin>
                <Suspense fallback={<PageLoader />}>
                  <SuperAdminNotificationsPage />
                </Suspense>
              </RequireSuperAdmin>
            ),
          },
        ],
      },
      {
        path: "*",
        element: <ErrorPage />,
      },
    ],
  },
]);
