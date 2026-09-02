import { Maximize2 } from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRedactApplicants } from "@/shared/hooks";
import { formatApplicantLabel, maskEmail } from "@/shared/lib/redaction";
import { usePointsConfigStore } from "@/shared/stores";

import type { ApplicationListItem } from "../types";
import { formatName, getStatusColor } from "../utils";

interface ApplicationsTableProps {
  applications: ApplicationListItem[];
  loading: boolean;
  selectedId: string | null;
  onSelectApplication: (id: string) => void;
}

export const ApplicationsTable = memo(function ApplicationsTable({
  applications,
  loading,
  selectedId,
  onSelectApplication,
}: ApplicationsTableProps) {
  const pointsName = usePointsConfigStore((s) => s.pointsName);
  const redact = useRedactApplicants();

  return (
    <div className="relative overflow-auto h-full p-6 pt-0">
      {loading && (
        <div className="absolute inset-0 bg-white/50 z-10 animate-pulse" />
      )}
      <Table className="border-collapse table-fixed min-w-[1500px] [&_th]:border-r [&_th]:border-gray-200 [&_td]:border-r [&_td]:border-gray-200 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0 [&_th]:overflow-hidden [&_th]:text-ellipsis [&_td]:overflow-hidden [&_td]:text-ellipsis">
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-28">Travel RSVP</TableHead>
            <TableHead className="w-48">
              {redact ? "Applicant" : "Name"}
            </TableHead>
            <TableHead className="w-56">Email</TableHead>
            <TableHead className="w-36">Phone</TableHead>
            <TableHead className="w-16">Age</TableHead>
            <TableHead className="w-32">Country</TableHead>
            <TableHead className="w-28">Gender</TableHead>
            <TableHead className="w-48">University</TableHead>
            <TableHead className="w-40">Major</TableHead>
            <TableHead className="w-40">Level of Study</TableHead>
            <TableHead className="w-28">Hackathons</TableHead>
            <TableHead className="w-28">Submitted</TableHead>
            <TableHead className="w-28">Created</TableHead>
            <TableHead className="w-28">Updated</TableHead>
            <TableHead className="w-24">AI Percent</TableHead>
            <TableHead className="w-24">{pointsName}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.length === 0 ? (
            <TableRow>
              <TableCell colSpan={17} className="text-center text-gray-500">
                No applications found
              </TableCell>
            </TableRow>
          ) : (
            applications.map((app) => {
              const name = redact
                ? formatApplicantLabel(app.id)
                : formatName(app.first_name, app.last_name);
              const email = redact ? maskEmail(app.email) : app.email;

              const isSelected = selectedId === app.id;

              return (
                <TableRow
                  key={app.id}
                  data-state={isSelected ? "selected" : undefined}
                  onClick={() => onSelectApplication(app.id)}
                  className="group cursor-pointer hover:bg-muted [&>td]:py-3"
                >
                  <TableCell className="relative">
                    <Badge className={getStatusColor(app.status)}>
                      {app.status}
                    </Badge>
                    <span className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                      <Maximize2 className="h-4 w-4 text-muted-foreground" />
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(app.travel_rsvp_status)}>
                      {app.travel_rsvp_status}
                    </Badge>
                  </TableCell>
                  <TableCell title={name}>{name}</TableCell>
                  <TableCell title={email}>{email}</TableCell>
                  <TableCell title={app.phone ?? undefined}>
                    {app.phone ?? "-"}
                  </TableCell>
                  <TableCell>{app.age ?? "-"}</TableCell>
                  <TableCell title={app.country_of_residence ?? undefined}>
                    {app.country_of_residence ?? "-"}
                  </TableCell>
                  <TableCell title={app.gender ?? undefined}>
                    {app.gender ?? "-"}
                  </TableCell>
                  <TableCell title={app.university ?? undefined}>
                    {app.university ?? "-"}
                  </TableCell>
                  <TableCell title={app.major ?? undefined}>
                    {app.major ?? "-"}
                  </TableCell>
                  <TableCell title={app.level_of_study ?? undefined}>
                    {app.level_of_study ?? "-"}
                  </TableCell>
                  <TableCell>{app.hackathons_attended ?? "-"}</TableCell>
                  <TableCell>
                    {app.submitted_at
                      ? new Date(app.submitted_at).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {new Date(app.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {new Date(app.updated_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {app.ai_percent != null ? `${app.ai_percent}%` : "-"}
                  </TableCell>
                  <TableCell className="tabular-nums">{app.points}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
});
