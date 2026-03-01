import {
  Gift,
  MoreHorizontal,
  ScanLine,
  UserCheck,
  Utensils,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { ScanType, ScanTypeCategory } from "../types";

const categoryIcons: Record<ScanTypeCategory, typeof UserCheck> = {
  check_in: UserCheck,
  meal: Utensils,
  swag: Gift,
  other: MoreHorizontal,
};

const categoryColors: Record<ScanTypeCategory, string> = {
  check_in: "bg-blue-100 text-blue-800",
  meal: "bg-orange-100 text-orange-800",
  swag: "bg-purple-100 text-purple-800",
  other: "bg-gray-100 text-gray-800",
};

interface ScanTypeGridProps {
  scanTypes: ScanType[];
  onSelect: (scanType: ScanType) => void;
}

export function ScanTypeGrid({ scanTypes, onSelect }: ScanTypeGridProps) {
  const activeTypes = scanTypes.filter((st) => st.is_active);

  if (activeTypes.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No active scan types configured. Ask a super admin to set them up.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {activeTypes.map((scanType) => {
        const Icon = categoryIcons[scanType.category] ?? UserCheck;

        return (
          <Card key={scanType.name}>
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center gap-1">
                <Icon className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium truncate">
                  {scanType.display_name}
                </CardTitle>
              </div>
              <Badge
                variant="secondary"
                className={`w-fit text-xs px-1.5 py-0 ${categoryColors[scanType.category]}`}
              >
                {scanType.category.replace("_", " ")}
              </Badge>
              <CardDescription className="sr-only">
                {scanType.name}
              </CardDescription>
            </CardHeader>
            <div className="px-4">
              <Button
                className="w-full bg-slate-700 cursor-pointer"
                size="sm"
                onClick={() => onSelect(scanType)}
              >
                <ScanLine className="mr-1 size-3" />
                Scan
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
