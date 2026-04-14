import { ExternalLink, Loader2 } from "lucide-react";

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
              disabled={!onViewResume || isOpeningResume}
            >
              {isOpeningResume ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Resume
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
