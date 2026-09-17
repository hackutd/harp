import {
  Pencil,
  Plus,
  RefreshCw,
  ScanLine,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePointsConfigStore } from "@/shared/stores";

import type { ScanStat, ScanType } from "../types";
import { categoryColors, categoryIcons, toSnakeCase, validate } from "../utils";
import type { ScanTypeFormValues } from "./ScanTypeFormDialog";
import { ScanTypeFormDialog } from "./ScanTypeFormDialog";

interface ScanTypesTableProps {
  scanTypes: ScanType[];
  stats: ScanStat[];
  isSuperAdmin: boolean;
  saving: boolean;
  rebalancing: boolean;
  onSelect: (scanType: ScanType) => void;
  onSave: (
    scanTypes: ScanType[],
  ) => Promise<{ success: boolean; error?: string }>;
  onRebalance: () => void;
}

export function ScanTypesTable({
  scanTypes,
  stats,
  isSuperAdmin,
  saving,
  rebalancing,
  onSelect,
  onSave,
  onRebalance,
}: ScanTypesTableProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ScanType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScanType | null>(null);
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const pointsName = usePointsConfigStore((s) => s.pointsName);

  const displayTypes = isSuperAdmin
    ? scanTypes
    : scanTypes.filter((st) => st.is_active);

  const statsMap = new Map(stats.map((s) => [s.scan_type, s.count]));

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (scanType: ScanType) => {
    if (!isSuperAdmin) return;
    setEditTarget(scanType);
    setFormOpen(true);
  };

  const handleSubmit = async (values: ScanTypeFormValues) => {
    let updated: ScanType[];

    if (editTarget) {
      // Only re-derive `name` when the display name actually changed — it's the
      // key historical scans and scan_stats are keyed by, so a points-only edit
      // must not rename the scan type.
      const nameChanged = values.display_name !== editTarget.display_name;
      updated = scanTypes.map((st) =>
        st.name === editTarget.name
          ? {
              ...st,
              display_name: values.display_name,
              name: nameChanged ? toSnakeCase(values.display_name) : st.name,
              category: values.category,
              points: values.points,
              is_active: values.is_active,
            }
          : st,
      );
    } else {
      updated = [
        ...scanTypes,
        {
          name: toSnakeCase(values.display_name),
          display_name: values.display_name,
          category: values.category,
          points: values.points,
          is_active: values.is_active,
        },
      ];
    }

    const error = validate(updated);
    if (error) {
      toast.error(error);
      return;
    }

    const result = await onSave(updated);
    if (result.success) {
      toast.success(editTarget ? "Scan type updated" : "Scan type created");
      setFormOpen(false);
    } else {
      toast.error(result.error ?? "Failed to save scan types");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const updated = scanTypes.filter((st) => st.name !== deleteTarget.name);
    setDeleteTarget(null);

    const error = validate(updated);
    if (error) {
      toast.error(error);
      return;
    }

    const result = await onSave(updated);
    if (result.success) {
      toast.success("Scan type deleted");
    } else {
      toast.error(result.error ?? "Failed to delete scan type");
    }
  };

  if (displayTypes.length === 0 && !isSuperAdmin) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No active scan types configured. Ask a super admin to set them up.
      </div>
    );
  }

  return (
    <Card className="overflow-hidden flex flex-col">
      <CardHeader className="shrink-0 flex flex-row items-center justify-between gap-2">
        <CardDescription className="font-light">
          {displayTypes.length} scan type(s){" "}
          {isSuperAdmin ? "configured" : "available"}
        </CardDescription>
        <div className="flex items-center gap-2">
          {saving && <Skeleton className="size-4 rounded-full" />}
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            loading={rebalancing}
            onClick={() => setRebalanceOpen(true)}
          >
            {!rebalancing && <RefreshCw className="size-3.5" />}
            Rebalance
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden">
        <div className="relative overflow-auto h-full p-6 pt-0 pb-3">
          <Table className="border-collapse [&_th]:border-r [&_th]:border-gray-200 [&_td]:border-r [&_td]:border-gray-200 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0">
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-24">Action</TableHead>
                <TableHead className="w-48">Name</TableHead>
                <TableHead className="w-150">Category</TableHead>
                <TableHead className="w-24">{pointsName}</TableHead>
                <TableHead className="w-24">Scans</TableHead>
                {isSuperAdmin && <TableHead>Active</TableHead>}
                {isSuperAdmin && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayTypes.map((scanType, index) => {
                const Icon = categoryIcons[scanType.category] ?? UserCheck;
                const count = statsMap.get(scanType.name) ?? 0;

                return (
                  <TableRow
                    key={scanType.name || index}
                    className={`group [&>td]:py-3 ${
                      isSuperAdmin ? "cursor-pointer hover:bg-muted/50" : ""
                    } ${!scanType.is_active ? "opacity-50" : ""}`}
                    onClick={
                      isSuperAdmin ? () => openEdit(scanType) : undefined
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          className="cursor-pointer"
                          size="sm"
                          disabled={!scanType.is_active}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(scanType);
                          }}
                        >
                          <ScanLine className="mr-1 size-3" />
                          Scan
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-normal">
                      <div className="flex items-center justify-between gap-4">
                        <span>{scanType.display_name || "-"}</span>
                        {isSuperAdmin && (
                          <Pencil className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        <Badge
                          variant="secondary"
                          className={`text-xs px-1.5 py-0 ${categoryColors[scanType.category]}`}
                        >
                          {scanType.category.replace("_", " ")}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {scanType.points ?? 0}
                    </TableCell>
                    <TableCell className="tabular-nums">{count}</TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-xs px-1.5 py-0 ${
                            scanType.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {scanType.is_active ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                    )}
                    {isSuperAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="cursor-pointer text-muted-foreground hover:text-red-500 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(scanType);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {isSuperAdmin && (
            <Button
              variant="outline"
              onClick={openCreate}
              className="w-full mt-3 border-dashed cursor-pointer"
            >
              <Plus className="size-4 mr-2" />
              Add Scan Type
            </Button>
          )}
        </div>
      </CardContent>

      <ScanTypeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        scanType={editTarget}
        saving={saving}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scan type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget?.display_name || "this scan type"}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 cursor-pointer"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rebalanceOpen} onOpenChange={setRebalanceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rebalance scan counts?</AlertDialogTitle>
            <AlertDialogDescription>
              This recomputes every scan count from scratch against the
              database. It&apos;s an expensive operation and should only be used
              when you need to verify the actual counts are accurate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              onClick={() => onRebalance()}
            >
              Rebalance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
