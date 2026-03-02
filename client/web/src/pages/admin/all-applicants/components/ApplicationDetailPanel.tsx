import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Application } from "@/types";

import { formatName, getStatusColor } from "../utils";
import {
  DemographicsSection,
  EducationSection,
  EventPreferencesSection,
  ExperienceSection,
  LinksSection,
  PersonalInfoSection,
  ShortAnswersSection,
  TimelineSection,
} from "./detail-sections";

interface ApplicationDetailPanelProps {
  application: Application | null;
  loading: boolean;
  onClose: () => void;
}

export function ApplicationDetailPanel({
  application,
  loading,
  onClose,
}: ApplicationDetailPanelProps) {
  return (
    <Card className="w-1/2 shrink-0 rounded-l-none border-l-0 flex flex-col max-h-[calc(100vh-180px)] py-0! gap-0!">
      <div className="flex items-center justify-between shrink-0 bg-gray-50 border-b px-4 py-3 rounded-tr-xl">
        <div className="flex items-center gap-2">
          {loading ? (
            <Skeleton className="h-5 w-32" />
          ) : application ? (
            <>
              <p className="font-semibold">
                {formatName(application.first_name, application.last_name)}
              </p>
              <Badge className={getStatusColor(application.status)}>
                {application.status}
              </Badge>
            </>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="cursor-pointer"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <CardContent className="flex-1 overflow-auto py-4">
        {loading ? (
          <div className="space-y-6 py-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            ))}
          </div>
        ) : application ? (
          <div className="space-y-6 pb-2">
            <PersonalInfoSection application={application} />
            <DemographicsSection application={application} />
            <EducationSection application={application} />
            <ExperienceSection application={application} />
            <ShortAnswersSection application={application} />
            <EventPreferencesSection application={application} />
            <LinksSection application={application} />
            <TimelineSection application={application} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
