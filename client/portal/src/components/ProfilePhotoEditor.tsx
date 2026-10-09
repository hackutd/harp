import { IconCamera, IconLoader2 } from "@tabler/icons-react";
import { type ReactNode, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GoogleIcon } from "@/shared/lib/hacker-link-brand-icons";
import { cn } from "@/shared/lib/utils";
import { useProfilePhoto } from "@/shared/photo";

import { PhotoCropDialog } from "./PhotoCropDialog";

interface ProfilePhotoEditorProps {
  /** Shown when there is no photo at all, e.g. initials. */
  fallback: string;
  /** Content beside the photo (name, email, a hint). */
  children?: ReactNode;
  /** Trailing control, vertically centred against the photo and text. */
  action?: ReactNode;
  className?: string;
}

// The user's one photo, edited on the Profile page. The sidebar shows the
// same photo, so changing it here changes it everywhere.
export function ProfilePhotoEditor({
  fallback,
  children,
  action,
  className,
}: ProfilePhotoEditorProps) {
  const { photoUrl, custom, googleUrl, busy, upload, remove } =
    useProfilePhoto();
  const [framing, setFraming] = useState(false);

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <button
        type="button"
        onClick={() => setFraming(true)}
        disabled={busy}
        aria-label={photoUrl ? "Change photo" : "Add photo"}
        className="group relative shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ice/50 focus-visible:outline-none disabled:cursor-wait"
      >
        <Avatar className="size-16 border border-ink/15">
          {photoUrl && (
            <AvatarImage
              src={photoUrl}
              alt="Your photo"
              referrerPolicy="no-referrer"
              className="object-cover"
            />
          )}
          <AvatarFallback className="bg-ice/15 text-lg font-light text-ice">
            {fallback}
          </AvatarFallback>
        </Avatar>
        <span className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border border-ink/15 bg-surface text-ink/85 transition-colors group-hover:text-ink">
          {busy ? (
            <IconLoader2 className="size-3.5 animate-spin" />
          ) : (
            <IconCamera className="size-3.5" strokeWidth={1.75} />
          )}
        </span>
      </button>
      {framing && (
        <PhotoCropDialog
          onClose={() => setFraming(false)}
          currentUrl={photoUrl}
          fallback={fallback}
          busy={busy}
          onSave={upload}
        />
      )}

      <div className="min-w-0 flex-1">
        {children}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-light">
          {custom ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="inline-flex items-center gap-1.5 text-ink/65 transition-colors hover:text-ink disabled:opacity-50"
            >
              {googleUrl && <GoogleIcon className="size-3.5" />}
              {googleUrl ? "Use my Google photo" : "Remove photo"}
            </button>
          ) : googleUrl ? (
            <span className="inline-flex items-center gap-1.5 text-ink/65">
              <GoogleIcon className="size-3.5" />
              Your Google profile photo
            </span>
          ) : (
            <span className="text-ink/55">Tap the photo to add one</span>
          )}
          {photoUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setFraming(true)}
              className="text-ink/65 transition-colors hover:text-ink disabled:opacity-50"
            >
              Adjust photo
            </button>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
