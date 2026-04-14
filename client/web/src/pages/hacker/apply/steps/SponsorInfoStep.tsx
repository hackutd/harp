import { Loader2, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useRef } from "react";

import { Button } from "@/components/ui/button";
import type { ApplicationSchemaField } from "@/types";

import { MAX_RESUME_SIZE_BYTES as MAX_RESUME_UPLOAD_SIZE_BYTES } from "../api";
import { SchemaStepRenderer } from "./SchemaStepRenderer";

const MAX_RESUME_SIZE_MB = MAX_RESUME_UPLOAD_SIZE_BYTES / (1024 * 1024);

interface SponsorInfoStepProps {
  fields: ApplicationSchemaField[];
  hasResume: boolean;
  isUploadingResume: boolean;
  isDeletingResume: boolean;
  onResumeSelected: (file: File) => void;
  onDeleteResume: () => void;
}

export function SponsorInfoStep({
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
    <div className="space-y-6">
      {fields.length > 0 ? (
        <SchemaStepRenderer sectionLabel="Links & Profiles" fields={fields} />
      ) : (
        <div>
          <h2 className="text-xl font-semibold">
            Links & Profiles
          </h2>
          <p className="text-sm text-muted-foreground">
            Share your profiles with our sponsors (all optional)
          </p>
        </div>
      )}

      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <h3 className="font-medium">Resume (Optional)</h3>
          <p className="text-sm text-muted-foreground">
            Upload a PDF up to {MAX_RESUME_SIZE_MB} MB.
          </p>
        </div>

        <p className="text-sm">
          {hasResume ? "Resume on file." : "No resume uploaded."}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          className="hidden"
          disabled={isResumeBusy || hasResume}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isResumeBusy || hasResume}
          >
            {isUploadingResume ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Resume
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onDeleteResume}
            disabled={isResumeBusy || !hasResume}
          >
            {isDeletingResume ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Resume
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
