import { Label } from "@/components/ui/label";
import type { Application } from "@/types";

interface EducationSectionProps {
  application: Application;
}

export function EducationSection({ application }: EducationSectionProps) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Education</h4>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="col-span-2">
          <Label className="text-muted-foreground text-xs">University</Label>
          <p>{application.university || "N/A"}</p>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">Major</Label>
          <p>{application.major || "N/A"}</p>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">
            Level of Study
          </Label>
          <p>{application.level_of_study || "N/A"}</p>
        </div>
      </div>
    </div>
  );
}
