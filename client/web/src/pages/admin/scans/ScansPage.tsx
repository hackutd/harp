import { useEffect } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

  if (typesLoading && scanTypes.length === 0) {
    return (
      <div className="space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-12 mt-1" />
              </CardHeader>
            </Card>
          ))}
        </div>
        {/* Table */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

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
