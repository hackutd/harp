import {
  IconEye,
  IconFileText,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { type ChangeEvent, useRef } from "react";

import type { ApplicationSchemaField } from "@/types";

import { MAX_RESUME_SIZE_BYTES as MAX_RESUME_UPLOAD_SIZE_BYTES } from "../api";
import { ResumePreviewDialog } from "../components/ResumePreviewDialog";
import { SchemaStepRenderer } from "./SchemaStepRenderer";

const MAX_RESUME_SIZE_MB = MAX_RESUME_UPLOAD_SIZE_BYTES / (1024 * 1024);

interface SponsorInfoStepProps {
  sectionLabel: string;
  fields: ApplicationSchemaField[];
  hasResume: boolean;
  isUploadingResume: boolean;
  isDeletingResume: boolean;
  onResumeSelected: (file: File) => void;
  onDeleteResume: () => void;
}

export function SponsorInfoStep({
  sectionLabel,
  fields,
  hasResume,
  isUploadingResume,
  isDeletingResume,
  onResumeSelected,
  onDeleteResume,
}: SponsorInfoStepProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isResumeBusy = isUploadingResume || isDeletingResume;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onResumeSelected(file);
    }
    event.target.value = "";
  };

  return (
    <div className="space-y-7">
      {fields.length > 0 ? (
        <SchemaStepRenderer sectionLabel={sectionLabel} fields={fields} />
      ) : (
        <h1 className="text-3xl font-light tracking-tight text-ink">
          {sectionLabel}
        </h1>
      )}

      <div className="space-y-3">
        <p className="text-xs font-light text-ink/65">Resume (optional)</p>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          className="hidden"
          disabled={isResumeBusy || hasResume}
        />

        {hasResume ? (
          <div className="flex items-center justify-between rounded-lg border border-ink/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <IconFileText className="size-5 text-ink" strokeWidth={1.5} />
              <span className="text-sm font-light text-ink">
                Resume on file
              </span>
            </div>
            <div className="flex items-center gap-1">
              <ResumePreviewDialog
                trigger={
                  <button
                    type="button"
                    aria-label="View resume"
                    className="flex size-9 items-center justify-center rounded-full text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink"
                  >
                    <IconEye className="size-4" strokeWidth={1.5} />
                  </button>
                }
              />
              <button
                type="button"
                onClick={onDeleteResume}
                disabled={isResumeBusy}
                aria-label="Delete resume"
                className={`flex size-9 items-center justify-center rounded-full text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-50 ${isDeletingResume ? "animate-pulse" : ""}`}
              >
                <IconTrash className="size-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isResumeBusy}
            className={`flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-ink/10 px-4 py-8 text-center transition-colors hover:border-ink/30 disabled:opacity-50 ${isUploadingResume ? "animate-pulse" : ""}`}
          >
            <IconUpload className="size-6 text-ink" strokeWidth={1.5} />
            <span className="text-sm font-light text-ink">
              {isUploadingResume ? "Uploading..." : "Upload your resume"}
            </span>
            <span className="text-xs font-light text-ink/65">
              PDF up to {MAX_RESUME_SIZE_MB} MB
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
