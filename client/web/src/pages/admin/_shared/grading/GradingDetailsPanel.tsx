import type { ReactNode } from "react";
import { memo } from "react";

import { Skeleton } from "@/components/ui/skeleton";
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
      <LinksSection application={application} />
      <TimelineSection application={application} />
      {children}
    </div>
  );
});
