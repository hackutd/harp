import { Html5Qrcode } from "html5-qrcode";
import { AlertCircle, CheckCircle2, ScanLine, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useScansStore } from "../store";

const QR_READER_ID = "qr-reader";

export function ScannerDialog() {
  const {
    activeScanType,
    lastScanResult,
    setActiveScanType,
    performScan,
    clearLastResult,
  } = useScansStore();

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const processedRef = useRef(false);

  const handleScan = useCallback(
    (decodedText: string) => {
      if (processedRef.current) return;
      const userId = decodedText.trim();
      if (!userId) return;

      // Mark as processed and pause the scanner immediately
      processedRef.current = true;
      if (scannerRef.current) {
        try {
          scannerRef.current.pause(true);
        } catch {
          // scanner may not be running
        }
      }

      performScan(userId);
    },
    [performScan],
  );

  const handleResume = useCallback(() => {
    clearLastResult();
    processedRef.current = false;
    if (scannerRef.current) {
      try {
        scannerRef.current.resume();
      } catch {
        // scanner may not be in paused state
      }
    }
  }, [clearLastResult]);

  // Start/stop camera when dialog opens/closes
  useEffect(() => {
    if (!activeScanType) return;

    processedRef.current = false;

    // Small delay to ensure the DOM element is rendered
    const startTimeout = setTimeout(() => {
      setCameraError(null);
      const element = document.getElementById(QR_READER_ID);
      if (!element) return;

      const scanner = new Html5Qrcode(QR_READER_ID);
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          handleScan,
          () => {},
        )
        .catch((err: Error) => {
          setCameraError(
            "Camera access is required for scanning. Please allow camera access and try again.",
          );
          console.error("QR scanner start error:", err);
        });
    }, 100);

    return () => {
      clearTimeout(startTimeout);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [activeScanType, handleScan]);

  const handleClose = () => {
    setActiveScanType(null);
  };

  return (
    <Dialog
      open={!!activeScanType}
      onOpenChange={(open) => !open && handleClose()}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Scanning: {activeScanType?.display_name}</DialogTitle>
          <DialogDescription>
            Point camera at a hacker&apos;s QR code to scan
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          {cameraError ? (
            <div className="flex aspect-square items-center justify-center rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
              <div className="space-y-2">
                <AlertCircle className="mx-auto size-8" />
                <p>{cameraError}</p>
              </div>
            </div>
          ) : (
            <div
              id={QR_READER_ID}
              className="w-full overflow-hidden rounded-lg"
            />
          )}

          {lastScanResult && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-lg ${
                lastScanResult.success
                  ? "bg-green-100/95 text-green-800"
                  : "bg-red-100/95 text-red-800"
              }`}
            >
              {lastScanResult.success ? (
                <CheckCircle2 className="size-12" />
              ) : (
                <XCircle className="size-12" />
              )}
              <p className="text-lg font-medium">{lastScanResult.message}</p>
              <Button variant="outline" onClick={handleResume}>
                <ScanLine className="mr-2 size-4" />
                Scan Next
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Stop Scanning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
