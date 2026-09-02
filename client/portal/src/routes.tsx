import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router";

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
const ApplicationDetailPage = lazy(
  () => import("@/pages/hacker/application/ApplicationDetailPage"),
);
const HackerRSVPPage = lazy(() => import("@/pages/hacker/rsvp/RSVPPage"));
const HackerTravelRSVPPage = lazy(
  () => import("@/pages/hacker/travel-rsvp/TravelRSVPPage"),
);
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
const HackerFAQPage = lazy(() => import("@/pages/hacker/faq/FAQPage"));
const HackerPackPage = lazy(
  () => import("@/pages/hacker/hacker-pack/HackerPackPage"),
);
const SuperAdminUserManagementPage = lazy(
  () => import("@/pages/superadmin/user-management/UserManagementPage"),
);
const SuperAdminFormsPage = lazy(
  () => import("@/pages/superadmin/forms/FormsPage"),
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
const SuperAdminHackerLinksPage = lazy(
  () => import("@/pages/superadmin/hacker-links/HackerLinksPage"),
);
const SuperAdminWalkInQueuePage = lazy(
  () => import("@/pages/superadmin/walk-in-queue/WalkInQueuePage"),
);
const AdminGradingPage = lazy(
  () => import("@/pages/admin/reviews/grading/GradingPage"),
);
const SponsorsPage = lazy(() => import("@/pages/admin/sponsors/SponsorsPage"));
const FAQAdminPage = lazy(() => import("@/pages/admin/faq/FAQPage"));

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
          // The standalone status page is gone — the dashboard shows the
          // status cards now. Redirect stale links/bookmarks.
          {
            path: "status",
            element: <Navigate to="/app" replace />,
          },
          {
            path: "status/application",
            element: <Navigate to="/app/application" replace />,
          },
          {
            path: "application",
            element: (
              <Suspense fallback={<PageLoader />}>
                <ApplicationDetailPage />
              </Suspense>
            ),
          },
          {
            path: "rsvp",
            element: (
              <Suspense fallback={<PageLoader />}>
                <HackerRSVPPage />
              </Suspense>
            ),
          },
          {
            path: "travel-rsvp",
            element: (
              <Suspense fallback={<PageLoader />}>
                <HackerTravelRSVPPage />
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
          {
            path: "faq",
            element: (
              <Suspense fallback={<PageLoader />}>
                <HackerFAQPage />
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
          {
            path: "faq",
            element: (
              <Suspense fallback={<PageLoader />}>
                <FAQAdminPage />
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
                <Navigate
                  to="/admin/sa/forms/application?tab=builder"
                  replace
                />
              </RequireSuperAdmin>
            ),
          },
          {
            path: "sa/rsvp",
            element: (
              <RequireSuperAdmin>
                <Navigate to="/admin/sa/forms/rsvp?tab=builder" replace />
              </RequireSuperAdmin>
            ),
          },
          {
            path: "sa/travel-rsvp",
            element: (
              <RequireSuperAdmin>
                <Navigate to="/admin/sa/forms/travel?tab=builder" replace />
              </RequireSuperAdmin>
            ),
          },
          {
            path: "sa/forms",
            element: (
              <RequireSuperAdmin>
                <Suspense fallback={<PageLoader />}>
                  <SuperAdminFormsPage />
                </Suspense>
              </RequireSuperAdmin>
            ),
          },
          {
            path: "sa/forms/:formKey",
            element: (
              <RequireSuperAdmin>
                <Suspense fallback={<PageLoader />}>
                  <SuperAdminFormsPage />
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
          {
            path: "sa/hacker-links",
            element: (
              <RequireSuperAdmin>
                <Suspense fallback={<PageLoader />}>
                  <SuperAdminHackerLinksPage />
                </Suspense>
              </RequireSuperAdmin>
            ),
          },
          {
            path: "sa/walk-in-queue",
            element: (
              <RequireSuperAdmin>
                <Suspense fallback={<PageLoader />}>
                  <SuperAdminWalkInQueuePage />
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
