import { useEffect } from 'react';
import { Link } from 'react-router-dom';
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
import type { BackendApplicationStatus } from '../../types';

export default function Applications() {
  const {
    applications,
    loading,
    nextCursor,
    prevCursor,
    currentStatus,
    fetchApplications,
  } = useApplicationsStore();

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

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

  const handleStatusFilter = (status: BackendApplicationStatus | null) => {
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Applications Management</h1>
          <p className="text-gray-600 mt-2">Review and manage hacker applications</p>
        </div>

        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={currentStatus === null ? 'default' : 'outline'}
              onClick={() => handleStatusFilter(null)}
              disabled={loading}
            >
              All
            </Button>
            <Button
              variant={currentStatus === 'draft' ? 'default' : 'outline'}
              onClick={() => handleStatusFilter('draft')}
              disabled={loading}
            >
              Draft
            </Button>
            <Button
              variant={currentStatus === 'submitted' ? 'default' : 'outline'}
              onClick={() => handleStatusFilter('submitted')}
              disabled={loading}
            >
              Submitted
            </Button>
            <Button
              variant={currentStatus === 'accepted' ? 'default' : 'outline'}
              onClick={() => handleStatusFilter('accepted')}
              disabled={loading}
            >
              Accepted
            </Button>
            <Button
              variant={currentStatus === 'waitlisted' ? 'default' : 'outline'}
              onClick={() => handleStatusFilter('waitlisted')}
              disabled={loading}
            >
              Waitlisted
            </Button>
            <Button
              variant={currentStatus === 'rejected' ? 'default' : 'outline'}
              onClick={() => handleStatusFilter('rejected')}
              disabled={loading}
            >
              Rejected
            </Button>
          </div>

          <div className="ml-auto">
            <Link to="/admin/settings">
              <Button variant="outline">Settings</Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
            <CardDescription>
              {applications.length} application(s) on this page
              {currentStatus && ` (filtered by ${currentStatus})`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {loading && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>University</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500">
                        No applications found
                      </TableCell>
                    </TableRow>
                  ) : (
                    applications.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium">
                          {formatName(app.first_name, app.last_name)}
                        </TableCell>
                        <TableCell>{app.email}</TableCell>
                        <TableCell>{app.university ?? '-'}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(app.status)}>
                            {app.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {app.submitted_at
                            ? new Date(app.submitted_at).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Link to={`/admin/applications/${app.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {(prevCursor || nextCursor) && (
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handlePrevPage}
                  disabled={!prevCursor || loading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={handleNextPage}
                  disabled={!nextCursor || loading}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
