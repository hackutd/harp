import { AlertCircle, CheckCircle2, ScanLine, XCircle } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQrScanner } from "@/shared/hooks";
import { usePointsConfigStore } from "@/shared/stores";

import { useScansStore } from "../store";

export function ScannerDialog() {
  const {
    activeScanType,
    lastScanResult,
    scanning,
    setActiveScanType,
    performScan,
    clearLastResult,
  } = useScansStore();
  const pointsName = usePointsConfigStore((s) => s.pointsName);

  const handleScan = useCallback(
    (decodedText: string) => {
      const userId = decodedText.trim();
      if (!userId) return;
      performScan(userId);
    },
    [performScan],
  );

  const { videoRef, error } = useQrScanner({
    enabled: !!activeScanType,
    paused: !!lastScanResult || scanning,
    onDetect: handleScan,
  });

  const handleResume = useCallback(() => {
    clearLastResult();
  }, [clearLastResult]);

  const handleClose = useCallback(() => {
    setActiveScanType(null);
  }, [setActiveScanType]);

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
          {error ? (
            <div className="flex aspect-square items-center justify-center rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
              <div className="space-y-2">
                <AlertCircle className="mx-auto size-8" />
                <p>{error}</p>
              </div>
            </div>
          ) : (
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className="rounded-lg border-2 border-white/80"
                  style={{
                    width: 250,
                    height: 250,
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                  }}
                />
              </div>
            </div>
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
              {lastScanResult.success &&
                (lastScanResult.scan?.points ?? 0) !== 0 && (
                  <p className="text-sm font-medium">
                    {(lastScanResult.scan?.points ?? 0) > 0
                      ? `+${lastScanResult.scan?.points}`
                      : `−${Math.abs(lastScanResult.scan?.points ?? 0)}`}{" "}
                    {pointsName}
                  </p>
                )}
              {lastScanResult.success &&
                lastScanResult.scan?.balance !== undefined && (
                  <p className="text-sm font-light">
                    Balance: {lastScanResult.scan.balance} {pointsName}
                  </p>
                )}
              {lastScanResult.success && lastScanResult.scan?.meal_group && (
                <p className="text-sm font-medium">
                  Meal group: {lastScanResult.scan.meal_group}
                </p>
              )}
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
