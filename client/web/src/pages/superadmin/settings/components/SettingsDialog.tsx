"use client";

import { Loader2, ScanLine, UserCog, UsersRound } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

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
import { Separator } from "@/components/ui/separator";
import { errorAlert, getRequest, putRequest } from "@/shared/lib/api";
import { cn } from "@/shared/lib/utils";

import ApplicationsTab from "../tabs/ApplicationsTab";
import type { ScanType } from "../tabs/ScanTypesTab";
import { ScanTypesTab } from "../tabs/ScanTypesTab";
import { SetAdminTab } from "../tabs/SetAdminTab";

type SettingsTab = "set-admin" | "applications" | "scan-types";

const settingsTabs = [
  { id: "set-admin" as const, label: "Set Admin", icon: UserCog },
  { id: "applications" as const, label: "Applications", icon: UsersRound },
  { id: "scan-types" as const, label: "Scans", icon: ScanLine },
];

interface SettingsDialogProps {
  trigger: React.ReactNode;
}

export function SettingsDialog({ trigger }: SettingsDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] =
    React.useState<SettingsTab>("set-admin");

  const [saving, setSaving] = React.useState(false);

  const [scanTypes, setScanTypes] = React.useState<ScanType[]>([]);
  const [scanTypesLoading, setScanTypesLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const fetchScanTypes = async () => {
      setScanTypesLoading(true);
      const res = await getRequest<{ scan_types: ScanType[] }>(
        "/admin/scans/types",
        "scan types",
      );
      if (res.status === 200 && res.data) {
        setScanTypes(res.data.scan_types ?? []);
      } else {
        errorAlert(res);
      }
      setScanTypesLoading(false);
    };
    fetchScanTypes();
  }, [open]);

  const handleCancel = () => {
    setOpen(false);
  };

  const handleSave = async () => {
    if (activeTab === "scan-types") {
      const emptyName = scanTypes.find((s) => !s.name.trim());
      if (emptyName) {
        toast.error("All scan types must have a name");
        return;
      }

      const emptyDisplayName = scanTypes.find((s) => !s.display_name.trim());
      if (emptyDisplayName) {
        toast.error("All scan types must have a display name");
        return;
      }

      const names = scanTypes.map((s) => s.name.trim());
      if (new Set(names).size !== names.length) {
        toast.error("Scan type names must be unique");
        return;
      }

      const checkInCount = scanTypes.filter(
        (s) => s.category === "check_in",
      ).length;
      if (scanTypes.length > 0 && checkInCount !== 1) {
        toast.error("Exactly one scan type must have the check_in category");
        return;
      }

      setSaving(true);
      const res = await putRequest<{ scan_types: ScanType[] }>(
        "/superadmin/settings/scan-types",
        { scan_types: scanTypes },
        "scan types",
      );
      if (res.status === 200 && res.data) {
        setScanTypes(res.data.scan_types);
        toast.success("Scan types saved");
      } else {
        errorAlert(res);
      }
      setSaving(false);
    } else {
      setOpen(false);
    }
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
                {activeTab === "scan-types" && (
                  <ScanTypesTab
                    scanTypes={scanTypes}
                    setScanTypes={setScanTypes}
                    loading={scanTypesLoading}
                  />
                )}
              </div>
            </ScrollArea>

            <Separator className="bg-zinc-800" />
            <DialogFooter className="p-4 gap-3">
              <Button
                variant="ghost"
                onClick={handleCancel}
                className="text-zinc-400 cursor-pointer hover:text-zinc-100 hover:bg-zinc-800"
              >
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
  );
}
