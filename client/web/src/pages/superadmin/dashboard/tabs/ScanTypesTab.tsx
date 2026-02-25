import { Loader2, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ScanType {
  name: string;
  display_name: string;
  category: "check_in" | "meal" | "swag";
  is_active: boolean;
}

const categoryOptions = [
  { value: "check_in", label: "Check In" },
  { value: "meal", label: "Meal" },
  { value: "swag", label: "Swag" },
] as const;

interface ScanTypesTabProps {
  scanTypes: ScanType[];
  setScanTypes: React.Dispatch<React.SetStateAction<ScanType[]>>;
  loading: boolean;
}

export function ScanTypesTab({
  scanTypes,
  setScanTypes,
  loading,
}: ScanTypesTabProps) {
  const updateScanType = (
    index: number,
    field: keyof ScanType,
    value: string | boolean,
  ) => {
    setScanTypes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const addScanType = () => {
    setScanTypes((prev) => [
      ...prev,
      {
        name: "",
        display_name: "",
        category: "check_in" as const,
        is_active: true,
      },
    ]);
  };

  const removeScanType = (index: number) => {
    setScanTypes((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg text-zinc-100">Scan Types</h3>
      <p className="text-sm text-zinc-400">
        Configure the scan types available for check-ins, meals, and swag
        distribution.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          {scanTypes.map((scanType, index) => (
            <div
              key={index}
              className="bg-zinc-900 rounded-md p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <Label className="text-xs text-zinc-500">Name</Label>
                  <Input
                    value={scanType.name}
                    onChange={(e) =>
                      updateScanType(index, "name", e.target.value)
                    }
                    placeholder="e.g. sunday_lunch"
                    className="bg-zinc-800 border-0 rounded-sm text-zinc-100 placeholder:text-zinc-500"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="text-xs text-zinc-500">Display Name</Label>
                  <Input
                    value={scanType.display_name}
                    onChange={(e) =>
                      updateScanType(index, "display_name", e.target.value)
                    }
                    placeholder="e.g. Sunday Lunch"
                    className="bg-zinc-800 border-0 rounded-sm text-zinc-100 placeholder:text-zinc-500"
                  />
                </div>
                <div className="w-36 space-y-2">
                  <Label className="text-xs text-zinc-500">Category</Label>
                  <Select
                    value={scanType.category}
                    onValueChange={(value) =>
                      updateScanType(index, "category", value)
                    }
                  >
                    <SelectTrigger className="w-full bg-zinc-800 border-0 rounded-sm text-zinc-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`active-${index}`}
                    checked={scanType.is_active}
                    onCheckedChange={(checked) =>
                      updateScanType(index, "is_active", checked === true)
                    }
                    className="border-zinc-500 cursor-pointer data-[state=checked]:bg-zinc-100 data-[state=checked]:text-zinc-900 data-[state=checked]:border-zinc-100"
                  />
                  <Label
                    htmlFor={`active-${index}`}
                    className="text-sm text-zinc-300 cursor-pointer"
                  >
                    Active
                  </Label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeScanType(index)}
                  className="text-zinc-500 hover:text-red-400 hover:bg-transparent cursor-pointer h-8 w-8 p-0"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={addScanType}
            className="w-full border-dashed border-zinc-700 bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 cursor-pointer"
          >
            <Plus className="size-4 mr-2" />
            Add Scan Type
          </Button>
        </div>
      )}
    </div>
  );
}
