import { ExternalLink, Loader2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { requestResumeDownloadURL } from "../api";

interface ResumePreviewDialogProps {
  /** Element that opens the preview when clicked. */
  trigger: ReactNode;
}

/**
 * Self-contained quick-view for the current user's resume. Fetches a fresh
 * signed URL each time it opens and renders the PDF inline, with an
 * open-in-new-tab fallback for browsers that won't embed PDFs.
 */
export function ResumePreviewDialog({ trigger }: ResumePreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next) {
      setUrl(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const res = await requestResumeDownloadURL();
    if (res.status === 200 && res.data) {
      setUrl(res.data.download_url);
      window.open(res.data.download_url, "_blank", "noopener,noreferrer");
    } else {
      setError(res.error || "Couldn't load your resume. Please try again.");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex h-[92vh] w-full flex-col gap-3 p-4 sm:max-w-6xl sm:p-6">
        <DialogHeader className="flex-row items-center justify-between space-y-0">
          <div className="space-y-1 text-left">
            <DialogTitle className="text-base font-normal">Resume</DialogTitle>
            <DialogDescription className="sr-only">
              A preview of the resume on file.
            </DialogDescription>
          </div>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mr-8 inline-flex items-center gap-1.5 text-xs font-light text-[#8A8A8A] transition-colors hover:text-black"
            >
              <ExternalLink className="size-3.5" strokeWidth={1.5} />
              Open in new tab
            </a>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#FAFAFA]">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-[#8A8A8A]" />
            </div>
          )}
          {!loading && error && (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <p className="text-sm font-light text-red-500">{error}</p>
            </div>
          )}
          {!loading && !error && url && (
            <iframe
              src={url}
              title="Resume preview"
              className="h-full w-full"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
