import { Label } from '@/components/ui/label';
import type { Application } from '@/types';

interface DemographicsSectionProps {
  application: Application;
}

export function DemographicsSection({ application }: DemographicsSectionProps) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Demographics</h4>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <Label className="text-muted-foreground text-xs">Race</Label>
          <p>{application.race || 'N/A'}</p>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">Ethnicity</Label>
          <p>{application.ethnicity || 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}
