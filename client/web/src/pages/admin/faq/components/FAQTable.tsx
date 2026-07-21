import { Code, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/shared/lib/utils";

import { fetchFAQs } from "../api";
import type { FAQ, FAQPayload } from "../types";
import { FAQFormDialog } from "./FAQFormDialog";

interface FAQTableProps {
  faqs: FAQ[];
  saving: boolean;
  canEdit: boolean;
  onCreateFAQ: (payload: FAQPayload) => Promise<string | null>;
  onUpdateFAQ: (id: string, payload: FAQPayload) => Promise<boolean>;
  onDeleteFAQ: (id: string) => Promise<boolean>;
}

export function FAQTable({
  faqs,
  saving,
  canEdit,
  onCreateFAQ,
  onUpdateFAQ,
  onDeleteFAQ,
}: FAQTableProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FAQ | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FAQ | null>(null);
  const [jsonPopoverOpen, setJsonPopoverOpen] = useState(false);
  const [loadingJson, setLoadingJson] = useState(false);
  const [jsonResponse, setJsonResponse] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const loadJsonResponse = useCallback(async () => {
    setLoadingJson(true);
    setJsonError(null);

    const response = await fetchFAQs();

    if (response.status === 200 && response.data) {
      setJsonResponse(
        JSON.stringify({ data: { faqs: response.data.faqs } }, null, 2),
      );
    } else {
      setJsonResponse("");
      setJsonError(response.error ?? "Failed to fetch FAQs.");
    }

    setLoadingJson(false);
  }, []);

  const handleJsonPopoverOpenChange = useCallback(
    (open: boolean) => {
      setJsonPopoverOpen(open);
      if (open) {
        void loadJsonResponse();
      }
    },
    [loadJsonResponse],
  );

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (faq: FAQ) => {
    if (!canEdit) return;
    setEditTarget(faq);
    setFormOpen(true);
  };

  // Errors (including a 403 when a super admin has disabled admin FAQ editing)
  // are surfaced by the store via errorAlert, so only success is handled here.
  const handleSubmit = async (payload: FAQPayload) => {
    if (editTarget) {
      const success = await onUpdateFAQ(editTarget.id, payload);
      if (success) {
        toast.success("FAQ updated");
        setFormOpen(false);
      }
    } else {
      const id = await onCreateFAQ(payload);
      if (id) {
        toast.success("FAQ created");
        setFormOpen(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const success = await onDeleteFAQ(deleteTarget.id);
    if (success) {
      toast.success("FAQ deleted");
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <Card className="overflow-hidden flex flex-col h-full min-h-0">
        <CardHeader className="shrink-0 flex flex-row items-center justify-between">
          <CardDescription className="font-light">
            {faqs.length} FAQ(s) configured
          </CardDescription>
          <div className="flex items-center gap-2">
            {saving && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
            <Popover
              open={jsonPopoverOpen}
              onOpenChange={handleJsonPopoverOpenChange}
            >
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="cursor-pointer">
                  <Code className="mr-1 size-4" />
                  Preview API
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(90vw,640px)] p-3">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    <code>GET /v1/public/faq</code>
                  </p>
                  {loadingJson ? (
                    <p className="text-sm text-muted-foreground">
                      Loading JSON response...
                    </p>
                  ) : jsonError ? (
                    <p className="text-sm text-destructive">{jsonError}</p>
                  ) : (
                    <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                      {jsonResponse}
                    </pre>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              onClick={openCreate}
              disabled={!canEdit}
              className="cursor-pointer"
            >
              <Plus className="mr-1 size-4" />
              Add FAQ
            </Button>
          </div>
        </CardHeader>
        {!canEdit && (
          <div className="mx-6 mb-3 shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            A super admin has disabled FAQ editing for admins. You can view FAQs
            but can&apos;t add, edit, or delete them.
          </div>
        )}
        <CardContent className="p-0 flex-1 overflow-hidden">
          <div className="relative overflow-auto h-full p-6 pt-0 pb-3">
            {faqs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No FAQs yet. Click &quot;Add FAQ&quot; to get started.
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-16">Order</TableHead>
                    <TableHead className="w-72">Question</TableHead>
                    <TableHead>Answer</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faqs.map((faq) => (
                    <TableRow
                      key={faq.id}
                      className={cn(
                        "group [&>td]:py-3",
                        canEdit && "cursor-pointer hover:bg-muted/50",
                      )}
                      onClick={canEdit ? () => openEdit(faq) : undefined}
                    >
                      <TableCell className="tabular-nums">
                        {faq.display_order}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{faq.question}</span>
                          {canEdit && (
                            <Pencil className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground line-clamp-2 block max-w-xl whitespace-pre-line">
                          {faq.answer}
                        </span>
                      </TableCell>
                      <TableCell>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="cursor-pointer text-muted-foreground hover:text-red-500 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(faq);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <FAQFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        faq={editTarget}
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
            <AlertDialogTitle>Delete FAQ</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this FAQ? This action cannot be
              undone.
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
    </>
  );
}
