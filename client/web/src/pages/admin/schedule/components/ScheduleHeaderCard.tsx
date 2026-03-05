import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ScheduleHeaderCardProps = {
  loading: boolean;
  schedulingEnabled: boolean;
  configuredStartDate: string | null;
  configuredEndDate: string | null;
  scheduleDaysLength: number;
};

export function ScheduleHeaderCard({
  loading,
  schedulingEnabled,
  configuredStartDate,
  configuredEndDate,
  scheduleDaysLength,
}: ScheduleHeaderCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hackathon Schedule</CardTitle>
        <CardDescription>
          Schedule dates are configured by Super Admins in Settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">
            Loading schedule data...
          </p>
        ) : schedulingEnabled ? (
          <p className="text-sm text-muted-foreground">
            Showing {scheduleDaysLength} day
            {scheduleDaysLength === 1 ? "" : "s"} for {configuredStartDate} to{" "}
            {configuredEndDate} (America/Chicago).
          </p>
        ) : (
          <p className="text-sm text-destructive">
            Hackathon date range is not configured. Ask a Super Admin to set
            start and end dates in Settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
