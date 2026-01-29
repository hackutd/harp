"use client"

import * as React from "react"
import { ClipboardCheck, HelpCircle, UserCog } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

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

  const handleCancel = () => {
    setOpen(false)
  }

  const handleSave = () => {
    // TODO: Implement save functionality
    setOpen(false)
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
          <div className="flex-1 flex flex-col bg-zinc-950">
            <ScrollArea className="flex-1">
              <div className="p-8">
                {activeTab === 'questions' && (
                  <div className="space-y-4">
                    <h3 className="text-lg text-zinc-100">Short Answer Questions</h3>
                    <p className="text-sm text-zinc-400">
                      Configure application short answer questions.
                    </p>
                    {/* Future implementation area */}
                  </div>
                )}
                {activeTab === 'set-admin' && (
                  <div className="space-y-4">
                    <h3 className="text-lg text-zinc-100">Set Admin</h3>
                    <p className="text-sm text-zinc-400">
                      Manage admin roles and permissions.
                    </p>
                    {/* Future implementation area */}
                  </div>
                )}
                {activeTab === 'reviews-per-app' && (
                  <div className="space-y-4">
                    <h3 className="text-lg text-zinc-100">Reviews Per Application</h3>
                    <p className="text-sm text-zinc-400">
                      Set the number of reviews required for each application.
                    </p>
                    {/* Future implementation area */}
                  </div>
                )}
              </div>
            </ScrollArea>

            <Separator className="bg-zinc-800" />
            <DialogFooter className="p-4 gap-3">
              <Button variant="ghost" onClick={handleCancel} className="text-zinc-400 cursor-pointer hover:text-zinc-100 hover:bg-zinc-800">
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-zinc-100 text-zinc-900 cursor-pointer hover:bg-zinc-200">
                Save
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
