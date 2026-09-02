import {
  Bell,
  Eye,
  FileText,
  LogOut,
  SmartphoneNfc,
  Trash2,
  Upload,
} from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { signOut } from "supertokens-auth-react/recipe/session";

import { AdminPortalButton } from "@/components/AdminPortalButton";
import { InstallGuideDialog } from "@/components/InstallGuideDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { useInstallPrompt } from "@/shared/install";
import { errorAlert, getRequest } from "@/shared/lib/api";
import { usePushSubscription } from "@/shared/push/usePushSubscription";
import { usePointsConfigStore, useUserStore } from "@/shared/stores";
import type { Application } from "@/types";

import {
  deleteMyResume,
  MAX_RESUME_SIZE_BYTES,
  requestResumeUploadURL,
  updateMyApplication,
  uploadResumeToSignedURL,
} from "../apply/api";
import { ResumePreviewDialog } from "../apply/components/ResumePreviewDialog";
import { deleteMyAccount } from "./api";

const MAX_RESUME_SIZE_MB = MAX_RESUME_SIZE_BYTES / (1024 * 1024);
const PDF_MIME_TYPE = "application/pdf";

function displayName(application: Application | null): string | null {
  const responses = application?.responses ?? {};
  const first = responses["first_name"];
  const last = responses["last_name"];
  const parts = [first, last].filter(
    (v): v is string => typeof v === "string" && v.trim() !== "",
  );
  return parts.length > 0 ? parts.join(" ") : null;
}

function initials(name: string | null, email?: string): string {
  if (name) {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

export default function ProfilePage() {
  const { user, clearUser } = useUserStore();
  const navigate = useNavigate();
  const push = usePushSubscription();
  const install = useInstallPrompt();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pointsName = usePointsConfigStore((s) => s.pointsName);
  const pointsEnabled = usePointsConfigStore((s) => s.pointsEnabled);
  const fetchPointsConfig = usePointsConfigStore((s) => s.fetchPointsConfig);

  const [application, setApplication] = useState<Application | null>(null);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const res = await getRequest<Application>(
        "/applications/me",
        "application",
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setApplication(res.data);
      }
    };
    load();
    fetchPointsConfig(controller.signal);
    return () => controller.abort();
  }, [fetchPointsConfig]);

  const name = displayName(application);
  const canEditResume = application?.status === "draft";
  const hasResume = Boolean(application?.resume_path);

  const handleLogout = async () => {
    await signOut();
    clearUser();
    navigate("/", { replace: true });
  };

  const handlePushToggle = async (checked: boolean) => {
    if (checked) {
      const result = await push.enable();
      if (result === "granted") {
        toast.success("Notifications enabled");
      } else if (result === "denied") {
        toast.error("Notifications blocked", {
          description:
            "Allow notifications for this site in your browser settings to receive updates.",
        });
      } else {
        toast.error("Couldn't enable notifications. Please try again.");
      }
    } else {
      await push.disable();
      toast.success("Notifications disabled");
    }
  };

  const handleInstallClick = () => {
    setInstallGuideOpen(true);
  };

  const handleResumeFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || resumeBusy) return;

    const isPDF =
      file.type === PDF_MIME_TYPE ||
      file.name.toLowerCase().trim().endsWith(".pdf");
    if (!isPDF) {
      setResumeError("Resume must be a PDF file.");
      return;
    }
    if (file.size > MAX_RESUME_SIZE_BYTES) {
      setResumeError(`Resume must be ${MAX_RESUME_SIZE_MB} MB or smaller.`);
      return;
    }

    setResumeError(null);
    setResumeBusy(true);

    const urlRes = await requestResumeUploadURL();
    if (urlRes.status !== 200 || !urlRes.data) {
      setResumeError(urlRes.error || "Failed to generate upload URL");
      errorAlert(urlRes);
      setResumeBusy(false);
      return;
    }

    const uploadRes = await uploadResumeToSignedURL(
      urlRes.data.upload_url,
      file,
    );
    if (uploadRes.status < 200 || uploadRes.status >= 300) {
      setResumeError(uploadRes.error || "Failed to upload resume");
      setResumeBusy(false);
      return;
    }

    const saveRes = await updateMyApplication({
      resume_path: urlRes.data.resume_path,
    });
    if (saveRes.status === 200 && saveRes.data) {
      setApplication(saveRes.data);
    } else {
      setResumeError(saveRes.error || "Failed to save resume");
      errorAlert(saveRes);
    }
    setResumeBusy(false);
  };

  const handleDeleteResume = async () => {
    if (resumeBusy) return;
    setResumeError(null);
    setResumeBusy(true);
    const res = await deleteMyResume();
    if (res.status === 200 && res.data) {
      setApplication(res.data);
    } else {
      setResumeError(res.error || "Failed to delete resume");
      errorAlert(res);
    }
    setResumeBusy(false);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const res = await deleteMyAccount();
    if (res.status === 204 || res.status === 200) {
      await signOut();
      clearUser();
      navigate("/", { replace: true });
    } else {
      errorAlert(res);
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-5 pt-6 pb-8 md:max-w-5xl md:px-8 md:pt-10">
      <h1 className="text-2xl font-light tracking-tight text-black">Profile</h1>

      {/* Identity */}
      <div className="mt-5 flex items-center gap-4">
        <Avatar className="size-16">
          {user?.profilePictureUrl && (
            <AvatarImage src={user.profilePictureUrl} alt="Profile picture" />
          )}
          <AvatarFallback className="bg-[#F0F0F0] text-lg font-light text-black">
            {initials(name, user?.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-lg font-normal text-black">
            {name ?? "Hacker"}
          </p>
          {user?.email && (
            <p className="truncate text-sm font-light text-[#8A8A8A]">
              {user.email}
            </p>
          )}
        </div>
      </div>

      {/* Points — hidden entirely when super admins turn the system off */}
      {pointsEnabled && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-[#E5E5E5] px-5 py-4">
          <div>
            <p className="text-sm font-normal text-black">{pointsName}</p>
            <p className="text-xs font-light text-[#8A8A8A]">
              Earned from check-ins and events
            </p>
          </div>
          <span className="text-2xl font-light text-black tabular-nums">
            {application?.points ?? 0}
          </span>
        </div>
      )}

      {/* Meal group — assigned at check-in, so absent until then */}
      {application?.meal_group && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-[#E5E5E5] px-5 py-4">
          <div>
            <p className="text-sm font-normal text-black">Meal group</p>
            <p className="text-xs font-light text-[#8A8A8A]">
              Show this at meal lines
            </p>
          </div>
          <span className="text-2xl font-light text-black">
            {application.meal_group}
          </span>
        </div>
      )}

      {/* Settings */}
      <section className="mt-6">
        <h2 className="mb-2 text-xs font-light tracking-widest text-[#8A8A8A] uppercase">
          Settings
        </h2>
        <div className="divide-y divide-[#F0F0F0] rounded-xl border border-[#E5E5E5]">
          {/* Install app */}
          {!install.installed && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex min-h-[68px] w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
            >
              <div className="flex items-center gap-3">
                <SmartphoneNfc
                  className="size-4.5 text-black"
                  strokeWidth={1.5}
                />
                <div>
                  <p className="text-sm font-normal text-black">Install app</p>
                  <p className="text-xs font-light text-[#8A8A8A]">
                    {install.platform === "desktop"
                      ? "Add it to your phone's home screen for the full experience"
                      : "Add to home screen for the full experience"}
                  </p>
                </div>
              </div>
            </button>
          )}

          {/* Push notifications */}
          <div className="flex min-h-[68px] items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Bell className="size-4.5 text-black" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-normal text-black">
                  Push notifications
                </p>
                <p className="text-xs font-light text-[#8A8A8A]">
                  {push.supported
                    ? "Decision & event alerts"
                    : "Not supported in this browser"}
                </p>
              </div>
            </div>
            <Switch
              checked={push.enabled}
              disabled={!push.supported || push.loading}
              onCheckedChange={handlePushToggle}
            />
          </div>

          {/* Resume */}
          <div className="flex min-h-[68px] flex-col justify-center px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="size-4.5 text-black" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-normal text-black">Resume</p>
                  <p className="text-xs font-light text-[#8A8A8A]">
                    {hasResume ? "On file" : "Not uploaded"}
                    {!canEditResume && application ? " · Locked" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {hasResume && (
                  <ResumePreviewDialog
                    trigger={
                      <button
                        type="button"
                        aria-label="View resume"
                        className="flex size-9 items-center justify-center rounded-full text-[#8A8A8A] transition-colors hover:bg-[#F5F5F5] hover:text-black"
                      >
                        <Eye className="size-4" strokeWidth={1.5} />
                      </button>
                    }
                  />
                )}
                {canEditResume &&
                  (hasResume ? (
                    <button
                      type="button"
                      onClick={handleDeleteResume}
                      disabled={resumeBusy}
                      aria-label="Delete resume"
                      className={`flex size-9 items-center justify-center rounded-full text-[#8A8A8A] transition-colors hover:bg-[#F5F5F5] hover:text-black disabled:opacity-50 ${resumeBusy ? "animate-pulse" : ""}`}
                    >
                      <Trash2 className="size-4" strokeWidth={1.5} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={resumeBusy}
                      aria-label="Upload resume"
                      className={`flex size-9 items-center justify-center rounded-full text-[#8A8A8A] transition-colors hover:bg-[#F5F5F5] hover:text-black disabled:opacity-50 ${resumeBusy ? "animate-pulse" : ""}`}
                    >
                      <Upload className="size-4" strokeWidth={1.5} />
                    </button>
                  ))}
              </div>
            </div>
            {resumeError && (
              <p className="mt-2 text-xs font-light text-red-500">
                {resumeError}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleResumeFile}
              className="hidden"
            />
          </div>
        </div>
      </section>

      {/* Account */}
      <section className="mt-6">
        <h2 className="mb-2 text-xs font-light tracking-widest text-[#8A8A8A] uppercase">
          Account
        </h2>
        <div className="divide-y divide-[#F0F0F0] rounded-xl border border-[#E5E5E5]">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
          >
            <LogOut className="size-4.5 text-black" strokeWidth={1.5} />
            <span className="text-sm font-normal text-black">Sign out</span>
          </button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-destructive/5"
              >
                <Trash2
                  className="size-4.5 text-destructive"
                  strokeWidth={1.5}
                />
                <span className="text-sm font-normal text-destructive">
                  Delete account
                </span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-xl border-[#E5E5E5]">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-light tracking-tight text-black">
                  Delete your account?
                </AlertDialogTitle>
                <AlertDialogDescription className="font-light text-[#8A8A8A]">
                  This permanently deletes your account, application, and all
                  associated data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-3">
                <AlertDialogCancel className="h-11 rounded-full border-[#D9D9D9] px-6 font-normal hover:bg-[#F5F5F5]">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="h-11 rounded-full bg-destructive px-6 font-normal text-white hover:bg-destructive-hover"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <div className="mt-6">
        <AdminPortalButton />
      </div>

      <InstallGuideDialog
        open={installGuideOpen}
        onOpenChange={setInstallGuideOpen}
      />
    </div>
  );
}
