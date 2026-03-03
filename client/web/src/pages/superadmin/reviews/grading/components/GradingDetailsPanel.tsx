import { memo } from "react";

import { Badge } from "@/components/ui/badge";
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
import type { ApplicationListItem } from "@/pages/admin/all-applicants/types";
import type { Application } from "@/types";

interface GradingDetailsPanelProps {
  application: Application | null;
  listItem: ApplicationListItem | null;
  loading: boolean;
}

export const GradingDetailsPanel = memo(function GradingDetailsPanel({
  application,
  listItem,
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

      {/* Review Stats */}
      {listItem && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Review Stats
          </h3>
          <div className="space-y-2">
            <p className="text-sm">
              {listItem.reviews_completed} / {listItem.reviews_assigned} reviews
              completed
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-green-100 text-green-800">
                {listItem.accept_votes} accept
              </Badge>
              <Badge className="bg-red-100 text-red-800">
                {listItem.reject_votes} reject
              </Badge>
              <Badge className="bg-yellow-100 text-yellow-800">
                {listItem.waitlist_votes} waitlist
              </Badge>
              {listItem.ai_percent != null && (
                <Badge variant="secondary">AI: {listItem.ai_percent}%</Badge>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
