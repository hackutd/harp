import {
  Gift,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  ScanLine,
  Trash2,
  UserCheck,
  Utensils,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { ScanStat, ScanType, ScanTypeCategory } from "../types";

function toSnakeCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function validate(types: ScanType[]): string | null {
  if (types.some((st) => !st.display_name.trim() || !st.name.trim())) {
    return "All scan types must have a name";
  }
  const names = types.map((st) => st.name.trim());
  if (new Set(names).size !== names.length) {
    return "Scan type names must be unique";
  }
  const checkInCount = types.filter((st) => st.category === "check_in").length;
  if (checkInCount !== 1) {
    return "Exactly one scan type must have the check_in category";
  }
  return null;
}

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

const categoryOptions = [
  { value: "check_in", label: "Check In" },
  { value: "meal", label: "Meal" },
  { value: "swag", label: "Swag" },
  { value: "other", label: "Other" },
] as const;

interface ScanTypesTableProps {
  scanTypes: ScanType[];
  stats: ScanStat[];
  isSuperAdmin: boolean;
  saving: boolean;
  onSelect: (scanType: ScanType) => void;
  onSave: (
    scanTypes: ScanType[],
  ) => Promise<{ success: boolean; error?: string }>;
}

export function ScanTypesTable({
  scanTypes,
  stats,
  isSuperAdmin,
  saving,
  onSelect,
  onSave,
}: ScanTypesTableProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [pendingNew, setPendingNew] = useState<ScanType | null>(null);
  const editRowRef = useRef<HTMLTableRowElement>(null);

  // When there's a pending new row, append it so it renders in the table
  const effectiveTypes = pendingNew ? [...scanTypes, pendingNew] : scanTypes;

  const displayTypes = isSuperAdmin
    ? effectiveTypes
    : effectiveTypes.filter((st) => st.is_active);

  const statsMap = new Map(stats.map((s) => [s.scan_type, s.count]));

  const startEditing = (index: number) => {
    setEditingIndex(index);
    if (scanTypes[index]) {
      setEditDisplayName(scanTypes[index].display_name);
    }
  };

  const saveDisplayName = useCallback(() => {
    if (editingIndex === null) return;

    const trimmed = editDisplayName.trim();

    // Pending new row — save only if user typed something, otherwise no-op
    if (pendingNew) {
      if (!trimmed) return;
      const newType: ScanType = {
        ...pendingNew,
        display_name: trimmed,
        name: toSnakeCase(trimmed),
      };
      const updated = [...scanTypes, newType];

      const error = validate(updated);
      if (error) {
        toast.error(error);
        return;
      }

      setPendingNew(null);
      onSave(updated);
      return;
    }

    // Editing an existing row
    const current = scanTypes[editingIndex];
    if (!current) return;

    // No change — skip save
    if (trimmed === current.display_name) return;

    const updated = scanTypes.map((st, i) =>
      i === editingIndex
        ? { ...st, display_name: trimmed, name: toSnakeCase(trimmed) }
        : st,
    );

    const error = validate(updated);
    if (error) {
      toast.error(error);
      return;
    }

    onSave(updated);
  }, [editingIndex, editDisplayName, scanTypes, pendingNew, onSave]);

  // Ref to avoid stale closures in event listeners
  const saveDisplayNameRef = useRef(saveDisplayName);
  useEffect(() => {
    saveDisplayNameRef.current = saveDisplayName;
  }, [saveDisplayName]);

  const closeEditing = useCallback(() => {
    saveDisplayNameRef.current();
    setPendingNew(null);
    setEditingIndex(null);
  }, []);

  const saveCategory = (index: number, category: ScanTypeCategory) => {
    if (effectiveTypes[index].category === category) return;

    // For pending new row, just update the pending state
    if (pendingNew && index === scanTypes.length) {
      setPendingNew({ ...pendingNew, category });
      return;
    }

    const updated = scanTypes.map((st, i) =>
      i === index ? { ...st, category } : st,
    );

    const error = validate(updated);
    if (error) {
      toast.error(error);
      return;
    }

    onSave(updated);
  };

  const saveActive = (index: number, isActive: boolean) => {
    if (effectiveTypes[index].is_active === isActive) return;

    // For pending new row, just update the pending state
    if (pendingNew && index === scanTypes.length) {
      setPendingNew({ ...pendingNew, is_active: isActive });
      return;
    }

    const updated = scanTypes.map((st, i) =>
      i === index ? { ...st, is_active: isActive } : st,
    );

    onSave(updated);
  };

  const handleAdd = () => {
    const newType: ScanType = {
      name: "",
      display_name: "",
      category: "other",
      is_active: true,
    };
    setPendingNew(newType);
    setEditingIndex(scanTypes.length);
    setEditDisplayName("");
  };

  const handleDelete = (index: number) => {
    // Deleting the pending new row — just discard it
    if (pendingNew && index === scanTypes.length) {
      setPendingNew(null);
      setEditingIndex(null);
      return;
    }

    const updated = scanTypes.filter((_, i) => i !== index);

    const error = validate(updated);
    if (error) {
      toast.error(error);
      return;
    }

    onSave(updated);
    setEditingIndex(null);
  };

  // Close editing when clicking outside the row
  useEffect(() => {
    if (editingIndex === null) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Don't close edit row if clicking inside a dialog overlay (e.g. delete confirmation)
      if ((target as Element).closest?.("[role='alertdialog']")) return;
      if ((target as Element).closest?.("[data-radix-portal]")) return;
      if (editRowRef.current && !editRowRef.current.contains(target)) {
        closeEditing();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPendingNew(null);
        setEditingIndex(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [editingIndex, closeEditing]);

  if (displayTypes.length === 0 && !isSuperAdmin) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No active scan types configured. Ask a super admin to set them up.
      </div>
    );
  }

  return (
    <Card className="overflow-hidden flex flex-col">
      <CardHeader className="shrink-0 flex flex-row items-center justify-between">
        <CardDescription className="font-light">
          {displayTypes.length} scan type(s){" "}
          {isSuperAdmin ? "configured" : "available"}
        </CardDescription>
        {saving && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden">
        <div className="relative overflow-auto h-full p-6 pt-0 pb-3">
          <Table className="border-collapse [&_th]:border-r [&_th]:border-gray-200 [&_td]:border-r [&_td]:border-gray-200 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0">
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-24">Action</TableHead>
                <TableHead className="w-48">Name</TableHead>
                <TableHead className="w-150">Category</TableHead>
                <TableHead className="w-24">Scans</TableHead>
                {isSuperAdmin && <TableHead>Active</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayTypes.map((scanType, index) => {
                const isEditing = isSuperAdmin && editingIndex === index;
                const Icon = categoryIcons[scanType.category] ?? UserCheck;
                const count = statsMap.get(scanType.name) ?? 0;

                if (isEditing) {
                  return (
                    <TableRow
                      key={scanType.name || `new-${index}`}
                      ref={editRowRef}
                      className="[&>td]:py-3 bg-muted/30"
                    >
                      <TableCell>
                        <Button
                          className="bg-indigo-400 hover:bg-indigo-700 cursor-pointer"
                          size="sm"
                          disabled={!scanType.is_active}
                          onClick={() => onSelect(scanType)}
                        >
                          <ScanLine className="mr-1 size-3" />
                          Scan
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          onBlur={(e) => {
                            // Don't save on blur if focus moved to another element in the edit row —
                            // the category/active/delete buttons handle their own saves
                            if (
                              editRowRef.current?.contains(
                                e.relatedTarget as Node,
                              )
                            )
                              return;
                            saveDisplayName();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              closeEditing();
                            }
                          }}
                          placeholder="e.g. Sunday Lunch"
                          className="h-8 text-sm font-light shadow-none bg-transparent pl-2 rounded-sm focus-visible:ring-1"
                          autoFocus
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {categoryOptions.map((opt) => {
                            const CatIcon =
                              categoryIcons[opt.value as ScanTypeCategory];
                            const isSelected = scanType.category === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() =>
                                  saveCategory(
                                    index,
                                    opt.value as ScanTypeCategory,
                                  )
                                }
                                className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-sm cursor-pointer transition-opacity ${
                                  categoryColors[opt.value as ScanTypeCategory]
                                } ${isSelected ? "opacity-100 ring-1 ring-current" : "opacity-40 hover:opacity-70"}`}
                              >
                                <CatIcon className="size-3" />
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">{count}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => saveActive(index, true)}
                              className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded-sm cursor-pointer transition-opacity bg-green-100 text-green-800 ${
                                scanType.is_active
                                  ? "opacity-100 ring-1 ring-current"
                                  : "opacity-40 hover:opacity-70"
                              }`}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => saveActive(index, false)}
                              className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded-sm cursor-pointer transition-opacity bg-red-100 text-red-800 ${
                                !scanType.is_active
                                  ? "opacity-100 ring-1 ring-current"
                                  : "opacity-40 hover:opacity-70"
                              }`}
                            >
                              No
                            </button>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-red-500 cursor-pointer"
                            onClick={() => setDeleteIndex(index)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <TableRow
                    key={scanType.name || index}
                    className={`group [&>td]:py-3 ${
                      isSuperAdmin ? "cursor-pointer hover:bg-muted/50" : ""
                    } ${!scanType.is_active ? "opacity-50" : ""}`}
                    onClick={
                      isSuperAdmin ? () => startEditing(index) : undefined
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          className="bg-indigo-400 hover:bg-indigo-700 text-white cursor-pointer"
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {isSuperAdmin && (
            <Button
              variant="outline"
              onClick={handleAdd}
              className="w-full mt-3 border-dashed cursor-pointer"
            >
              <Plus className="size-4 mr-2" />
              Add Scan Type
            </Button>
          )}
        </div>
      </CardContent>

      <AlertDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteIndex(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scan type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {deleteIndex !== null
                  ? effectiveTypes[deleteIndex]?.display_name ||
                    "this scan type"
                  : "this scan type"}
              </strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 cursor-pointer"
              onClick={() => {
                if (deleteIndex !== null) handleDelete(deleteIndex);
                setDeleteIndex(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
