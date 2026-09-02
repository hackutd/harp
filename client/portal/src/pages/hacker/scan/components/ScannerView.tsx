import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Gift,
  MoreHorizontal,
  ScanLine,
  ShoppingCart,
  UserCheck,
  Utensils,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect } from "react";

import { useQrScanner } from "@/shared/hooks";
import { usePointsConfigStore } from "@/shared/stores";

import { useScannerStore } from "../store";
import type { ScanType, ScanTypeCategory } from "../types";

const CATEGORY_ICONS: Record<ScanTypeCategory, LucideIcon> = {
  check_in: UserCheck,
  meal: Utensils,
  swag: Gift,
  other: MoreHorizontal,
  walk_in: DoorOpen,
  shop: ShoppingCart,
};

const CATEGORY_LABELS: Record<ScanTypeCategory, string> = {
  check_in: "Check-in",
  meal: "Meal",
  swag: "Swag",
  other: "Other",
  walk_in: "Walk-in",
  shop: "Shop",
};

export function ScannerView() {
  const {
    scanTypes,
    stats,
    loading,
    scanning,
    activeScanType,
    lastScanResult,
    fetchScannerData,
    performScan,
    setActiveScanType,
    clearLastResult,
  } = useScannerStore();
  const pointsName = usePointsConfigStore((s) => s.pointsName);
  const pointsEnabled = usePointsConfigStore((s) => s.pointsEnabled);
  const fetchPointsConfig = usePointsConfigStore((s) => s.fetchPointsConfig);

  useEffect(() => {
    const controller = new AbortController();
    fetchScannerData(controller.signal);
    fetchPointsConfig(controller.signal);
    return () => {
      controller.abort();
      // Stop the camera and drop any stale result when leaving the tab
      setActiveScanType(null);
    };
  }, [fetchScannerData, fetchPointsConfig, setActiveScanType]);

  const handleDetect = useCallback(
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
    onDetect: handleDetect,
  });

  const activeTypes = scanTypes.filter((st) => st.is_active);
  const statsMap = new Map(stats.map((s) => [s.scan_type, s.count]));

  if (activeScanType) {
    const count = statsMap.get(activeScanType.name) ?? 0;
    return (
      <div className="w-full">
        <button
          type="button"
          onClick={() => setActiveScanType(null)}
          className="-ml-2 flex h-9 items-center gap-1 rounded-full pr-3 pl-1 text-sm font-light text-black transition-colors hover:bg-[#F0F0F0] active:scale-[0.98]"
        >
          <ChevronLeft className="size-5" strokeWidth={1.5} />
          Scan types
        </button>

        <h1 className="mt-3 text-2xl font-light tracking-tight text-black">
          {activeScanType.display_name}
        </h1>
        <p className="mt-1 text-sm font-light text-[#8A8A8A]">
          Point the camera at a hacker&apos;s QR code
        </p>

        <div className="relative mt-6 aspect-square w-full overflow-hidden rounded-xl bg-black">
          {error ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div className="space-y-3 text-white/80">
                <AlertCircle className="mx-auto size-8" strokeWidth={1.5} />
                <p className="text-sm font-light">{error}</p>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className="size-56 rounded-xl border-2 border-white/80"
                  style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" }}
                />
              </div>
            </>
          )}

          {lastScanResult && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/95 px-6 text-center">
              {lastScanResult.success ? (
                <CheckCircle2
                  className="size-12 text-emerald-700"
                  strokeWidth={1.5}
                />
              ) : (
                <XCircle className="size-12 text-red-600" strokeWidth={1.5} />
              )}
              <p className="text-lg font-normal text-black">
                {lastScanResult.message}
              </p>
              {lastScanResult.success &&
                (lastScanResult.scan?.points ?? 0) !== 0 && (
                  <p className="text-sm font-medium text-black">
                    {(lastScanResult.scan?.points ?? 0) > 0
                      ? `+${lastScanResult.scan?.points}`
                      : `−${Math.abs(lastScanResult.scan?.points ?? 0)}`}{" "}
                    {pointsName}
                  </p>
                )}
              {lastScanResult.success &&
                lastScanResult.scan?.balance !== undefined && (
                  <p className="text-sm font-light text-[#8A8A8A]">
                    Balance: {lastScanResult.scan.balance} {pointsName}
                  </p>
                )}
              {lastScanResult.success && lastScanResult.scan?.meal_group && (
                <p className="text-sm font-medium text-black">
                  Meal group: {lastScanResult.scan.meal_group}
                </p>
              )}
              <button
                type="button"
                onClick={clearLastResult}
                className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-medium text-white transition-transform active:scale-[0.98]"
              >
                <ScanLine className="size-4.5" strokeWidth={1.5} />
                Scan next
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs font-light text-[#8A8A8A]">
          {count} scanned
          {pointsEnabled && activeScanType.points > 0
            ? ` · ${activeScanType.points} ${pointsName}`
            : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-light tracking-tight text-black">Scanner</h1>
      <p className="mt-1 text-sm font-light text-[#8A8A8A]">
        Choose what you&apos;re scanning for
      </p>

      {loading && scanTypes.length === 0 ? (
        <div className="mt-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-[#F5F5F5]"
            />
          ))}
        </div>
      ) : activeTypes.length === 0 ? (
        <p className="mt-8 text-sm font-light text-[#8A8A8A]">
          No active scan types configured. Ask a super admin to set them up.
        </p>
      ) : (
        <div className="mt-6 divide-y divide-[#F0F0F0] rounded-xl border border-[#E5E5E5]">
          {activeTypes.map((scanType: ScanType) => {
            const Icon = CATEGORY_ICONS[scanType.category] ?? UserCheck;
            const count = statsMap.get(scanType.name) ?? 0;
            return (
              <button
                key={scanType.name}
                type="button"
                onClick={() => setActiveScanType(scanType)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-[#FAFAFA] active:scale-[0.99]"
              >
                <Icon
                  className="size-4.5 shrink-0 text-black"
                  strokeWidth={1.5}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-normal text-black">
                    {scanType.display_name}
                  </span>
                  <span className="block text-xs font-light text-[#8A8A8A]">
                    {CATEGORY_LABELS[scanType.category] ?? scanType.category} ·{" "}
                    {count} scanned
                    {pointsEnabled && scanType.points > 0
                      ? ` · ${scanType.points} ${pointsName}`
                      : ""}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-[#C4C4C4]"
                  strokeWidth={1.5}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
