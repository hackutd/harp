import { useState } from "react";
import { toast } from "sonner";

import { errorAlert } from "@/shared/lib/api";
import { useUserStore } from "@/shared/stores";

import {
  MAX_PHOTO_SIZE_BYTES,
  PHOTO_CONTENT_TYPES,
  type PhotoContentType,
  removeMyPhoto,
  requestPhotoUploadURL,
  setMyPhoto,
  uploadPhotoToSignedURL,
} from "./api";

export interface UseProfilePhotoResult {
  /** The picture to show: the uploaded photo, else the Google one. */
  photoUrl: string | null;
  /** True when the photo was uploaded here rather than taken from Google. */
  custom: boolean;
  /** The Google picture, which shows again if the upload is removed. */
  googleUrl: string | null;
  busy: boolean;
  /** Resolves true once the photo is saved. */
  upload: (file: File) => Promise<boolean>;
  remove: () => Promise<void>;
}

// The one place a user's photo changes. It is shared by the Profile page and
// the directory card, so both always show the same picture: the user store is
// updated in place and every avatar reading it follows.
export function useProfilePhoto(): UseProfilePhotoResult {
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File): Promise<boolean> => {
    if (!PHOTO_CONTENT_TYPES.includes(file.type as PhotoContentType)) {
      toast.error("Use a JPG, PNG, or WebP photo");
      return false;
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      toast.error("Photos need to be under 2 MB");
      return false;
    }
    setBusy(true);
    try {
      const urlRes = await requestPhotoUploadURL(file.type as PhotoContentType);
      if (urlRes.status !== 200 || !urlRes.data) {
        errorAlert(urlRes);
        return false;
      }
      const uploaded = await uploadPhotoToSignedURL(
        urlRes.data.upload_url,
        file,
      );
      if (uploaded.error) {
        toast.error("Photo upload failed. Please try again.");
        return false;
      }
      const res = await setMyPhoto(urlRes.data.photo_path);
      if (res.status === 200 && res.data) {
        setUser(res.data);
        toast.success("Photo updated");
        return true;
      }
      errorAlert(res);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    const res = await removeMyPhoto();
    setBusy(false);
    if (res.status === 200 && res.data) {
      setUser(res.data);
      toast.success(
        res.data.googlePictureUrl ? "Using your Google photo" : "Photo removed",
      );
    } else {
      errorAlert(res);
    }
  };

  return {
    photoUrl: user?.profilePictureUrl ?? null,
    custom: Boolean(user?.customPhoto),
    googleUrl: user?.googlePictureUrl ?? null,
    busy,
    upload,
    remove,
  };
}
