import { IconEye, IconFileText, IconPlus, IconX } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  MAX_RECEIPT_IMAGE_SIZE_BYTES,
  MAX_RECEIPT_PDF_SIZE_BYTES,
  requestTravelReceiptUploadURL,
  uploadReceiptToSignedURL,
} from "../api";
import type { ReceiptContentType, UploadedReceipt } from "../types";
import { ReceiptPreviewDialog } from "./ReceiptPreviewDialog";

const MAX_RECEIPTS = 5;

const ACCEPTED_TYPES: Record<string, ReceiptContentType> = {
  "application/pdf": "application/pdf",
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
};

interface ReceiptUploaderProps {
  receipts: UploadedReceipt[];
  onChange: (receipts: UploadedReceipt[]) => void;
  disabled?: boolean;
}

/**
 * Multi-file receipt uploader (plane tickets etc.) for the travel RSVP form.
 * Each file goes straight to GCS via a signed URL; only the object paths are
 * kept locally and sent with the travel RSVP submission.
 */
export function ReceiptUploader({
  receipts,
  onChange,
  disabled = false,
}: ReceiptUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelected = async (file: File) => {
    const contentType = ACCEPTED_TYPES[file.type];
    if (!contentType) {
      toast.error("Receipts must be a PDF, PNG, or JPEG file");
      return;
    }

    const maxBytes =
      contentType === "application/pdf"
        ? MAX_RECEIPT_PDF_SIZE_BYTES
        : MAX_RECEIPT_IMAGE_SIZE_BYTES;
    if (file.size > maxBytes) {
      toast.error(
        `File is too large (max ${Math.round(maxBytes / 1024 / 1024)}MB)`,
      );
      return;
    }

    setUploading(true);

    const urlRes = await requestTravelReceiptUploadURL(contentType);
    if (urlRes.status !== 200 || !urlRes.data) {
      toast.error(urlRes.error ?? "Failed to prepare receipt upload");
      setUploading(false);
      return;
    }

    const uploadRes = await uploadReceiptToSignedURL(
      urlRes.data.upload_url,
      file,
      contentType,
    );
    if (uploadRes.status < 200 || uploadRes.status >= 300) {
      toast.error(uploadRes.error ?? "Failed to upload receipt");
      setUploading(false);
      return;
    }

    onChange([
      ...receipts,
      { path: urlRes.data.receipt_path, name: file.name },
    ]);
    setUploading(false);
  };

  return (
    <div className="space-y-3">
      {receipts.map((receipt) => (
        <div
          key={receipt.path}
          className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 px-4 py-3"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <IconFileText
              className="size-4 shrink-0 text-ink/65"
              strokeWidth={1.5}
            />
            <span className="truncate text-sm font-light text-ink">
              {receipt.name}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ReceiptPreviewDialog
              receipt={receipt}
              trigger={
                <button
                  type="button"
                  aria-label={`Preview ${receipt.name}`}
                  className="flex size-8 items-center justify-center rounded-full text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  <IconEye className="size-4" strokeWidth={1.5} />
                </button>
              }
            />
            {!disabled && (
              <button
                type="button"
                aria-label="Remove receipt"
                onClick={() =>
                  onChange(receipts.filter((r) => r.path !== receipt.path))
                }
                className="flex size-8 items-center justify-center rounded-full text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <IconX className="size-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      ))}

      {!disabled && receipts.length < MAX_RECEIPTS && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handleFileSelected(file);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink/10 px-4 py-3.5 text-sm font-light text-ink/65 transition-colors hover:border-ink/30 hover:text-ink disabled:opacity-60"
          >
            <IconPlus className="size-4" strokeWidth={1.5} />
            {uploading
              ? "Uploading..."
              : `Add receipt (${receipts.length}/${MAX_RECEIPTS})`}
          </button>
        </>
      )}
    </div>
  );
}
