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
  const hasLinks =
    application.github ||
    application.linkedin ||
    application.website ||
    application.resume_path;

  if (!hasLinks) {
    return null;
  }

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Links</h4>
      <div className="space-y-2 text-sm">
        {application.github && (
          <div>
            <Label className="text-muted-foreground text-xs">GitHub</Label>
            <p>
              <a
                href={application.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all cursor-pointer"
              >
                {application.github}
              </a>
            </p>
          </div>
        )}
        {application.linkedin && (
          <div>
            <Label className="text-muted-foreground text-xs">LinkedIn</Label>
            <p>
              <a
                href={application.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all cursor-pointer"
              >
                {application.linkedin}
              </a>
            </p>
          </div>
        )}
        {application.website && (
          <div>
            <Label className="text-muted-foreground text-xs">Website</Label>
            <p>
              <a
                href={application.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all cursor-pointer"
              >
                {application.website}
              </a>
            </p>
          </div>
        )}
        {application.resume_path && (
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
        )}
      </div>
    </div>
  );
}
