import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ResumePreviewDialog } from "@/pages/admin/_shared/ResumePreviewDialog";
import type { Application } from "@/types";

interface LinksSectionProps {
  application: Application;
}

export function LinksSection({ application }: LinksSectionProps) {
  if (!application.resume_path) {
    return null;
  }

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Resume</h4>
      <div className="space-y-2 text-sm">
        <div>
          <Label className="text-muted-foreground text-xs">Resume</Label>
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
    </div>
  );
}
