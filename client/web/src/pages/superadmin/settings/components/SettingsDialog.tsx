"use client";

import { UserCog, UsersRound } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/shared/lib/utils";

import ApplicationsTab from "../tabs/ApplicationsTab";
import { SetAdminTab } from "../tabs/SetAdminTab";

type SettingsTab = "set-admin" | "applications";

const settingsTabs = [
  { id: "set-admin" as const, label: "Set Admin", icon: UserCog },
  { id: "applications" as const, label: "Applications", icon: UsersRound },
];

interface SettingsDialogProps {
  trigger: React.ReactNode;
}

export function SettingsDialog({ trigger }: SettingsDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] =
    React.useState<SettingsTab>("set-admin");

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-6xl max-h-[85vh] p-0 gap-0 bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="flex min-h-[400px] h-[70vh] max-h-[85vh] rounded-lg overflow-hidden">
          {/* Left sidebar navigation */}
          <div className="w-52 border-r border-zinc-800 bg-zinc-900 p-3 flex flex-col">
            <DialogHeader className="pb-6">
              <DialogTitle className="text-zinc-100 font-normal text-lg pt-3 pl-3">
                Settings
              </DialogTitle>
              <DialogDescription className="sr-only">
                Super Admin settings and configuration
              </DialogDescription>
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
                      : "text-zinc-400 hover:bg-zinc-800/50 font-light hover:text-zinc-100",
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
                {activeTab === "set-admin" && <SetAdminTab />}
                {activeTab === "applications" && <ApplicationsTab />}
              </div>
            </ScrollArea>

            <DialogFooter className="border-t border-zinc-800 p-4 gap-3">
              <Button
                variant="ghost"
                onClick={handleClose}
                className="text-zinc-400 cursor-pointer hover:text-zinc-100 hover:bg-zinc-800"
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
