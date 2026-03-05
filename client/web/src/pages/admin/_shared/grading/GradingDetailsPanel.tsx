import type { ReactNode } from "react";
import { memo, useCallback, useState } from "react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { fetchApplicationResumeURL } from "@/pages/admin/all-applicants/api";
import {
  DemographicsSection,
  EducationSection,
  EventPreferencesSection,
  ExperienceSection,
  LinksSection,
  PersonalInfoSection,
  ShortAnswersSection,
  TimelineSection,
} from "@/pages/admin/all-applicants/components/detail-sections";
import { errorAlert } from "@/shared/lib/api";
import type { Application } from "@/types";

interface GradingDetailsPanelProps {
  application: Application | null;
  loading: boolean;
  children?: ReactNode;
}

export const GradingDetailsPanel = memo(function GradingDetailsPanel({
  application,
  loading,
  children,
}: GradingDetailsPanelProps) {
  const [isOpeningResume, setIsOpeningResume] = useState(false);

  const handleViewResume = useCallback(async () => {
    if (!application || !application.resume_path || isOpeningResume) {
      return;
    }

    const resumeTab = window.open("", "_blank");
    if (!resumeTab) {
      toast.error("Please allow popups to view resumes.");
      return;
    }

    setIsOpeningResume(true);
    const res = await fetchApplicationResumeURL(application.id);

    if (res.status === 200 && res.data?.download_url) {
      resumeTab.location.href = res.data.download_url;
    } else {
      resumeTab.close();
      errorAlert(res, "Failed to open resume");
    }

    setIsOpeningResume(false);
  }, [application, isOpeningResume]);

  if (loading) {
    return (
      <div className="space-y-8 p-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!application) return null;

  return (
    <div className="space-y-8 p-8 pb-10 text-base">
      <PersonalInfoSection application={application} />
      <DemographicsSection application={application} />
      <EducationSection application={application} />
      <ExperienceSection application={application} />
      <ShortAnswersSection application={application} />
      <EventPreferencesSection application={application} />
      <LinksSection
        application={application}
        onViewResume={handleViewResume}
        isOpeningResume={isOpeningResume}
      />
      <TimelineSection application={application} />
      {children}
    </div>
  );
});
