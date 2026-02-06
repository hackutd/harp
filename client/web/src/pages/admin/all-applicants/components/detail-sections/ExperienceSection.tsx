import { Label } from '@/components/ui/label';
import type { Application } from '@/types';

interface ExperienceSectionProps {
  application: Application;
}

export function ExperienceSection({ application }: ExperienceSectionProps) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Experience</h4>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <Label className="text-muted-foreground text-xs">Hackathons Attended</Label>
          <p>{application.hackathons_attended_count ?? 'N/A'}</p>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">Software Experience</Label>
          <p>{application.software_experience_level || 'N/A'}</p>
        </div>
        <div className="col-span-2">
          <Label className="text-muted-foreground text-xs">Heard About Us From</Label>
          <p>{application.heard_about || 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}
