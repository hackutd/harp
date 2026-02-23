import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { Application } from "@/types";

interface EventPreferencesSectionProps {
  application: Application;
}

export function EventPreferencesSection({
  application,
}: EventPreferencesSectionProps) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Event Preferences</h4>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <Label className="text-muted-foreground text-xs">Shirt Size</Label>
          <p>{application.shirt_size || "N/A"}</p>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">
            Dietary Restrictions
          </Label>
          <div className="flex flex-wrap gap-1">
            {application.dietary_restrictions?.length > 0 ? (
              application.dietary_restrictions.map((restriction) => (
                <Badge
                  key={restriction}
                  variant="secondary"
                  className="text-xs"
                >
                  {restriction}
                </Badge>
              ))
            ) : (
              <span>None</span>
            )}
          </div>
        </div>
        {application.accommodations && (
          <div className="col-span-2">
            <Label className="text-muted-foreground text-xs">
              Accommodations
            </Label>
            <p>{application.accommodations}</p>
          </div>
        )}
      </div>
    </div>
  );
}
