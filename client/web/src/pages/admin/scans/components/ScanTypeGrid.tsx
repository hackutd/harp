import { Gift, MoreHorizontal, ScanLine, UserCheck, Utensils } from "lucide-react";

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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {activeTypes.map((scanType) => {
        const Icon = categoryIcons[scanType.category] ?? UserCheck;

        return (
          <Card key={scanType.name} className="flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="size-5 text-muted-foreground" />
                  <CardTitle className="text-lg">
                    {scanType.display_name}
                  </CardTitle>
                </div>
                <Badge
                  variant="secondary"
                  className={categoryColors[scanType.category]}
                >
                  {scanType.category.replace("_", " ")}
                </Badge>
              </div>
              <CardDescription className="sr-only">
                {scanType.name}
              </CardDescription>
            </CardHeader>
            <div className="p-6 pt-0">
              <Button className="w-full" onClick={() => onSelect(scanType)}>
                <ScanLine className="mr-2 size-4" />
                Start Scanning
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
