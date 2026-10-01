import { Label } from "@/components/ui/label";
import { formatElapsed } from "@/shared/lib/datetime";
import type { Application } from "@/types";

interface TimelineSectionProps {
  application: Application;
}

export function TimelineSection({ application }: TimelineSectionProps) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Timeline</h4>
      <div className="grid grid-cols-2 gap-3 text-sm">
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
          <Label className="text-muted-foreground text-xs">Last Updated</Label>
          <p>{new Date(application.updated_at).toLocaleString()}</p>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">
            Time to Submit
          </Label>
          {/* The draft is created on the hacker's first portal visit (the
              dashboard fetches it too), so this runs from then to submission. */}
          <p title="From the draft being created on their first portal visit to submission">
            {application.submitted_at
              ? formatElapsed(
                  new Date(application.created_at),
                  new Date(application.submitted_at),
                )
              : "N/A"}
          </p>
        </div>
      </div>
    </div>
  );
}
