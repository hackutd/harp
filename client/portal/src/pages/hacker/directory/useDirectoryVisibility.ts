import { useState } from "react";
import { toast } from "sonner";

import { errorAlert } from "@/shared/lib/api";

import { setDirectoryDiscoverable } from "./api";
import { useDirectoryStore } from "./store";

export interface DirectoryVisibility {
  discoverable: boolean;
  busy: boolean;
  setDiscoverable: (discoverable: boolean) => Promise<void>;
}

// The "show me in the Directory" switch on the Profile page. With a profile
// it saves immediately; before one exists it records the choice for when the
// profile is first saved.
export function useDirectoryVisibility(): DirectoryVisibility {
  const profile = useDirectoryStore((s) => s.me?.profile ?? null);
  const setMe = useDirectoryStore((s) => s.setMe);
  const draft = useDirectoryStore((s) => s.draftDiscoverable);
  const setDraft = useDirectoryStore((s) => s.setDraftDiscoverable);
  const [busy, setBusy] = useState(false);

  const setDiscoverable = async (checked: boolean) => {
    if (!profile) {
      setDraft(checked);
      return;
    }
    setBusy(true);
    const res = await setDirectoryDiscoverable(checked);
    setBusy(false);
    if (res.status === 200 && res.data) {
      setMe(res.data);
      toast.success(
        checked
          ? "You're visible in the Directory"
          : "You're hidden from the Directory",
      );
    } else {
      errorAlert(res);
    }
  };

  return {
    discoverable: profile ? profile.discoverable : draft,
    busy,
    setDiscoverable,
  };
}
