import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorAlert } from "@/shared/lib/api";
import {
  buildDefaultValues,
  buildZodSchema,
  deriveSections,
  groupFieldsBySection,
} from "@/shared/lib/schema-utils";
import type { RSVPStatus } from "@/types";

import { ApplicationSummary } from "../apply/components/ApplicationSummary";
import { SchemaStepRenderer } from "../apply/steps/SchemaStepRenderer";
import { fetchMyTravelRSVP, submitMyTravelRSVP } from "./api";
import { ReceiptPreviewDialog } from "./components/ReceiptPreviewDialog";
import { ReceiptUploader } from "./components/ReceiptUploader";
import type { TravelRSVPInfo, UploadedReceipt } from "./types";

function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function TravelRSVPResult({
  status,
  approvedAmountCents,
}: {
  status: Exclude<RSVPStatus, "pending">;
  approvedAmountCents: number | null;
}) {
  const confirmed = status === "confirmed";

  return (
    <div className="rounded-xl border border-[#E5E5E5] p-5">
      <span
        className={`inline-block rounded-full px-3 py-1 text-[11px] font-medium tracking-wide text-white ${
          confirmed ? "bg-[#5A7D63]" : "bg-[#7A7973]"
        }`}
      >
        {confirmed ? "Travel details submitted" : "Reimbursement declined"}
      </span>
      <h1 className="mt-3 text-xl font-light tracking-tight text-black">
        {confirmed ? "All set!" : "Travel RSVP received"}
      </h1>
      <p className="mt-2 text-sm font-light text-[#8A8A8A]">
        {confirmed
          ? `We received your receipts. The organizing team will follow up about your ${
              approvedAmountCents != null
                ? `${formatUSD(approvedAmountCents)} `
                : ""
            }reimbursement.`
          : "You've declined the travel reimbursement. See you at the event!"}
      </p>
    </div>
  );
}

export default function TravelRSVPPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [travelRSVP, setTravelRSVP] = useState<TravelRSVPInfo | null>(null);
  const [receipts, setReceipts] = useState<UploadedReceipt[]>([]);

  const schema = useMemo(
    () => travelRSVP?.travel_rsvp_schema ?? [],
    [travelRSVP],
  );
  const sections = useMemo(() => deriveSections(schema), [schema]);
  const grouped = useMemo(() => groupFieldsBySection(schema), [schema]);
  const formSchema = useMemo(() => buildZodSchema(schema), [schema]);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: buildDefaultValues(schema),
    mode: "onTouched",
  });

  useEffect(() => {
    const controller = new AbortController();
    const loadData = async () => {
      const res = await fetchMyTravelRSVP(controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setTravelRSVP(res.data);
        form.reset(buildDefaultValues(res.data.travel_rsvp_schema ?? []));
      } else if (res.status === 403 || res.status === 404) {
        // Not eligible (or no application) — the travel RSVP doesn't apply.
        navigate("/app", { replace: true });
        return;
      } else {
        errorAlert(res);
      }
      setLoading(false);
    };
    loadData();
    return () => controller.abort();
  }, [form, navigate]);

  const submitDecision = async (
    status: "confirmed" | "declined",
    responses?: Record<string, unknown>,
    receiptPaths?: string[],
  ) => {
    setSubmitting(true);
    const res = await submitMyTravelRSVP({
      status,
      responses,
      receipt_paths: receiptPaths,
    });
    if (res.status === 200 && res.data) {
      setTravelRSVP(res.data);
      toast.success(
        status === "confirmed"
          ? "Your travel details have been submitted!"
          : "Your travel RSVP has been recorded.",
      );
    } else {
      errorAlert(res);
    }
    setSubmitting(false);
  };

  const handleConfirm = form.handleSubmit((values) => {
    const fieldIds = new Set(schema.map((f) => f.id));
    const responses: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (fieldIds.has(key)) responses[key] = value;
    }

    // The backend enforces this too, and tells us which answer triggers it.
    const receiptFieldID = travelRSVP?.receipt_required_field_id;
    if (
      receiptFieldID &&
      responses[receiptFieldID] === travelRSVP?.receipt_required_value &&
      receipts.length === 0
    ) {
      toast.error("Please upload at least one ticket receipt when flying");
      return;
    }

    return submitDecision(
      "confirmed",
      responses,
      receipts.map((r) => r.path),
    );
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-5 pt-10 md:max-w-5xl md:px-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (!travelRSVP) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 px-5 pt-4 pb-8 md:max-w-5xl md:flex-row md:items-start md:gap-2 md:px-8">
      <button
        type="button"
        onClick={() => navigate("/app")}
        aria-label="Back"
        className="-ml-3 flex size-9 shrink-0 items-center justify-center rounded-full text-black transition-transform hover:-translate-x-1 md:-ml-10"
      >
        <ChevronLeft className="size-5" strokeWidth={1.75} />
      </button>

      <div className="min-w-0 flex-1">
        {travelRSVP.travel_rsvp_status !== "pending" ? (
          <>
            <TravelRSVPResult
              status={travelRSVP.travel_rsvp_status}
              approvedAmountCents={travelRSVP.travel_approved_amount_cents}
            />
            {travelRSVP.travel_rsvp_status === "confirmed" && (
              <>
                {schema.length > 0 && (
                  <section className="mt-5">
                    <h2 className="mb-3 text-xs font-light tracking-widest text-[#8A8A8A] uppercase">
                      Your submission
                    </h2>
                    <ApplicationSummary
                      schema={schema}
                      responses={travelRSVP.travel_rsvp_responses ?? {}}
                      hasResume={false}
                      resumeSectionId={null}
                    />
                  </section>
                )}
                {(travelRSVP.travel_receipt_paths ?? []).length > 0 && (
                  <section className="mt-5">
                    <h2 className="mb-3 text-xs font-light tracking-widest text-[#8A8A8A] uppercase">
                      Receipts
                    </h2>
                    <div className="space-y-3">
                      {(travelRSVP.travel_receipt_paths ?? []).map(
                        (path, index) => (
                          <ReceiptPreviewDialog
                            key={path}
                            receipt={{ path, name: `Receipt ${index + 1}` }}
                            trigger={
                              <button
                                type="button"
                                className="flex w-full items-center justify-between rounded-xl border border-[#E5E5E5] px-5 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
                              >
                                <div>
                                  <p className="text-sm font-normal text-black">
                                    Receipt {index + 1}
                                  </p>
                                  <p className="text-xs font-light text-[#8A8A8A]">
                                    Tap to preview
                                  </p>
                                </div>
                                <Eye
                                  className="size-4.5 text-[#8A8A8A]"
                                  strokeWidth={1.5}
                                />
                              </button>
                            }
                          />
                        ),
                      )}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        ) : !travelRSVP.travel_rsvp_enabled ? (
          <div className="rounded-xl border border-[#E5E5E5] p-5">
            <span className="inline-block rounded-full bg-[#7A7973] px-3 py-1 text-[11px] font-medium tracking-wide text-white">
              Travel forms closed
            </span>
            <h1 className="mt-3 text-xl font-light tracking-tight text-black">
              Travel forms are closed
            </h1>
            <p className="mt-2 text-sm font-light text-[#8A8A8A]">
              The travel form window has ended. If you think this is a mistake,
              please reach out to the organizing team.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-light tracking-tight text-black">
              Travel reimbursement
            </h1>
            <p className="mt-2 text-sm font-light text-[#8A8A8A]">
              Your travel reimbursement was approved! Tell us how you&apos;re
              getting here, upload proof of travel, and let us know how
              you&apos;d like to be paid. You can only submit once.
            </p>

            {travelRSVP.travel_approved_amount_cents != null && (
              <div className="mt-6 rounded-xl bg-[#F5F5F5] p-5">
                <p className="text-[11px] font-medium tracking-wide text-[#8A8A8A] uppercase">
                  Approved amount
                </p>
                <p className="mt-1 text-3xl font-light tracking-tight text-black">
                  {formatUSD(travelRSVP.travel_approved_amount_cents)}
                </p>
                <p className="mt-2 text-xs font-light text-[#8A8A8A]">
                  This amount was set by the organizing team and is the most you
                  can be reimbursed. Submit your receipts below.
                </p>
              </div>
            )}

            <FormProvider {...form}>
              <form onSubmit={handleConfirm} className="mt-8 space-y-10">
                {sections.map((section) => (
                  <SchemaStepRenderer
                    key={section.id}
                    sectionLabel={section.label}
                    fields={grouped[section.id] ?? []}
                    headingClassName="text-2xl"
                  />
                ))}

                <div className="space-y-3">
                  <h2 className="text-xl font-light tracking-tight text-black">
                    Receipts
                  </h2>
                  <p className="text-sm font-light text-[#8A8A8A]">
                    Upload your ticket receipts (PDF, PNG, or JPEG). Required if
                    you&apos;re flying.
                  </p>
                  <ReceiptUploader
                    receipts={receipts}
                    onChange={setReceipts}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-3">
                  <Button
                    type="submit"
                    loading={submitting}
                    className="h-12 w-full rounded-full bg-black text-sm font-normal text-white hover:bg-black/85"
                  >
                    Submit travel details
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={submitting}
                        className="h-12 w-full rounded-full text-sm font-light text-[#8A8A8A] hover:text-black"
                      >
                        I no longer need reimbursement, decline
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-xl border-[#E5E5E5]">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-light tracking-tight text-black">
                          Decline travel reimbursement?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="font-light text-[#8A8A8A]">
                          You won&apos;t be reimbursed for your travel and this
                          cannot be undone. Are you sure?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-3">
                        <AlertDialogCancel className="h-11 rounded-full border-[#D9D9D9] px-6 font-normal hover:bg-[#F5F5F5]">
                          Keep reimbursement
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => submitDecision("declined")}
                          className="h-11 rounded-full bg-[#D14343] px-6 font-normal text-white hover:bg-[#C03939]"
                        >
                          Decline
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </form>
            </FormProvider>
          </>
        )}
      </div>
    </div>
  );
}
