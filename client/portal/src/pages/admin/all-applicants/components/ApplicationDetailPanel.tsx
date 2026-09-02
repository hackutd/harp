import {
  ChevronLeft,
  ChevronRight,
  ClipboardPen,
  Utensils,
} from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRedactApplicants } from "@/shared/hooks";
import { formatApplicantLabel, maskEmail } from "@/shared/lib/redaction";
import { usePointsConfigStore } from "@/shared/stores";
import type { Application } from "@/types";

import { formatName, getStatusColor } from "../utils";
import { LinksSection } from "./detail-sections";
import { SchemaDetailRenderer } from "./detail-sections/SchemaDetailRenderer";
import { TimelineSection } from "./detail-sections/TimelineSection";

interface ApplicationDetailPanelProps {
  application: Application | null;
  loading: boolean;
  open: boolean;
  onClose: () => void;
  onGrade?: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}

export const ApplicationDetailPanel = memo(function ApplicationDetailPanel({
  application,
  loading,
  open,
  onClose,
  onGrade,
  canPrevious = false,
  canNext = false,
  onPrevious,
  onNext,
}: ApplicationDetailPanelProps) {
  const pointsName = usePointsConfigStore((s) => s.pointsName);
  const redact = useRedactApplicants();

  const email = application?.responses?.email as string | undefined;
  const hasNavigation = onPrevious != null || onNext != null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="border-b px-6 py-4 pr-14">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {loading ? (
                <>
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="mt-2 h-4 w-56" />
                </>
              ) : application ? (
                <>
                  <SheetTitle className="truncate text-lg">
                    {redact
                      ? formatApplicantLabel(application.id)
                      : formatName(
                          application.responses?.first_name as string | null,
                          application.responses?.last_name as string | null,
                        )}
                  </SheetTitle>
                  <SheetDescription className="truncate">
                    {email ? (redact ? maskEmail(email) : email) : ""}
                  </SheetDescription>
                </>
              ) : (
                <SheetTitle className="text-lg">Application</SheetTitle>
              )}
            </div>
            {application && !loading && (
              <div className="flex shrink-0 items-center gap-2">
                <Badge className={getStatusColor(application.status)}>
                  {application.status}
                </Badge>
                <Badge variant="secondary" className="tabular-nums">
                  {application.points ?? 0} {pointsName}
                </Badge>
                {application.meal_group && (
                  <Badge variant="outline" className="gap-1">
                    <Utensils className="size-3" />
                    {application.meal_group}
                  </Badge>
                )}
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
              </div>
            )}
          </div>
        </SheetHeader>

        {hasNavigation && (
          <div className="flex items-center justify-between border-b px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!canPrevious}
              onClick={onPrevious}
            >
              <ChevronLeft className="size-4" />
              Previous person
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canNext}
              onClick={onNext}
            >
              Next person
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-6">
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
                <SchemaDetailRenderer application={application} />
                <LinksSection application={application} />
                <TimelineSection application={application} />
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
});
