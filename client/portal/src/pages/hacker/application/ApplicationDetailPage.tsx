import { ChevronLeft, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { Skeleton } from "@/components/ui/skeleton";
import { errorAlert, getRequest } from "@/shared/lib/api";
import { resolveResumeSectionId } from "@/shared/lib/schema-utils";
import type { Application, ApplicationStatus } from "@/types";

import { ApplicationSummary } from "../apply/components/ApplicationSummary";
import { ResumePreviewDialog } from "../apply/components/ResumePreviewDialog";
import {
  STATUS_LABELS,
  STATUS_MESSAGES,
  STATUS_PILL_COLORS,
} from "../components/applicationStatus";

// Friendly headline for the result card, mirroring the RSVP pages'
// "You're in!" / "All set!" pattern.
const STATUS_HEADLINES: Record<ApplicationStatus, string> = {
  draft: "Still in progress",
  submitted: "Application received",
  accepted: "Congratulations!",
  rejected: "Thank you for applying",
  waitlisted: "You're on the waitlist",
};

/** Read-only view of the hacker's submitted application, opened from the status cards. */
export default function ApplicationDetailPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<Application | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadData = async () => {
      const res = await getRequest<Application>(
        "/applications/me",
        "application",
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setApplication(res.data);
      } else if (res.status === 404) {
        // No application — nothing to review here.
        navigate("/app", { replace: true });
        return;
      } else {
        errorAlert(res);
      }
      setLoading(false);
    };
    loadData();
    return () => controller.abort();
  }, [navigate]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-5 pt-10 md:max-w-5xl md:px-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (!application) return null;

  const schema = application.application_schema ?? [];
  const hasResume = Boolean(application.resume_path);
  const resumeSectionId = resolveResumeSectionId(schema);

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
        {/* Result card */}
        <div className="rounded-xl border border-[#E5E5E5] p-5">
          <span
            className={`inline-block rounded-full px-3 py-1 text-[11px] font-medium tracking-wide text-white ${STATUS_PILL_COLORS[application.status]}`}
          >
            {STATUS_LABELS[application.status]}
          </span>
          <h1 className="mt-3 text-xl font-light tracking-tight text-black">
            {STATUS_HEADLINES[application.status]}
          </h1>
          <p className="mt-2 text-sm font-light text-[#8A8A8A]">
            {STATUS_MESSAGES[application.status]}
          </p>
        </div>

        {/* Full application answers */}
        {schema.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-3 text-xs font-light tracking-widest text-[#8A8A8A] uppercase">
              Your submission
            </h2>
            <ApplicationSummary
              schema={schema}
              responses={application.responses ?? {}}
              hasResume={hasResume}
              resumeSectionId={resumeSectionId}
            />
          </section>
        )}

        {/* Resume quick view */}
        {hasResume && (
          <section className="mt-5">
            <h2 className="mb-3 text-xs font-light tracking-widest text-[#8A8A8A] uppercase">
              Resume
            </h2>
            <ResumePreviewDialog
              trigger={
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-[#E5E5E5] px-5 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
                >
                  <div>
                    <p className="text-sm font-normal text-black">Resume</p>
                    <p className="text-xs font-light text-[#8A8A8A]">
                      Tap to preview
                    </p>
                  </div>
                  <Eye className="size-4.5 text-[#8A8A8A]" strokeWidth={1.5} />
                </button>
              }
            />
          </section>
        )}
      </div>
    </div>
  );
}
