import { ExternalLink } from "lucide-react";
import { type ReactNode, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchApplicationResumeURL } from "@/pages/admin/all-applicants/api";

interface ResumePreviewDialogProps {
  /** Application whose resume should be previewed. */
  applicationId: string;
  /** Element that opens the preview when clicked. */
  trigger: ReactNode;
}

/**
 * Admin-side quick-view for an applicant's resume. Fetches a fresh signed URL
 * each time it opens and renders the PDF inline, with an open-in-new-tab
 * fallback for browsers that won't embed PDFs.
 */
export function ResumePreviewDialog({
  applicationId,
  trigger,
}: ResumePreviewDialogProps) {
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
    const res = await fetchApplicationResumeURL(applicationId);
    if (res.status === 200 && res.data?.download_url) {
      setUrl(res.data.download_url);
    } else {
      setError(res.error || "Failed to load resume. Please try again.");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex h-[92vh] w-full flex-col gap-3 p-4 sm:max-w-6xl sm:p-6">
        <DialogHeader className="flex-row items-center justify-between space-y-0">
          <div className="space-y-1 text-left">
            <DialogTitle className="text-base">Resume</DialogTitle>
            <DialogDescription className="sr-only">
              A preview of the applicant's resume.
            </DialogDescription>
          </div>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground mr-8 inline-flex items-center gap-1.5 text-xs transition-colors"
            >
              <ExternalLink className="size-3.5" />
              Open in new tab
            </a>
          )}
        </DialogHeader>

        <div className="bg-muted/40 min-h-0 flex-1 overflow-hidden rounded-lg border">
          {loading && (
            <div className="h-full space-y-3 p-6">
              <Skeleton className="h-6 w-1/2" />
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          )}
          {!loading && error && (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <p className="text-destructive text-sm">{error}</p>
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
