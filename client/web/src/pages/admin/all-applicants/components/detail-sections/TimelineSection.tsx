import { Label } from '@/components/ui/label';
import type { Application } from '@/types';

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
              : 'N/A'}
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
      </div>
    </div>
  );
}
