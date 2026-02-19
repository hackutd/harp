import { Maximize2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { ApplicationListItem } from '../types';
import { formatName,getStatusColor } from '../utils';

interface ApplicationsTableProps {
  applications: ApplicationListItem[];
  loading: boolean;
  selectedId: string | null;
  onSelectApplication: (id: string) => void;
}

export function ApplicationsTable({
  applications,
  loading,
  selectedId,
  onSelectApplication,
}: ApplicationsTableProps) {
  return (
    <div className="relative overflow-auto h-full p-6 pt-0">
      {loading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}
      <Table className="border-collapse [&_th]:border-r [&_th]:border-gray-200 [&_td]:border-r [&_td]:border-gray-200 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0">
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Gender</TableHead>
            <TableHead>University</TableHead>
            <TableHead>Major</TableHead>
            <TableHead>Level of Study</TableHead>
            <TableHead>Hackathons</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead>AI Percentage</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.length === 0 ? (
            <TableRow>
              <TableCell colSpan={14} className="text-center text-gray-500">
                No applications found
              </TableCell>
            </TableRow>
          ) : (
            applications.map((app) => (
              <TableRow
                key={app.id}
                className={`group hover:bg-muted/50 [&>td]:py-3 ${selectedId === app.id ? 'bg-muted/50' : ''}`}
              >
                <TableCell>
                  <Badge className={getStatusColor(app.status)}>
                    {app.status}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center justify-between gap-4">
                    <span>{formatName(app.first_name, app.last_name)}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 cursor-pointer group-hover:opacity-100 transition-opacity h-6 w-6"
                      onClick={() => onSelectApplication(app.id)}
                    >
                      <Maximize2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>{app.email}</TableCell>
                <TableCell>{app.phone_e164 ?? '-'}</TableCell>
                <TableCell>{app.age ?? '-'}</TableCell>
                <TableCell>{app.country_of_residence ?? '-'}</TableCell>
                <TableCell>{app.gender ?? '-'}</TableCell>
                <TableCell>{app.university ?? '-'}</TableCell>
                <TableCell>{app.major ?? '-'}</TableCell>
                <TableCell>{app.level_of_study ?? '-'}</TableCell>
                <TableCell>{app.hackathons_attended_count ?? '-'}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {app.submitted_at
                    ? new Date(app.submitted_at).toLocaleDateString()
                    : '-'}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {new Date(app.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {new Date(app.updated_at).toLocaleDateString()}
                </TableCell>
                <TableCell>{app.ai_percentage != null ? `${app.ai_percentage}%` : '-'}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
