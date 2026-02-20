import { Loader2, Minus, Plus, Shuffle } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { errorAlert, getRequest, postRequest } from "@/shared/lib/api"

interface ReviewsPerAppTabProps {
  reviewsPerApp: number
  setReviewsPerApp: (n: number) => void
  loading: boolean
}

export function ReviewsPerAppTab({ reviewsPerApp, setReviewsPerApp, loading }: ReviewsPerAppTabProps) {
  const [assigning, setAssigning] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reviewAssignmentEnabled, setReviewAssignmentEnabled] = useState(true)
  const [togglingAssignment, setTogglingAssignment] = useState(false)

  useEffect(() => {
    async function fetchReviewAssignmentEnabled() {
      const res = await getRequest<{ enabled: boolean }>(
        "/superadmin/settings/review-assignment-enabled",
        "fetch review assignment enabled"
      )
      if (res.status === 200 && res.data !== undefined) {
        setReviewAssignmentEnabled(res.data.enabled)
      }
    }
    fetchReviewAssignmentEnabled()
  }, [])

  async function handleBatchAssign() {
    setConfirmOpen(false)
    setAssigning(true)
    const res = await postRequest<{ reviews_created: number }>(
      "/superadmin/applications/assign",
      {},
      "batch assign reviews"
    )
    if (res.status === 200 && res.data) {
      toast.success(`Successfully created ${res.data.reviews_created} review assignments`)
    } else {
      errorAlert(res)
    }
    setAssigning(false)
  }

  async function handleToggleAssignmentEnabled(enabled: boolean) {
    setTogglingAssignment(true)
    const res = await postRequest<{ enabled: boolean }>(
      "/superadmin/settings/review-assignment-enabled",
      { enabled },
      "review assignment toggle"
    )
    if (res.status === 200 && res.data !== undefined) {
      setReviewAssignmentEnabled(res.data.enabled)
      toast.success(`Review assignment ${res.data.enabled ? "enabled" : "disabled"}`)
    } else {
      errorAlert(res)
    }
    setTogglingAssignment(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900 border-zinc-800 border-0 rounded-md">
        <CardHeader>
          <CardTitle className="font-normal text-zinc-100">Reviews Per Application</CardTitle>
          <CardDescription className="text-zinc-400">
            How many admin reviews each application needs before a decision can be made. Changes only affect future assignments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setReviewsPerApp(Math.max(1, reviewsPerApp - 1))}
              disabled={reviewsPerApp <= 1}
              className="size-7 cursor-pointer bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 border-0"
            >
              <Minus className="size-3" />
            </Button>
            <span className="w-8 text-center text-md font-light text-zinc-100">{reviewsPerApp}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setReviewsPerApp(Math.min(10, reviewsPerApp + 1))}
              disabled={reviewsPerApp >= 10}
              className="size-7 cursor-pointer bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 border-0"
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator className="bg-zinc-800" />

      <Card className="bg-zinc-900 border-zinc-800 border-0 rounded-md">
        <CardHeader>
          <CardTitle className="font-normal text-zinc-100">Enable Review Assignment</CardTitle>
          <CardDescription className="text-zinc-400">
            Allow super admins to enable/disable themselves from vote reviews.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">
              {reviewAssignmentEnabled ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={reviewAssignmentEnabled}
              onCheckedChange={handleToggleAssignmentEnabled}
              disabled={togglingAssignment}
              className="data-[state=checked]:bg-zinc-100"
            />
          </div>
        </CardContent>
      </Card>

      <Separator className="bg-zinc-800" />
      <Card className="bg-zinc-900 border-zinc-800 border-0 rounded-md">
        <CardHeader>
          <CardTitle className="font-normal text-zinc-100">Auto Assign Reviews</CardTitle>
          <CardDescription className="text-zinc-400">
            Auto-assigns admins to submitted applications using workload balancing. Safe to run multiple times.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={assigning}
            className="bg-zinc-100 text-zinc-900 cursor-pointer hover:bg-zinc-200"
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
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Confirm Batch Assignment</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will assign admin reviewers to all submitted applications that still need reviews.
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-900 cursor-pointer border-0 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-300">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchAssign}
              className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200 cursor-pointer"
            >
              Yes, Assign Reviews
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}