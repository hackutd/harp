import { useEffect } from "react";

import { ScannerDialog } from "./components/ScannerDialog";
import { ScanStatsCards } from "./components/ScanStatsCards";
import { ScanTypeGrid } from "./components/ScanTypeGrid";
import { useScansStore } from "./store";

export default function ScansPage() {
  const {
    scanTypes,
    stats,
    typesLoading,
    statsLoading,
    fetchTypes,
    fetchStats,
    setActiveScanType,
  } = useScansStore();

  useEffect(() => {
    const controller = new AbortController();
    fetchTypes(controller.signal);
    fetchStats(controller.signal);
    return () => controller.abort();
  }, [fetchTypes, fetchStats]);

  return (
    <div className="space-y-6">
      <ScanStatsCards
        scanTypes={scanTypes}
        stats={stats}
        loading={typesLoading || statsLoading}
      />
      <ScanTypeGrid scanTypes={scanTypes} onSelect={setActiveScanType} />
      <ScannerDialog />
    </div>
  );
}
