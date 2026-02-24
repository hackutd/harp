import { Label } from "@/components/ui/label";
import type { Application } from "@/types";

interface PersonalInfoSectionProps {
  application: Application;
}

export function PersonalInfoSection({ application }: PersonalInfoSectionProps) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Personal Information</h4>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <Label className="text-muted-foreground text-xs">Phone</Label>
          <p>{application.phone_e164 || "N/A"}</p>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">Age</Label>
          <p>{application.age ?? "N/A"}</p>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">Country</Label>
          <p>{application.country_of_residence || "N/A"}</p>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">Gender</Label>
          <p>{application.gender || "N/A"}</p>
        </div>
      </div>
    </div>
  );
}
