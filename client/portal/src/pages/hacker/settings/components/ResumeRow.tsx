import {
  IconEye,
  IconFileText,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { type ChangeEvent, useRef, useState } from "react";

import { errorAlert } from "@/shared/lib/api";
import type { Application } from "@/types";

import {
  deleteMyResume,
  MAX_RESUME_SIZE_BYTES,
  requestResumeUploadURL,
  updateMyApplication,
  uploadResumeToSignedURL,
} from "../../apply/api";
import { ResumePreviewDialog } from "../../apply/components/ResumePreviewDialog";

const MAX_RESUME_SIZE_MB = MAX_RESUME_SIZE_BYTES / (1024 * 1024);
const PDF_MIME_TYPE = "application/pdf";

interface ResumeRowProps {
  /** Null until the application loads, and for users without one. */
  application: Application | null;
  loading: boolean;
  onApplicationChange: (application: Application) => void;
}

/**
 * The resume on file. The whole row opens it (or, with none on file, the file
 * picker) through a stretched button behind the content; delete sits above it
 * as its own button. Editable only while the application is a draft.
 */
export function ResumeRow({
  application,
  loading,
  onApplicationChange,
}: ResumeRowProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = application?.status === "draft";
  const hasResume = Boolean(application?.resume_path);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;

    const isPDF =
      file.type === PDF_MIME_TYPE ||
      file.name.toLowerCase().trim().endsWith(".pdf");
    if (!isPDF) {
      setError("Resume must be a PDF file.");
      return;
    }
    if (file.size > MAX_RESUME_SIZE_BYTES) {
      setError(`Resume must be ${MAX_RESUME_SIZE_MB} MB or smaller.`);
      return;
    }

    setError(null);
    setBusy(true);

    const urlRes = await requestResumeUploadURL();
    if (urlRes.status !== 200 || !urlRes.data) {
      setError(urlRes.error || "Failed to generate upload URL");
      errorAlert(urlRes);
      setBusy(false);
      return;
    }

    const uploadRes = await uploadResumeToSignedURL(
      urlRes.data.upload_url,
      file,
    );
    if (uploadRes.status < 200 || uploadRes.status >= 300) {
      setError(uploadRes.error || "Failed to upload resume");
      setBusy(false);
      return;
    }

    const saveRes = await updateMyApplication({
      resume_path: urlRes.data.resume_path,
    });
    if (saveRes.status === 200 && saveRes.data) {
      onApplicationChange(saveRes.data);
    } else {
      setError(saveRes.error || "Failed to save resume");
      errorAlert(saveRes);
    }
    setBusy(false);
  };

  const handleDelete = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    const res = await deleteMyResume();
    if (res.status === 200 && res.data) {
      onApplicationChange(res.data);
    } else {
      setError(res.error || "Failed to delete resume");
      errorAlert(res);
    }
    setBusy(false);
  };

  const status = loading
    ? "Checking…"
    : `${hasResume ? "On file" : "Not uploaded"}${!canEdit && application ? " · Locked" : ""}`;

  return (
    <div className="relative flex min-h-[68px] flex-col justify-center px-5 py-4">
      {!loading &&
        (hasResume ? (
          <ResumePreviewDialog
            trigger={
              <button
                type="button"
                aria-label="View resume"
                className="absolute inset-0 cursor-pointer transition-colors outline-none hover:bg-ink/5 focus-visible:bg-ink/5"
              />
            }
          />
        ) : (
          canEdit && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              aria-label="Upload resume"
              className="absolute inset-0 cursor-pointer transition-colors outline-none hover:bg-ink/5 focus-visible:bg-ink/5 disabled:cursor-default"
            />
          )
        ))}
      <div className="pointer-events-none relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconFileText className="size-4.5 text-ink" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-normal text-ink">Resume</p>
            <p className="text-xs font-light text-ink/65">{status}</p>
          </div>
        </div>
        {!loading && (
          <div className="flex items-center gap-1">
            {hasResume && (
              <span
                aria-hidden
                className="flex size-9 items-center justify-center text-ink/65"
              >
                <IconEye className="size-4" strokeWidth={1.5} />
              </span>
            )}
            {canEdit &&
              (hasResume ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  aria-label="Delete resume"
                  className={`pointer-events-auto flex size-9 items-center justify-center rounded-full text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-50 ${busy ? "animate-pulse" : ""}`}
                >
                  <IconTrash className="size-4" strokeWidth={1.5} />
                </button>
              ) : (
                <span
                  aria-hidden
                  className={`flex size-9 items-center justify-center text-ink/65 ${busy ? "animate-pulse opacity-50" : ""}`}
                >
                  <IconUpload className="size-4" strokeWidth={1.5} />
                </span>
              ))}
          </div>
        )}
      </div>
      {error && (
        <p className="relative mt-2 text-xs font-light text-red-400">{error}</p>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
