import { Label } from "@/components/ui/label";
import type { Application } from "@/types";

interface LinksSectionProps {
  application: Application;
}

export function LinksSection({ application }: LinksSectionProps) {
  const hasLinks =
    application.github || application.linkedin || application.website;

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
                className="text-blue-600 hover:underline break-all"
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
                className="text-blue-600 hover:underline break-all"
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
                className="text-blue-600 hover:underline break-all"
              >
                {application.website}
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
