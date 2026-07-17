import { Eye, FileText, Loader2, Trash2, Upload } from "lucide-react";
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
        <h1 className="text-3xl font-light tracking-tight text-black">
          {sectionLabel}
        </h1>
      )}

      <div className="space-y-3">
        <p className="text-xs font-light text-[#8A8A8A]">Resume (optional)</p>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          className="hidden"
          disabled={isResumeBusy || hasResume}
        />

        {hasResume ? (
          <div className="flex items-center justify-between rounded-lg border border-[#E5E5E5] px-4 py-3">
            <div className="flex items-center gap-3">
              <FileText className="size-5 text-black" strokeWidth={1.5} />
              <span className="text-sm font-light text-black">
                Resume on file
              </span>
            </div>
            <div className="flex items-center gap-1">
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
              <button
                type="button"
                onClick={onDeleteResume}
                disabled={isResumeBusy}
                aria-label="Delete resume"
                className="flex size-9 items-center justify-center rounded-full text-[#8A8A8A] transition-colors hover:bg-[#F5F5F5] hover:text-black disabled:opacity-50"
              >
                {isDeletingResume ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isResumeBusy}
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-[#C9C9C9] px-4 py-8 text-center transition-colors hover:border-black disabled:opacity-50"
          >
            {isUploadingResume ? (
              <Loader2 className="size-6 animate-spin text-black" />
            ) : (
              <Upload className="size-6 text-black" strokeWidth={1.5} />
            )}
            <span className="text-sm font-light text-black">
              {isUploadingResume ? "Uploading..." : "Upload your resume"}
            </span>
            <span className="text-xs font-light text-[#8A8A8A]">
              PDF up to {MAX_RESUME_SIZE_MB} MB
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
