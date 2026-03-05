import { Loader2, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useRef } from "react";
import { useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import type { ApplicationFormData } from "../validations";

interface SponsorInfoStepProps {
  hasResume: boolean;
  isUploadingResume: boolean;
  isDeletingResume: boolean;
  onResumeSelected: (file: File) => void;
  onDeleteResume: () => void;
}

export function SponsorInfoStep({
  hasResume,
  isUploadingResume,
  isDeletingResume,
  onResumeSelected,
  onDeleteResume,
}: SponsorInfoStepProps) {
  const form = useFormContext<ApplicationFormData>();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isResumeBusy = isUploadingResume || isDeletingResume;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onResumeSelected(file);
    }

    // Reset so selecting the same file again still triggers onChange.
    event.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Sponsor Information</h2>
        <p className="text-sm text-muted-foreground">
          Share your profiles with our sponsors (all optional)
        </p>
      </div>

      <FormField
        control={form.control}
        name="github"
        render={({ field }) => (
          <FormItem>
            <FormLabel>GitHub</FormLabel>
            <FormControl>
              <Input placeholder="https://github.com/username" {...field} />
            </FormControl>
            <FormDescription>Optional</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="linkedin"
        render={({ field }) => (
          <FormItem>
            <FormLabel>LinkedIn</FormLabel>
            <FormControl>
              <Input
                placeholder="https://linkedin.com/in/username"
                {...field}
              />
            </FormControl>
            <FormDescription>Optional</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="website"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Personal Website</FormLabel>
            <FormControl>
              <Input placeholder="https://yourwebsite.com" {...field} />
            </FormControl>
            <FormDescription>Optional</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <h3 className="font-medium">Resume (Optional)</h3>
          <p className="text-sm text-muted-foreground">
            Upload a PDF up to 5 MB.
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
