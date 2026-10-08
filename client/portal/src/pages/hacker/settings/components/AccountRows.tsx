import { IconLogout, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router";

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
import { signOutExplicitly } from "@/shared/auth";
import { errorAlert } from "@/shared/lib/api";
import { ZERODAY_LOGO, ZERODAY_URL } from "@/shared/lib/zeroday";
import { useSettingsDialogStore, useUserStore } from "@/shared/stores";

import { deleteMyAccount } from "../api";

/**
 * Back to Zero Day, sign out, and delete account. Shown on the Profile page
 * and in the Settings dialog; wrap it in a SettingsGroup.
 */
export function AccountRows() {
  const navigate = useNavigate();
  const clearUser = useUserStore((s) => s.clearUser);
  const closeSettings = useSettingsDialogStore((s) => s.setOpen);
  const [deleting, setDeleting] = useState(false);

  const leave = () => {
    closeSettings(false);
    clearUser();
    navigate("/", { replace: true });
  };

  const handleLogout = async () => {
    await signOutExplicitly();
    leave();
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const res = await deleteMyAccount();
    if (res.status === 204 || res.status === 200) {
      await signOutExplicitly();
      leave();
    } else {
      errorAlert(res);
      setDeleting(false);
    }
  };

  return (
    <>
      <a
        href={ZERODAY_URL}
        className="flex min-h-[68px] w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-ink/5"
      >
        <img
          src={ZERODAY_LOGO}
          alt=""
          aria-hidden
          className="size-6 shrink-0 object-contain"
        />
        <span className="text-sm font-normal text-ink">Back to Zero Day</span>
      </a>

      <button
        type="button"
        onClick={handleLogout}
        className="flex min-h-[68px] w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-ink/5"
      >
        {/* A 24px slot, the Zero Day logo's size, so the labels line up. */}
        <span className="flex size-6 shrink-0 items-center justify-center">
          <IconLogout className="size-4.5 text-ink" strokeWidth={1.5} />
        </span>
        <span className="text-sm font-normal text-ink">Sign out</span>
      </button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="flex min-h-[68px] w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-destructive/5"
          >
            <span className="flex size-6 shrink-0 items-center justify-center">
              <IconTrash
                className="size-4.5 text-destructive"
                strokeWidth={1.5}
              />
            </span>
            <span className="text-sm font-normal text-destructive">
              Delete account
            </span>
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent className="rounded-xl border-ink/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-light tracking-tight text-ink">
              Delete your account?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-light text-ink/65">
              This permanently deletes your account, application, and all
              associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="h-11 rounded-full border-ink/10 px-6 font-normal hover:bg-ink/5">
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
    </>
  );
}
