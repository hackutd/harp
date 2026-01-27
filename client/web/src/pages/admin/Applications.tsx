import { useEffect } from 'react';
import { useApplicationsStore } from '../../store';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { SectionCards } from '../../components/admin/section-cards';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ApplicationStatus } from '../../types';

export default function Applications() {
  const {
    applications,
    loading,
    nextCursor,
    prevCursor,
    currentStatus,
    stats,
    statsLoading,
    fetchApplications,
    fetchStats,
  } = useApplicationsStore();

  useEffect(() => {
    fetchApplications();
    fetchStats();
  }, [fetchApplications, fetchStats]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'waitlisted':
        return 'bg-yellow-100 text-yellow-800';
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusFilter = (value: string) => {
    const status = value === 'all' ? null : (value as ApplicationStatus);
    fetchApplications({ status });
  };

  const handleNextPage = () => {
    if (nextCursor) {
      fetchApplications({ cursor: nextCursor });
    }
  };

  const handlePrevPage = () => {
    if (prevCursor) {
      fetchApplications({ cursor: prevCursor, direction: 'backward' });
    }
  };

  const formatName = (firstName: string | null, lastName: string | null) => {
    if (!firstName && !lastName) return '-';
    return `${firstName ?? ''} ${lastName ?? ''}`.trim();
  };

  if (loading && applications.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCards stats={stats} loading={statsLoading} />

      <div className="flex items-center justify-between">
        <Tabs
          value={currentStatus ?? 'all'}
          onValueChange={handleStatusFilter}
          className="w-auto"
        >
          <TabsList>
            <TabsTrigger value="all" disabled={loading} className="font-normal">
              All
              {stats && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                  {stats.total_applications}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="draft" disabled={loading} className="font-normal">
              Draft
              {stats && stats.draft > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                  {stats.draft}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="submitted" disabled={loading} className="font-normal">
              Submitted
              {stats && stats.submitted > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                  {stats.submitted}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="accepted" disabled={loading} className="font-normal">
              Accepted
              {stats && stats.accepted > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                  {stats.accepted}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="waitlisted" disabled={loading} className="font-normal">
              Waitlisted
              {stats && stats.waitlisted > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                  {stats.waitlisted}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rejected" disabled={loading} className="font-normal">
              Rejected
              {stats && stats.rejected > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                  {stats.rejected}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={!prevCursor || loading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!nextCursor || loading}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <CardDescription>
            {applications.length} application(s) on this page
            {currentStatus && ` (filtered by ${currentStatus})`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative overflow-x-auto p-6 pt-0">
            {loading && (
              <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            )}
            <Table className="border-collapse [&_th]:border-r [&_th]:border-gray-200 [&_td]:border-r [&_td]:border-gray-200 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0">
              <TableHeader>
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
                    <TableRow key={app.id}>
                      <TableCell>
                        <Badge className={getStatusColor(app.status)}>
                          {app.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatName(app.first_name, app.last_name)}
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
