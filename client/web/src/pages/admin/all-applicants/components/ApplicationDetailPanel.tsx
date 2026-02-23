import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
            <p className="font-semibold text-muted-foreground">Loading...</p>
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
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <CardContent className="flex-1 overflow-auto py-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
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
