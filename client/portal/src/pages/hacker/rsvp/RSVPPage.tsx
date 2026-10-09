import { IconChevronLeft } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { IncompleteFormAlert } from "@/components/IncompleteFormAlert";
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
import { errorAlert } from "@/shared/lib/api";
import {
  collectIncompleteSections,
  scrollToFirstInvalidField,
  summarizeIncomplete,
} from "@/shared/lib/form-errors";
import {
  buildDefaultValues,
  buildSchemaResolver,
  deriveSections,
  groupFieldsBySection,
} from "@/shared/lib/schema-utils";
import { useAttendeeStore, useUserStore } from "@/shared/stores";
import type { RSVPStatus } from "@/types";

import { ApplicationSummary } from "../apply/components/ApplicationSummary";
import { SchemaStepRenderer } from "../apply/steps/SchemaStepRenderer";
import { StatusDetailSkeleton } from "../components/StatusDetailSkeleton";
import { pillClass } from "../components/tones";
import { DirectoryUnlockedDialog } from "../directory/components/DirectoryUnlockedDialog";
import { fetchMyRSVP, submitMyRSVP } from "./api";
import type { RSVPInfo } from "./types";

function RSVPResult({ status }: { status: Exclude<RSVPStatus, "pending"> }) {
  const confirmed = status === "confirmed";

  return (
    <div className="rounded-xl border border-ink/10 p-5">
      <span className={pillClass(confirmed ? "success" : "neutral")}>
        {confirmed ? "Spot claimed" : "Spot declined"}
      </span>
      <h1 className="mt-3 text-xl font-light tracking-tight text-ink">
        {confirmed ? "You're in!" : "RSVP received"}
      </h1>
      <p className="mt-2 text-sm font-light text-ink/65">
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
  const [unlockedOpen, setUnlockedOpen] = useState(false);
  const userId = useUserStore((s) => s.user?.id);
  const setAttendeeConfirmed = useAttendeeStore((s) => s.setConfirmed);

  const schema = useMemo(() => rsvp?.rsvp_schema ?? [], [rsvp]);
  const sections = useMemo(() => deriveSections(schema), [schema]);
  const grouped = useMemo(() => groupFieldsBySection(schema), [schema]);
  const resolver = useMemo(() => buildSchemaResolver(schema), [schema]);

  const form = useForm({
    resolver,
    defaultValues: buildDefaultValues(schema),
    mode: "onTouched",
  });

  // Questions still missing an answer, grouped by section. Derived from the
  // live errors (rather than snapshotted on submit) so the list shrinks as the
  // user fills them in.
  const { errors: formErrors, isSubmitted } = form.formState;
  const incompleteSections = useMemo(
    () => (isSubmitted ? collectIncompleteSections(schema, formErrors) : []),
    [isSubmitted, formErrors, schema],
  );

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
      // Only accepted hackers reach this page, so a confirmed RSVP is exactly
      // what opens the directory. Reveal it in the nav and announce it now.
      if (res.data.rsvp_status === "confirmed" && userId) {
        setAttendeeConfirmed(userId, true);
        setUnlockedOpen(true);
      }
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

  const handleConfirm = form.handleSubmit(
    (values) => {
      const fieldIds = new Set(schema.map((f) => f.id));
      const responses: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(values)) {
        if (fieldIds.has(key)) responses[key] = value;
      }
      return submitDecision("confirmed", responses);
    },
    (errors) => {
      // Name the unanswered questions instead of failing silently.
      toast.error(
        summarizeIncomplete(collectIncompleteSections(schema, errors)),
      );
      scrollToFirstInvalidField();
    },
  );

  if (loading) {
    return <StatusDetailSkeleton label="RSVP" />;
  }

  if (!rsvp) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 px-5 pt-4 pb-8 md:max-w-5xl md:flex-row md:items-start md:gap-2 md:px-8">
      <button
        type="button"
        onClick={() => navigate("/app")}
        aria-label="Back"
        className="-ml-3 flex size-9 shrink-0 items-center justify-center rounded-full text-ink transition-transform hover:-translate-x-1 md:-ml-10"
      >
        <IconChevronLeft className="size-5" strokeWidth={1.75} />
      </button>

      <DirectoryUnlockedDialog
        open={unlockedOpen}
        onOpenChange={setUnlockedOpen}
      />

      <div className="min-w-0 flex-1">
        {rsvp.rsvp_status !== "pending" ? (
          <>
            <RSVPResult status={rsvp.rsvp_status} />
            {rsvp.rsvp_status === "confirmed" && schema.length > 0 && (
              <section className="mt-5">
                <h2 className="mb-3 text-xs font-light tracking-widest text-ink/65 uppercase">
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
          <div className="rounded-xl border border-ink/10 p-5">
            <span className="inline-block rounded-full bg-ink/5 px-3 py-1 text-[11px] font-medium tracking-wide text-ink">
              RSVPs closed
            </span>
            <h1 className="mt-3 text-xl font-light tracking-tight text-ink">
              RSVPs are closed
            </h1>
            <p className="mt-2 text-sm font-light text-ink/65">
              The RSVP window has ended. If you think this is a mistake, please
              reach out to the organizing team.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-light tracking-tight text-ink">
              Claim your spot
            </h1>
            <p className="mt-2 text-sm font-light text-ink/65">
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
                  <IncompleteFormAlert sections={incompleteSections} />

                  <Button
                    type="submit"
                    loading={submitting}
                    className="h-12 w-full rounded-full bg-tide text-sm font-normal text-white hover:bg-tide-hover"
                  >
                    Confirm my spot
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={submitting}
                        className="h-12 w-full rounded-full text-sm font-light text-ink/65 hover:text-ink"
                      >
                        I can&apos;t make it, decline my spot
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-xl border-ink/10">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-light tracking-tight text-ink">
                          Decline your spot?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="font-light text-ink/65">
                          Your spot will be released and this cannot be undone.
                          Are you sure you can&apos;t make it?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-3">
                        <AlertDialogCancel className="h-11 rounded-full border-ink/10 px-6 font-normal hover:bg-ink/5">
                          Keep my spot
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => submitDecision("declined")}
                          className="h-11 rounded-full bg-destructive px-6 font-normal text-ink hover:bg-destructive-hover"
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
