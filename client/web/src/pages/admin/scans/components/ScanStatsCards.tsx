import { Gift, MoreHorizontal, UserCheck, Utensils } from "lucide-react";

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
  other: MoreHorizontal,
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
      <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="p-4">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="mt-1 h-6 w-12 rounded bg-muted" />
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
    <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
      {scanTypes.map((scanType) => {
        const Icon = categoryIcons[scanType.category] ?? UserCheck;
        const count = statsMap.get(scanType.name) ?? 0;

        return (
          <Card key={scanType.name}>
            <CardHeader className="px-4 py-0">
              <div className="flex items-center justify-between">
                <CardDescription>{scanType.display_name}</CardDescription>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-xl font-semibold tabular-nums">
                {count}
              </CardTitle>
              <p className="text-xs capitalize text-muted-foreground">
                {scanType.category.replace("_", " ")}
              </p>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}
