import {
  ClipboardList,
  Loader2,
  Minus,
  Plus,
  Shuffle,
  ToggleRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { AssignedState } from "@/pages/admin/assigned/hooks/updateReviewPage";
import { refreshAssignedPage } from "@/pages/admin/assigned/hooks/updateReviewPage";
import { errorAlert, getRequest, postRequest } from "@/shared/lib/api";

export default function ReviewsPage() {
  const [reviewsPerApp, setReviewsPerApp] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingCount, setSavingCount] = useState(false);

  const [assigning, setAssigning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewAssignmentEnabled, setReviewAssignmentEnabled] = useState(true);
  const [togglingAssignment, setTogglingAssignment] = useState(false);

  const triggerAssignedPageRefresh = refreshAssignedPage(
    (state: AssignedState) => state.triggerRefresh,
  );

  useEffect(() => {
    async function fetchData() {
      const [reviewsRes, toggleRes] = await Promise.all([
        getRequest<{ reviews_per_application: number }>(
          "/superadmin/settings/reviews-per-app",
          "reviews per application",
        ),
        getRequest<{ enabled: boolean }>(
          "/superadmin/settings/review-assignment-toggle",
          "fetch review assignment enabled",
        ),
      ]);

      if (reviewsRes.status === 200 && reviewsRes.data) {
        setReviewsPerApp(reviewsRes.data.reviews_per_application);
      }
      if (toggleRes.status === 200 && toggleRes.data !== undefined) {
        setReviewAssignmentEnabled(toggleRes.data.enabled);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  async function updateReviewsPerApp(newValue: number) {
    const clamped = Math.max(1, Math.min(10, newValue));
    setReviewsPerApp(clamped);
    setSavingCount(true);
    const res = await postRequest<{ reviews_per_application: number }>(
      "/superadmin/settings/reviews-per-app",
      { reviews_per_application: clamped },
      "reviews per application",
    );
    if (res.status === 200 && res.data) {
      setReviewsPerApp(res.data.reviews_per_application);
    } else {
      errorAlert(res);
    }
    setSavingCount(false);
  }

  async function handleBatchAssign() {
    setConfirmOpen(false);
    setAssigning(true);
    const res = await postRequest<{ reviews_created: number }>(
      "/superadmin/applications/assign",
      {},
      "batch assign reviews",
    );
    if (res.status === 200 && res.data) {
      toast.success(
        `Successfully created ${res.data.reviews_created} review assignments`,
      );
    } else {
      errorAlert(res);
    }
    triggerAssignedPageRefresh();
    setAssigning(false);
  }

  async function handleToggleAssignmentEnabled(enabled: boolean) {
    setTogglingAssignment(true);
    const res = await postRequest<{ enabled: boolean }>(
      "/superadmin/settings/review-assignment-toggle",
      { enabled },
      "review assignment toggle",
    );
    if (res.status === 200 && res.data !== undefined) {
      setReviewAssignmentEnabled(res.data.enabled);
      toast.warning(
        `Review assignment ${res.data.enabled ? "enabled. Please run Auto Assign Reviews to give yourself reviews." : "disabled. Please run Auto Assign Reviews to reroute any reviews stuck under you."}`,
        { duration: 5000 },
      );
    } else {
      errorAlert(res);
    }
    setTogglingAssignment(false);
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-2 h-8 w-16 rounded bg-muted" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure review settings and manage review assignments.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Reviews Per Application */}
        <Card className="@container/card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>Reviews Per Application</CardDescription>
              <ClipboardList className="size-5 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => updateReviewsPerApp(reviewsPerApp - 1)}
                disabled={reviewsPerApp <= 1 || savingCount}
                className="size-7 cursor-pointer"
              >
                <Minus className="size-3" />
              </Button>
              <CardTitle className="w-8 text-center text-xl font-semibold tabular-nums">
                {reviewsPerApp}
              </CardTitle>
              <Button
                variant="outline"
                size="icon"
                onClick={() => updateReviewsPerApp(reviewsPerApp + 1)}
                disabled={reviewsPerApp >= 10 || savingCount}
                className="size-7 cursor-pointer"
              >
                <Plus className="size-3" />
              </Button>
              {savingCount && (
                <Loader2 className="ml-1 size-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Reviews needed before a decision
            </p>
          </CardHeader>
        </Card>

        {/* Review Assignment Toggle */}
        <Card className="@container/card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>Assignment Toggle</CardDescription>
              <ToggleRight className="size-5 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold">
                {reviewAssignmentEnabled ? "On" : "Off"}
              </CardTitle>
              <Switch
                checked={reviewAssignmentEnabled}
                onCheckedChange={handleToggleAssignmentEnabled}
                disabled={togglingAssignment}
                className="cursor-pointer"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {reviewAssignmentEnabled
                ? "You are receiving assignments"
                : "You are skipped during assignment"}
            </p>
          </CardHeader>
        </Card>

        {/* Auto Assign Reviews */}
        <Card className="@container/card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>Auto Assign</CardDescription>
              <Shuffle className="size-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl font-semibold">Assign</CardTitle>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={assigning}
              className="w-full cursor-pointer bg-slate-700"
              size="sm"
            >
              {assigning ? (
                <>
                  <Loader2 className="mr-2 size-3 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  Assign Reviews
                  <Shuffle className="ml-1 size-3" />
                </>
              )}
            </Button>
          </CardHeader>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Batch Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              This will assign admin reviewers to all submitted applications
              that still need reviews. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchAssign}
              className="cursor-pointer bg-slate-700"
            >
              Yes, Assign Reviews
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
