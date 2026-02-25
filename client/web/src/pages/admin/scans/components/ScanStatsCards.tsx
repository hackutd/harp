import { Gift, UserCheck, Utensils } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { ScanStat, ScanType, ScanTypeCategory } from "../types";

const categoryIcons: Record<ScanTypeCategory, typeof UserCheck> = {
  check_in: UserCheck,
  meal: Utensils,
  swag: Gift,
};

interface ScanStatsCardsProps {
  scanTypes: ScanType[];
  stats: ScanStat[];
  loading: boolean;
}

export function ScanStatsCards({
  scanTypes,
  stats,
  loading,
}: ScanStatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="mt-2 h-8 w-16 rounded bg-gray-200" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (scanTypes.length === 0) {
    return null;
  }

  const statsMap = new Map(stats.map((s) => [s.scan_type, s.count]));

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs md:grid-cols-3 lg:grid-cols-4">
      {scanTypes.map((scanType) => {
        const Icon = categoryIcons[scanType.category] ?? UserCheck;
        const count = statsMap.get(scanType.name) ?? 0;

        return (
          <Card key={scanType.name} className="@container/card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardDescription>{scanType.display_name}</CardDescription>
                <Icon className="size-5 text-muted-foreground" />
              </div>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {count}
              </CardTitle>
              <p className="text-sm capitalize text-muted-foreground">
                {scanType.category.replace("_", " ")}
              </p>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}
