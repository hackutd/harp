import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorAlert, getRequest } from "@/shared/lib/api";
import { resolveResumeSectionId } from "@/shared/lib/schema-utils";
import type { Application, ApplicationStatus } from "@/types";

import { ApplicationSummary } from "../apply/components/ApplicationSummary";
import { ResumePreviewDialog } from "../apply/components/ResumePreviewDialog";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "In progress",
  submitted: "Under review",
  accepted: "Accepted",
  rejected: "Not accepted",
  waitlisted: "Waitlisted",
};

const STATUS_MESSAGES: Record<ApplicationStatus, string> = {
  draft: "Your application is saved as a draft. Submit it when you're ready.",
  submitted:
    "Your application has been submitted and is under review. We'll notify you once a decision is made.",
  accepted: "Congratulations! Your application has been accepted.",
  rejected:
    "Thank you for applying. Unfortunately, we cannot accept your application at this time.",
  waitlisted:
    "Your application is on the waitlist. We'll notify you if a spot becomes available.",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="text-xs font-light text-[#8A8A8A]">{label}</span>
      <span className="text-right text-sm font-light text-black">{value}</span>
    </div>
  );
}

export default function StatusPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<Application | null>(null);
  const [showFullApplication, setShowFullApplication] = useState(false);

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
      } else if (res.status !== 404) {
        errorAlert(res);
      }
      setLoading(false);
    };
    loadData();
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-5 pt-10 md:max-w-5xl md:px-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="mx-auto max-w-2xl px-5 pt-10 md:max-w-5xl md:px-8">
        <h1 className="text-3xl font-light tracking-tight text-black">
          No application yet
        </h1>
        <p className="mt-2 text-sm font-light text-[#8A8A8A]">
          Get started by creating your hacker application.
        </p>
        <Button
          onClick={() => navigate("/app/apply")}
          className="mt-6 h-12 w-full rounded-full bg-black text-sm font-normal text-white hover:bg-black/85"
        >
          Apply now
        </Button>
      </div>
    );
  }

  const name = [
    application.responses?.first_name,
    application.responses?.last_name,
  ]
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .join(" ");

  const schema = application.application_schema ?? [];
  const hasResume = Boolean(application.resume_path);
  const resumeSectionId = resolveResumeSectionId(schema);

  return (
    <div className="mx-auto max-w-2xl px-5 pt-4 pb-8 md:max-w-5xl md:px-8">
      <button
        type="button"
        onClick={() => navigate("/app")}
        aria-label="Back"
        className="-ml-2 flex size-9 items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0]"
      >
        <ChevronLeft className="size-5" strokeWidth={1.75} />
      </button>

      {/* Status card */}
      <div className="mt-3 rounded-xl bg-[#3A3A38] p-5 text-white">
        <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium tracking-widest uppercase">
          {STATUS_LABELS[application.status]}
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Application status
        </h1>
        <p className="mt-2 text-sm font-light text-white/70">
          {STATUS_MESSAGES[application.status]}
        </p>
      </div>

      {/* Details */}
      <section className="mt-5">
        <h2 className="mb-1 text-xs font-light tracking-widest text-[#8A8A8A] uppercase">
          Details
        </h2>
        <div className="divide-y divide-[#F0F0F0]">
          {name && <DetailRow label="Name" value={name} />}
          <DetailRow
            label="University"
            value={String(application.responses?.university || "Not provided")}
          />
          <DetailRow
            label="Major"
            value={String(application.responses?.major || "Not provided")}
          />
          {application.submitted_at && (
            <DetailRow
              label="Submitted"
              value={format(parseISO(application.submitted_at), "MMM d, yyyy")}
            />
          )}
          <DetailRow
            label="Created"
            value={format(parseISO(application.created_at), "MMM d, yyyy")}
          />
        </div>
      </section>

      {/* Resume quick view */}
      {hasResume && (
        <ResumePreviewDialog
          trigger={
            <button
              type="button"
              className="mt-5 flex w-full items-center justify-between rounded-xl border border-[#E5E5E5] px-5 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
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
      )}

      {/* Full application review */}
      {schema.length > 0 && (
        <section className="mt-5">
          <button
            type="button"
            onClick={() => setShowFullApplication((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-[#E5E5E5] px-5 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
          >
            <div>
              <p className="text-sm font-normal text-black">Your application</p>
              <p className="text-xs font-light text-[#8A8A8A]">
                Review your submitted answers
              </p>
            </div>
            <ChevronRight
              className={`size-4 text-[#8A8A8A] transition-transform ${
                showFullApplication ? "rotate-90" : ""
              }`}
              strokeWidth={1.75}
            />
          </button>

          {showFullApplication && (
            <div className="mt-3">
              <ApplicationSummary
                schema={schema}
                responses={application.responses ?? {}}
                hasResume={hasResume}
                resumeSectionId={resumeSectionId}
              />
            </div>
          )}
        </section>
      )}

      {application.status === "draft" && (
        <Button
          onClick={() => navigate("/app/apply")}
          className="mt-6 h-12 w-full rounded-full bg-black text-sm font-normal text-white hover:bg-black/85"
        >
          Continue application
        </Button>
      )}
    </div>
  );
}
