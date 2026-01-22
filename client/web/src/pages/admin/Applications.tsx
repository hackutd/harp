import { useEffect, useState } from 'react';
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

export default function Applications() {
  const { applications, loading, fetchApplications } = useApplicationsStore();
  const [filter, setFilter] = useState<string>('all');

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
      case 'in_review':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredApplications = filter === 'all'
    ? applications
    : applications.filter(app => app.status === filter);

  if (loading) {
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
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              All ({applications.length})
            </Button>
            <Button
              variant={filter === 'pending' ? 'default' : 'outline'}
              onClick={() => setFilter('pending')}
            >
              Pending
            </Button>
            <Button
              variant={filter === 'in_review' ? 'default' : 'outline'}
              onClick={() => setFilter('in_review')}
            >
              In Review
            </Button>
            <Button
              variant={filter === 'accepted' ? 'default' : 'outline'}
              onClick={() => setFilter('accepted')}
            >
              Accepted
            </Button>
            <Button
              variant={filter === 'waitlisted' ? 'default' : 'outline'}
              onClick={() => setFilter('waitlisted')}
            >
              Waitlisted
            </Button>
            <Button
              variant={filter === 'rejected' ? 'default' : 'outline'}
              onClick={() => setFilter('rejected')}
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
              {filteredApplications.length} application(s) found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Major</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500">
                      No applications found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredApplications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">
                        {app.firstName} {app.lastName}
                      </TableCell>
                      <TableCell>{app.email}</TableCell>
                      <TableCell>{app.school}</TableCell>
                      <TableCell>{app.major}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(app.status)}>
                          {app.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(app.createdAt).toLocaleDateString()}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
