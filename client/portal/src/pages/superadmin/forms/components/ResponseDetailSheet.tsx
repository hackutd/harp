import {
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  FileText,
  Loader2,
  ReceiptText,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApplicationListItem } from "@/pages/admin/all-applicants/types";
import { formatName } from "@/pages/admin/all-applicants/utils";
import {
  fetchTravelReceiptURLs,
  setApplicationTravelStatus,
  type TravelReceiptURL,
} from "@/pages/superadmin/reviews/grading/api";
import { errorAlert, getRequest } from "@/shared/lib/api";
import { formatResponseValue, isFieldVisible } from "@/shared/lib/schema-utils";
import type { Application, ApplicationSchemaField } from "@/types";

import { formatCurrency, formatDateTime } from "../config";
import type { FormKey } from "../types";

interface ResponseDetailSheetProps {
  form: FormKey;
  item: ApplicationListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onUpdated: () => void;
}

const schemaEndpoints: Record<FormKey, string> = {
  application: "/superadmin/settings/application-schema",
  rsvp: "/superadmin/settings/rsvp-schema",
  travel: "/superadmin/settings/travel-rsvp-schema",
};

function responseFor(form: FormKey, application: Application) {
  if (form === "application") return application.responses ?? {};
  if (form === "rsvp") return application.rsvp_responses ?? {};
  return application.travel_rsvp_responses ?? {};
}

function statusFor(form: FormKey, item: ApplicationListItem) {
  if (form === "application") return item.status;
  if (form === "rsvp") return item.rsvp_status;
  return item.travel_rsvp_status;
}

function ReceiptViewer({
  receipts,
  index,
  onIndexChange,
  canNextPerson,
  onNextPerson,
}: {
  receipts: TravelReceiptURL[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  canNextPerson: boolean;
  onNextPerson: () => void;
}) {
  const receipt = index == null ? null : receipts[index];
  const path = receipt?.path.toLowerCase() ?? "";
  const isPDF = path.endsWith(".pdf");

  return (
    <Dialog
      open={receipt != null}
      onOpenChange={(open) => !open && onIndexChange(null)}
    >
      <DialogContent className="flex h-[90vh] max-w-5xl flex-col p-0">
        <DialogHeader className="border-b px-6 py-4 pr-12">
          <DialogTitle>
            Receipt {index == null ? "" : `${index + 1} of ${receipts.length}`}
          </DialogTitle>
          <DialogDescription>
            Review the submitted file without losing your place in the queue.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 bg-muted/40 p-3">
          {receipt &&
            (isPDF ? (
              <iframe
                title={`Receipt ${index! + 1}`}
                src={receipt.download_url}
                className="h-full w-full rounded-md border bg-white"
              />
            ) : (
              <div className="flex h-full items-center justify-center overflow-auto rounded-md border bg-white p-3">
                <img
                  src={receipt.download_url}
                  alt={`Receipt ${index! + 1}`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ))}
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            disabled={index == null || index === 0}
            onClick={() => index != null && onIndexChange(index - 1)}
          >
            <ChevronLeft className="size-4" />
            Previous receipt
          </Button>
          {receipt && (
            <Button variant="ghost" size="sm" asChild>
              <a href={receipt.download_url} target="_blank" rel="noreferrer">
                Open original
                <ExternalLink className="size-4" />
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={
              index == null || (index >= receipts.length - 1 && !canNextPerson)
            }
            onClick={() => {
              if (index == null) return;
              if (index < receipts.length - 1) onIndexChange(index + 1);
              else onNextPerson();
            }}
          >
            {index != null && index >= receipts.length - 1
              ? canNextPerson
                ? "Next person’s receipts"
                : "Last receipt"
              : "Next receipt"}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ResponseDetailSheet({
  form,
  item,
  open,
  onOpenChange,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  onUpdated,
}: ResponseDetailSheetProps) {
  const [application, setApplication] = useState<Application | null>(null);
  const [failedApplicationId, setFailedApplicationId] = useState<string | null>(
    null,
  );
  const [schema, setSchema] = useState<ApplicationSchemaField[]>([]);
  const [receipts, setReceipts] = useState<TravelReceiptURL[]>([]);
  const [receiptIndex, setReceiptIndex] = useState<number | null>(null);
  const [amountOpen, setAmountOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [savingAmount, setSavingAmount] = useState(false);
  const openNextPersonReceipts = useRef(false);

  useEffect(() => {
    if (!open || !item) return;
    const controller = new AbortController();

    const load = async () => {
      const [detailResult, schemaResult, receiptResult] = await Promise.all([
        getRequest<Application>(
          `/admin/applications/${item.id}`,
          "application",
          controller.signal,
        ),
        getRequest<{ fields: ApplicationSchemaField[] }>(
          schemaEndpoints[form],
          "form schema",
          controller.signal,
        ),
        form === "travel" && item.receipt_count > 0
          ? fetchTravelReceiptURLs(item.id, controller.signal)
          : Promise.resolve(null),
      ]);
      if (controller.signal.aborted) return;
      if (detailResult.status === 200 && detailResult.data) {
        setApplication(detailResult.data);
        setFailedApplicationId(null);
      } else {
        setFailedApplicationId(item.id);
        errorAlert(detailResult);
      }
      if (schemaResult.status === 200 && schemaResult.data) {
        setSchema(schemaResult.data.fields ?? []);
      }
      if (receiptResult?.status === 200 && receiptResult.data) {
        const nextReceipts = receiptResult.data.receipts ?? [];
        setReceipts(nextReceipts);
        setReceiptIndex(
          openNextPersonReceipts.current && nextReceipts.length > 0 ? 0 : null,
        );
      } else {
        setReceipts([]);
        setReceiptIndex(null);
      }
      openNextPersonReceipts.current = false;
    };

    load();
    return () => controller.abort();
  }, [form, item, open]);

  const visibleFields = useMemo(() => {
    if (!application) return [];
    const responses = responseFor(form, application);
    return [...schema]
      .sort((a, b) => a.display_order - b.display_order)
      .filter((field) => isFieldVisible(field, responses));
  }, [application, form, schema]);

  const openAmountDialog = () => {
    if (!item) return;
    const cents =
      application?.travel_approved_amount_cents ??
      item.travel_approved_amount_cents ??
      item.estimated_travel_cost_cents;
    setAmount(cents ? (cents / 100).toFixed(2) : "");
    setAmountError(null);
    setAmountOpen(true);
  };

  const saveAmount = async () => {
    if (!item) return;
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setAmountError("Enter an approved amount greater than $0.");
      return;
    }

    setSavingAmount(true);
    const result = await setApplicationTravelStatus(
      item.id,
      "approved",
      Math.round(dollars * 100),
    );
    setSavingAmount(false);
    if (result.status === 200 && result.data) {
      setApplication(result.data.application);
      setAmountOpen(false);
      toast.success("Approved travel amount saved");
      onUpdated();
    } else {
      errorAlert(result);
    }
  };

  const responses = application ? responseFor(form, application) : {};
  const submittedAt =
    form === "application"
      ? item?.submitted_at
      : form === "rsvp"
        ? item?.rsvp_submitted_at
        : item?.travel_rsvp_submitted_at;
  const approvedAmount =
    application?.travel_approved_amount_cents ??
    item?.travel_approved_amount_cents;
  const loading =
    open &&
    !!item &&
    application?.id !== item.id &&
    failedApplicationId !== item.id;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-3xl">
          <SheetHeader className="border-b px-6 py-4 pr-14">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <SheetTitle className="truncate text-lg">
                  {item
                    ? formatName(item.first_name, item.last_name)
                    : "Response"}
                </SheetTitle>
                <SheetDescription className="truncate">
                  {item?.email}
                </SheetDescription>
              </div>
              {item && (
                <Badge variant="outline" className="shrink-0 capitalize">
                  {statusFor(form, item).replace("_", " ")}
                </Badge>
              )}
            </div>
          </SheetHeader>

          <div className="flex items-center justify-between border-b px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!canPrevious}
              onClick={onPrevious}
            >
              <ChevronLeft className="size-4" />
              Previous person
            </Button>
            <p className="text-xs text-muted-foreground">
              Submitted {formatDateTime(submittedAt)}
            </p>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canNext}
              onClick={onNext}
            >
              Next person
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-6 p-6">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : application && item && application.id === item.id ? (
                <>
                  {form === "travel" && (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="flex items-center gap-2 font-medium">
                            <CircleDollarSign className="size-4 text-muted-foreground" />
                            Reimbursement amounts
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            The requested estimate and approved amount are
                            separate values.
                          </p>
                        </div>
                        {item.travel_status !== "not_requested" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={openAmountDialog}
                          >
                            {approvedAmount
                              ? "Edit approved amount"
                              : "Approve amount"}
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          {
                            label: "Requested estimate",
                            value: item.estimated_travel_cost_cents,
                          },
                          {
                            label: "Approved commitment",
                            value: approvedAmount,
                          },
                        ].map((metric) => (
                          <div
                            key={metric.label}
                            className="rounded-lg border p-3"
                          >
                            <p className="text-xs text-muted-foreground">
                              {metric.label}
                            </p>
                            <p className="mt-1 text-lg font-semibold tabular-nums">
                              {formatCurrency(metric.value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <FileText className="size-4 text-muted-foreground" />
                      <h3 className="font-medium">Submitted answers</h3>
                    </div>
                    {visibleFields.length > 0 ? (
                      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        {visibleFields.map((field) => (
                          <div
                            key={field.id}
                            className={
                              field.type === "textarea" ? "sm:col-span-2" : ""
                            }
                          >
                            <Label className="text-xs text-muted-foreground">
                              {field.label}
                            </Label>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                              {formatResponseValue(responses[field.id], field)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                        No submitted answers for this form yet.
                      </p>
                    )}
                  </section>

                  {form === "travel" && (
                    <section>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="flex items-center gap-2 font-medium">
                            <ReceiptText className="size-4 text-muted-foreground" />
                            Receipts
                            <Badge variant="secondary">{receipts.length}</Badge>
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Open a receipt, then move through every file in
                            place.
                          </p>
                        </div>
                        {receipts.length > 0 && (
                          <Button size="sm" onClick={() => setReceiptIndex(0)}>
                            Review receipts
                          </Button>
                        )}
                      </div>
                      {receipts.length > 0 ? (
                        <div className="space-y-2">
                          {receipts.map((receipt, index) => (
                            <button
                              key={receipt.path}
                              type="button"
                              onClick={() => setReceiptIndex(index)}
                              className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <FileText className="size-4 shrink-0 text-muted-foreground" />
                                <span className="truncate text-sm">
                                  Receipt {index + 1}
                                </span>
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Preview
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                          No receipts submitted.
                        </p>
                      )}
                    </section>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This response could not be loaded.
                </p>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <ReceiptViewer
        receipts={receipts}
        index={receiptIndex}
        onIndexChange={setReceiptIndex}
        canNextPerson={canNext}
        onNextPerson={() => {
          openNextPersonReceipts.current = true;
          setReceiptIndex(null);
          onNext();
        }}
      />

      <AlertDialog open={amountOpen} onOpenChange={setAmountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set approved reimbursement</AlertDialogTitle>
            <AlertDialogDescription>
              This is the maximum amount committed to this individual. It does
              not change what they requested or what their receipts claim.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
              <div>
                <p className="text-muted-foreground">Requested</p>
                <p className="font-medium">
                  {formatCurrency(item?.estimated_travel_cost_cents)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Currently approved</p>
                <p className="font-medium">{formatCurrency(approvedAmount)}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="response-approved-amount">
                Approved amount (USD)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="response-approved-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setAmountError(null);
                  }}
                  className="pl-7"
                  autoFocus
                />
              </div>
              {amountError && (
                <p className="text-sm text-destructive">{amountError}</p>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingAmount}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={savingAmount}
              onClick={(event) => {
                event.preventDefault();
                saveAmount();
              }}
            >
              {savingAmount && <Loader2 className="size-4 animate-spin" />}
              Save approved amount
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
