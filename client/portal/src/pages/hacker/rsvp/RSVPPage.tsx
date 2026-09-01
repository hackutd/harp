import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft } from "lucide-react";
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
import { fetchMyRSVP, submitMyRSVP } from "./api";
import type { RSVPInfo } from "./types";

function RSVPResult({ status }: { status: Exclude<RSVPStatus, "pending"> }) {
  const confirmed = status === "confirmed";

  return (
    <div className="rounded-xl border border-[#E5E5E5] p-5">
      <span
        className={`inline-block rounded-full px-3 py-1 text-[11px] font-medium tracking-wide text-white ${
          confirmed ? "bg-[#5A7D63]" : "bg-[#7A7973]"
        }`}
      >
        {confirmed ? "Spot claimed" : "Spot declined"}
      </span>
      <h1 className="mt-3 text-xl font-light tracking-tight text-black">
        {confirmed ? "You're in!" : "RSVP received"}
      </h1>
      <p className="mt-2 text-sm font-light text-[#8A8A8A]">
        {confirmed
          ? "Your RSVP is confirmed. We can't wait to see you at the event!"
          : "You've declined your spot. Sorry you can't make it — we hope to see you next time!"}
      </p>
    </div>
  );
}

export default function RSVPPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rsvp, setRSVP] = useState<RSVPInfo | null>(null);

  const schema = useMemo(() => rsvp?.rsvp_schema ?? [], [rsvp]);
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
      const res = await fetchMyRSVP(controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setRSVP(res.data);
        form.reset(buildDefaultValues(res.data.rsvp_schema ?? []));
      } else if (res.status === 403 || res.status === 404) {
        // Not accepted (or no application) — RSVP doesn't apply.
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
  ) => {
    setSubmitting(true);
    const res = await submitMyRSVP({ status, responses });
    if (res.status === 200 && res.data) {
      setRSVP(res.data);
      toast.success(
        status === "confirmed"
          ? "Your spot is confirmed!"
          : "Your RSVP has been recorded.",
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
    return submitDecision("confirmed", responses);
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

  if (!rsvp) return null;

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
        {rsvp.rsvp_status !== "pending" ? (
          <>
            <RSVPResult status={rsvp.rsvp_status} />
            {rsvp.rsvp_status === "confirmed" && schema.length > 0 && (
              <section className="mt-5">
                <h2 className="mb-3 text-xs font-light tracking-widest text-[#8A8A8A] uppercase">
                  Your submission
                </h2>
                <ApplicationSummary
                  schema={schema}
                  responses={rsvp.rsvp_responses ?? {}}
                  hasResume={false}
                  resumeSectionId={null}
                />
              </section>
            )}
          </>
        ) : !rsvp.rsvp_enabled ? (
          <div className="rounded-xl border border-[#E5E5E5] p-5">
            <span className="inline-block rounded-full bg-[#7A7973] px-3 py-1 text-[11px] font-medium tracking-wide text-white">
              RSVPs closed
            </span>
            <h1 className="mt-3 text-xl font-light tracking-tight text-black">
              RSVPs are closed
            </h1>
            <p className="mt-2 text-sm font-light text-[#8A8A8A]">
              The RSVP window has ended. If you think this is a mistake, please
              reach out to the organizing team.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-light tracking-tight text-black">
              Claim your spot
            </h1>
            <p className="mt-2 text-sm font-light text-[#8A8A8A]">
              Congratulations on being accepted! Fill this out to confirm
              you&apos;re coming. You can only submit once.
            </p>

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
                  <Button
                    type="submit"
                    loading={submitting}
                    className="h-12 w-full rounded-full bg-black text-sm font-normal text-white hover:bg-black/85"
                  >
                    Confirm my spot
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={submitting}
                        className="h-12 w-full rounded-full text-sm font-light text-[#8A8A8A] hover:text-black"
                      >
                        I can&apos;t make it, decline my spot
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-xl border-[#E5E5E5]">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-light tracking-tight text-black">
                          Decline your spot?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="font-light text-[#8A8A8A]">
                          Your spot will be released and this cannot be undone.
                          Are you sure you can&apos;t make it?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-3">
                        <AlertDialogCancel className="h-11 rounded-full border-[#D9D9D9] px-6 font-normal hover:bg-[#F5F5F5]">
                          Keep my spot
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
