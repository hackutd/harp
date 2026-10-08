import {
  IconAlertCircle,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconCircleX,
  IconDoorEnter,
  IconDots,
  IconGift,
  IconScan,
  IconShoppingCart,
  IconToolsKitchen2,
  IconUserCheck,
  type TablerIcon,
} from "@tabler/icons-react";
import { useCallback, useEffect } from "react";

import { useQrScanner } from "@/shared/hooks";
import { BADGE_COLORS } from "@/shared/lib/badge-colors";
import { cn } from "@/shared/lib/utils";
import { usePointsConfigStore } from "@/shared/stores";

import { useScannerStore } from "../store";
import type { ScanType, ScanTypeCategory } from "../types";
import { formatPointsDelta, spendsPoints } from "../utils";

const CATEGORY_ICONS: Record<ScanTypeCategory, TablerIcon> = {
  check_in: IconUserCheck,
  meal: IconToolsKitchen2,
  swag: IconGift,
  other: IconDots,
  walk_in: IconDoorEnter,
  shop: IconShoppingCart,
};

const CATEGORY_LABELS: Record<ScanTypeCategory, string> = {
  check_in: "Check-in",
  meal: "Meal",
  swag: "Swag",
  other: "Other",
  walk_in: "Walk-in",
  shop: "Shop",
};

/** Signed points badge: green adds to a hacker's balance, red spends it. */
function PointsPill({
  scanType,
  pointsName,
}: {
  scanType: ScanType;
  pointsName?: string;
}) {
  const spends = spendsPoints(scanType.category);
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
        spends ? BADGE_COLORS.red : BADGE_COLORS.green,
      )}
    >
      {formatPointsDelta(scanType)}
      {pointsName && ` ${pointsName}`}
    </span>
  );
}

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
    const spends = spendsPoints(activeScanType.category);
    const showPoints = pointsEnabled && activeScanType.points > 0;
    const resultPoints = lastScanResult?.scan?.points ?? 0;
    return (
      <div className="w-full">
        <button
          type="button"
          onClick={() => setActiveScanType(null)}
          className="-ml-2 flex h-9 items-center gap-1 rounded-full pr-3 pl-1 text-sm font-light text-ink transition-colors hover:bg-ink/5 active:scale-[0.98]"
        >
          <IconChevronLeft className="size-5" strokeWidth={1.5} />
          Scan types
        </button>

        <div className="mt-3 flex items-center gap-3">
          <h1 className="min-w-0 truncate text-2xl font-light tracking-tight text-ink">
            {activeScanType.display_name}
          </h1>
          {showPoints && (
            <PointsPill scanType={activeScanType} pointsName={pointsName} />
          )}
        </div>
        <p className="mt-1 text-sm font-light text-ink/65">
          Point the camera at a hacker&apos;s QR code
        </p>

        <div
          data-hacker-keep-black
          className="relative mt-6 aspect-square w-full overflow-hidden rounded-xl bg-black"
        >
          {error ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div className="space-y-3 text-ink/85">
                <IconAlertCircle className="mx-auto size-8" strokeWidth={1.5} />
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
                  className={cn(
                    "size-56 rounded-xl border-2",
                    !showPoints
                      ? "border-ink/25"
                      : spends
                        ? "border-red-400"
                        : "border-emerald-400",
                  )}
                  style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" }}
                />
              </div>
            </>
          )}

          {lastScanResult && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas/95 px-6 text-center">
              {lastScanResult.success ? (
                <IconCircleCheck
                  className="size-12 text-emerald-400"
                  strokeWidth={1.5}
                />
              ) : (
                <IconCircleX
                  className="size-12 text-red-400"
                  strokeWidth={1.5}
                />
              )}
              <p className="text-lg font-normal text-ink">
                {lastScanResult.message}
              </p>
              {lastScanResult.success && resultPoints !== 0 && (
                <p
                  className={cn(
                    "text-2xl font-medium tabular-nums",
                    resultPoints > 0 ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  {resultPoints > 0
                    ? `+${resultPoints}`
                    : `−${Math.abs(resultPoints)}`}{" "}
                  {pointsName}
                </p>
              )}
              {lastScanResult.success &&
                lastScanResult.scan?.balance !== undefined && (
                  <p className="text-sm font-light text-ink/65">
                    Remaining balance: {lastScanResult.scan.balance}{" "}
                    {pointsName}
                  </p>
                )}
              {lastScanResult.success && lastScanResult.scan?.meal_group && (
                <p className="text-sm font-medium text-ink">
                  Meal group: {lastScanResult.scan.meal_group}
                </p>
              )}
              <button
                type="button"
                onClick={clearLastResult}
                className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-tide px-6 text-sm font-medium text-white transition-transform active:scale-[0.98]"
              >
                <IconScan className="size-4.5" strokeWidth={1.5} />
                Scan next
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs font-light text-ink/65">
          {count} scanned
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-light tracking-tight text-ink">Scanner</h1>
      <p className="mt-1 text-sm font-light text-ink/65">
        Choose what you&apos;re scanning for
      </p>

      {loading && scanTypes.length === 0 ? (
        <div className="mt-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : activeTypes.length === 0 ? (
        <p className="mt-8 text-sm font-light text-ink/65">
          No active scan types configured. Ask a super admin to set them up.
        </p>
      ) : (
        <div className="mt-6 divide-y divide-ink/10 rounded-xl border border-ink/10">
          {activeTypes.map((scanType: ScanType) => {
            const Icon = CATEGORY_ICONS[scanType.category] ?? IconUserCheck;
            const count = statsMap.get(scanType.name) ?? 0;
            return (
              <button
                key={scanType.name}
                type="button"
                onClick={() => setActiveScanType(scanType)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-ink/5 active:scale-[0.99]"
              >
                <Icon
                  className="size-4.5 shrink-0 text-ink"
                  strokeWidth={1.5}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-normal text-ink">
                    {scanType.display_name}
                  </span>
                  <span className="block text-xs font-light text-ink/65">
                    {CATEGORY_LABELS[scanType.category] ?? scanType.category} ·{" "}
                    {count} scanned
                  </span>
                </span>
                {pointsEnabled && scanType.points > 0 && (
                  <PointsPill scanType={scanType} />
                )}
                <IconChevronRight
                  className="size-4 shrink-0 text-ink/65"
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
