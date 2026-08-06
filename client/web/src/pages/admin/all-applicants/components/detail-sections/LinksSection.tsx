import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Application } from "@/types";

interface LinksSectionProps {
  application: Application;
  onViewResume?: () => void;
  isOpeningResume?: boolean;
}

export function LinksSection({
  application,
  onViewResume,
  isOpeningResume = false,
}: LinksSectionProps) {
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onViewResume}
              disabled={!onViewResume}
              loading={isOpeningResume}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {isOpeningResume ? "Opening..." : "View Resume"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
