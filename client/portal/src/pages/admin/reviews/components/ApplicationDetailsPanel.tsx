import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ResumePreviewDialog } from "@/pages/admin/_shared/ResumePreviewDialog";
import type { Application } from "@/types";

import { SchemaDetailRenderer } from "../../all-applicants/components/detail-sections/SchemaDetailRenderer";
import type { Review } from "../types";

interface ApplicationDetailsPanelProps {
  application: Application;
  selectedReview: Review;
  isExpanded: boolean;
}

export function ApplicationDetailsPanel({
  application,
  selectedReview,
  isExpanded,
}: ApplicationDetailsPanelProps) {
  const gridCols = isExpanded ? "grid-cols-4" : "grid-cols-2";

  return (
    <div className="space-y-6 pb-2">
      {/* Schema-driven fields (all sections) */}
      <SchemaDetailRenderer application={application} />

      {/* Resume link */}
      {application.resume_path && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Resume</h4>
          <div className="text-sm">
            <div className="pt-1">
              <ResumePreviewDialog
                applicationId={application.id}
                trigger={
                  <Button type="button" variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    View Resume
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Timeline</h4>
        <div className={`grid ${gridCols} gap-3 text-sm`}>
          <div>
            <Label className="text-muted-foreground text-xs">Submitted</Label>
            <p>
              {application.submitted_at
                ? new Date(application.submitted_at).toLocaleString()
                : "N/A"}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Created</Label>
            <p>{new Date(application.created_at).toLocaleString()}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">
              Last Updated
            </Label>
            <p>{new Date(application.updated_at).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Review Info */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Review Details</h4>
        <div className={`grid ${gridCols} gap-3 text-sm`}>
          <div className={isExpanded ? "" : "col-span-2"}>
            <Label className="text-muted-foreground text-xs">
              Application ID
            </Label>
            <p className="font-mono text-xs">{selectedReview.application_id}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Assigned At</Label>
            <p>{new Date(selectedReview.assigned_at).toLocaleString()}</p>
          </div>
          {selectedReview.reviewed_at && (
            <div>
              <Label className="text-muted-foreground text-xs">
                Reviewed At
              </Label>
              <p>{new Date(selectedReview.reviewed_at).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
