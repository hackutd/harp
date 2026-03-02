import { useEffect } from "react";

import { useUserStore } from "@/shared/stores/user";

import { ScannerDialog } from "./components/ScannerDialog";
import { ScanStatsCards } from "./components/ScanStatsCards";
import { ScanTypesTable } from "./components/ScanTypesTable";
import { useScansStore } from "./store";

export default function ScansPage() {
  const { user } = useUserStore();
  const {
    scanTypes,
    stats,
    typesLoading,
    statsLoading,
    saving,
    fetchTypes,
    fetchStats,
    saveScanTypes,
    setActiveScanType,
  } = useScansStore();

  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    const controller = new AbortController();
    fetchTypes(controller.signal);
    fetchStats(controller.signal);
    return () => {
      controller.abort();
      // Reset active scan type so dialog doesn't reopen on navigate back
      setActiveScanType(null);
    };
  }, [fetchTypes, fetchStats, setActiveScanType]);

  return (
    <div className="space-y-6">
      <ScanStatsCards
        scanTypes={scanTypes}
        stats={stats}
        loading={typesLoading || statsLoading}
      />
      <ScanTypesTable
        scanTypes={scanTypes}
        stats={stats}
        isSuperAdmin={isSuperAdmin}
        saving={saving}
        onSelect={setActiveScanType}
        onSave={saveScanTypes}
      />
      <ScannerDialog />
    </div>
  );
}
