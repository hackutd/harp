import { ClipboardPen, X } from "lucide-react";
import { memo, useCallback, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { errorAlert } from "@/shared/lib/api";
import type { Application } from "@/types";

import { fetchApplicationResumeURL } from "../api";
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
  onGrade?: () => void;
}

export const ApplicationDetailPanel = memo(function ApplicationDetailPanel({
  application,
  loading,
  onClose,
  onGrade,
}: ApplicationDetailPanelProps) {
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

  return (
    <Card className="w-1/2 shrink-0 rounded-l-none border-l-0 flex flex-col h-full py-0! gap-0!">
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
        <div className="flex items-center gap-1">
          {onGrade && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  onClick={onGrade}
                >
                  <ClipboardPen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Grade applicant</TooltipContent>
            </Tooltip>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
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
            <LinksSection
              application={application}
              onViewResume={handleViewResume}
              isOpeningResume={isOpeningResume}
            />
            <TimelineSection application={application} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
});
