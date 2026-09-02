import { type ReactNode, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { requestTravelReceiptDownloadURL } from "../api";
import type { UploadedReceipt } from "../types";

interface ReceiptPreviewDialogProps {
  receipt: UploadedReceipt;
  trigger: ReactNode;
}

function isPDF(receipt: UploadedReceipt) {
  return (
    receipt.path.toLowerCase().endsWith(".pdf") ||
    receipt.name.toLowerCase().endsWith(".pdf")
  );
}

/** Fetches a fresh signed URL and previews a travel receipt without leaving the form. */
export function ReceiptPreviewDialog({
  receipt,
  trigger,
}: ReceiptPreviewDialogProps) {
  const requestID = useRef(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    const currentRequest = ++requestID.current;

    if (!next) {
      setLoading(false);
      setURL(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const res = await requestTravelReceiptDownloadURL(receipt.path);
    if (currentRequest !== requestID.current) return;

    if (res.status === 200 && res.data) {
      setURL(res.data.download_url);
    } else {
      setError(res.error ?? "Couldn't load this receipt. Please try again.");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex h-[85vh] max-h-[760px] w-full flex-col gap-3 rounded-xl border-[#E5E5E5] p-4 sm:max-w-4xl sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="truncate pr-10 text-base font-light tracking-tight text-black">
            {receipt.name}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Preview of the uploaded receipt.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#FAFAFA]">
          {loading && <Skeleton className="size-full rounded-none" />}
          {!loading && error && (
            <div className="flex size-full items-center justify-center px-6 text-center">
              <p className="text-sm font-light text-[#8A8A8A]">{error}</p>
            </div>
          )}
          {!loading &&
            !error &&
            url &&
            (isPDF(receipt) ? (
              <iframe
                src={url}
                title={`${receipt.name} preview`}
                className="size-full"
              />
            ) : (
              <div className="flex size-full items-center justify-center overflow-auto p-4">
                <img
                  src={url}
                  alt={`Receipt: ${receipt.name}`}
                  className="max-h-full max-w-full rounded-lg object-contain"
                  onError={() =>
                    setError("Couldn't display this receipt. Please try again.")
                  }
                />
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
