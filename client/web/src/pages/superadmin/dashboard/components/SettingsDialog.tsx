"use client"

import { ClipboardCheck, HelpCircle, Loader2, UserCog } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { errorAlert,getRequest, postRequest, putRequest } from "@/shared/lib/api"
import { cn } from "@/shared/lib/utils"
import type { ShortAnswerQuestion } from "@/types"

import { QuestionsTab } from "../tabs/QuestionsTab"
import { ReviewsPerAppTab } from "../tabs/ReviewsPerAppTab"
import { SetAdminTab } from "../tabs/SetAdminTab"

type SettingsTab = 'questions' | 'set-admin' | 'reviews-per-app'

const settingsTabs = [
  { id: 'questions' as const, label: 'Questions', icon: HelpCircle },
  { id: 'set-admin' as const, label: 'Set Admin', icon: UserCog },
  { id: 'reviews-per-app' as const, label: 'Reviews', icon: ClipboardCheck },
]

interface SettingsDialogProps {
  trigger: React.ReactNode
}

export function SettingsDialog({ trigger }: SettingsDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('questions')

  const [questions, setQuestions] = React.useState<ShortAnswerQuestion[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const [reviewsPerApp, setReviewsPerApp] = React.useState(1)
  const [reviewsPerAppLoading, setReviewsPerAppLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const fetchQuestions = async () => {
      setLoading(true)
      const res = await getRequest<{ questions: ShortAnswerQuestion[] }>(
        "/superadmin/settings/saquestions",
        "short answer questions"
      )
      if (res.status === 200 && res.data) {
        setQuestions(res.data.questions ?? [])
      } else {
        errorAlert(res)
      }
      setLoading(false)
    }
    const fetchReviewsPerApp = async () => {
      setReviewsPerAppLoading(true)
      const res = await getRequest<{ reviews_per_application: number }>(
        "/superadmin/settings/reviews-per-app",
        "reviews per application"
      )
      if (res.status === 200 && res.data) {
        setReviewsPerApp(res.data.reviews_per_application)
      } else {
        errorAlert(res)
      }
      setReviewsPerAppLoading(false)
    }
    fetchQuestions()
    fetchReviewsPerApp()
  }, [open])

  const handleCancel = () => {
    setOpen(false)
  }

  const handleSave = async () => {
    if (activeTab === 'questions') {
      // Validate that all questions have text
      const emptyQuestion = questions.find(q => !q.question.trim())
      if (emptyQuestion) {
        toast.error("All questions must have text")
        return
      }

      setSaving(true)
      const payload = questions.map((q, i) => ({
        ...q,
        display_order: i + 1,
      }))
      const res = await putRequest<{ questions: ShortAnswerQuestion[] }>(
        "/superadmin/settings/saquestions",
        { questions: payload },
        "short answer questions"
      )
      if (res.status === 200 && res.data) {
        setQuestions(res.data.questions)
        toast.success("Questions saved")
      } else {
        errorAlert(res)
      }
      setSaving(false)
    } else if (activeTab === 'reviews-per-app') {
      if (reviewsPerApp < 1 || reviewsPerApp > 10) {
        toast.error("Reviews per application must be between 1 and 10")
        return
      }

      setSaving(true)
      const res = await postRequest<{ reviews_per_application: number }>(
        "/superadmin/settings/reviews-per-app",
        { reviews_per_application: reviewsPerApp },
        "reviews per application"
      )
      if (res.status === 200 && res.data) {
        setReviewsPerApp(res.data.reviews_per_application)
        toast.success("Reviews per application saved")
      } else {
        errorAlert(res)
      }
      setSaving(false)
    } else {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-6xl max-h-[85vh] p-0 gap-0 bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="flex min-h-[400px] h-[70vh] max-h-[85vh] rounded-lg overflow-hidden">
          {/* Left sidebar navigation */}
          <div className="w-52 border-r border-zinc-800 bg-zinc-900 p-3 flex flex-col">
            <DialogHeader className="pb-6">
              <DialogTitle className="text-zinc-100 font-normal text-lg pt-3 pl-3">Settings</DialogTitle>
              <DialogDescription className="sr-only">Super Admin settings and configuration</DialogDescription>
            </DialogHeader>
            <nav className="flex flex-col gap-1">
              {settingsTabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant="ghost"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "justify-start gap-2 h-auto py-2 cursor-pointer text-sm",
                    activeTab === tab.id
                      ? "bg-zinc-800 text-zinc-100 hover:bg-zinc-800 font-normal hover:text-zinc-100 cursor-default"
                      : "text-zinc-400 hover:bg-zinc-800/50 font-light hover:text-zinc-100"
                  )}
                >
                  <tab.icon className="size-4" />
                  {tab.label}
                </Button>
              ))}
            </nav>
          </div>

          {/* Right content area */}
          <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-8">
                {activeTab === 'questions' && (
                  <QuestionsTab questions={questions} setQuestions={setQuestions} loading={loading} />
                )}
                {activeTab === 'set-admin' && <SetAdminTab />}
                {activeTab === 'reviews-per-app' && (
                  <ReviewsPerAppTab
                    reviewsPerApp={reviewsPerApp}
                    setReviewsPerApp={setReviewsPerApp}
                    loading={reviewsPerAppLoading}
                  />
                )}
              </div>
            </ScrollArea>

            <Separator className="bg-zinc-800" />
            <DialogFooter className="p-4 gap-3">
              <Button variant="ghost" onClick={handleCancel} className="text-zinc-400 cursor-pointer hover:text-zinc-100 hover:bg-zinc-800">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-zinc-100 text-zinc-900 cursor-pointer hover:bg-zinc-300 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
