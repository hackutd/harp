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

import type { Review } from "../../types";

interface GradingDetailsPanelProps {
  application: Application | null;
  review: Review | null;
  loading: boolean;
}

export const GradingDetailsPanel = memo(function GradingDetailsPanel({
  application,
  review,
  loading,
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

      {review && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Review Details
          </h3>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">Application ID</span>
            <span className="font-mono text-xs">{review.application_id}</span>
            <span className="text-muted-foreground">Assigned at</span>
            <span>{new Date(review.assigned_at).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
});
