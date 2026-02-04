import { useEffect, useState } from 'react';
import { useApplicationsStore } from '@/store';
import { getRequest, errorAlert } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionCards } from '@/features/admin-navigation/section-cards';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import type { ApplicationStatus, Application } from '@/types';

export default function ApplicationsList() {
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

  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [applicationDetail, setApplicationDetail] = useState<Application | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchApplications();
    fetchStats();
  }, [fetchApplications, fetchStats]);

  useEffect(() => {
    if (!selectedApplicationId) {
      return;
    }

    let cancelled = false;

    (async () => {
      setDetailLoading(true);
      const res = await getRequest<Application>(
        `/v1/admin/applications/${selectedApplicationId}`,
        'application'
      );
      if (cancelled) return;

      if (res.status === 200 && res.data) {
        setApplicationDetail(res.data);
      } else {
        errorAlert(res);
        setSelectedApplicationId(null);
      }
      setDetailLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedApplicationId]);

  // Clear detail when closing panel
  const handleClosePanel = () => {
    setSelectedApplicationId(null);
    setApplicationDetail(null);
  };

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
              Prev
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

      <div className="flex">
        <Card className={`overflow-hidden flex flex-col max-h-[calc(100vh-180px)] ${selectedApplicationId ? 'w-1/2 rounded-r-none' : 'w-full'}`}>
          <CardHeader className="shrink-0">
            <CardDescription>
              {applications.length} application(s) on this page
              {currentStatus && ` (filtered by ${currentStatus})`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
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
                        className={`group hover:bg-muted/50 [&>td]:py-3 ${selectedApplicationId === app.id ? 'bg-muted/50' : ''}`}
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
                              onClick={() => setSelectedApplicationId(app.id)}
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {selectedApplicationId && (
          <Card className="w-1/2 shrink-0 rounded-l-none border-l-0 flex flex-col max-h-[calc(100vh-180px)] py-0! gap-0!">
            <div className="flex items-center justify-between shrink-0 bg-gray-50 border-b px-4 py-3 rounded-tr-xl">
              <div className="flex items-center gap-2">
                {detailLoading ? (
                  <p className="font-semibold text-muted-foreground">Loading...</p>
                ) : applicationDetail ? (
                  <>
                    <p className="font-semibold">
                      {formatName(applicationDetail.first_name, applicationDetail.last_name)}
                    </p>
                    <Badge className={getStatusColor(applicationDetail.status)}>
                      {applicationDetail.status}
                    </Badge>
                  </>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleClosePanel}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardContent className="flex-1 overflow-auto py-4">
              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : applicationDetail ? (
                <div className="space-y-6 pb-2">
                  {/* Personal Info */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Personal Information</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <Label className="text-muted-foreground text-xs">Phone</Label>
                        <p>{applicationDetail.phone_e164 || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Age</Label>
                        <p>{applicationDetail.age ?? 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Country</Label>
                        <p>{applicationDetail.country_of_residence || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Gender</Label>
                        <p>{applicationDetail.gender || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Demographics */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Demographics</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <Label className="text-muted-foreground text-xs">Race</Label>
                        <p>{applicationDetail.race || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Ethnicity</Label>
                        <p>{applicationDetail.ethnicity || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Education */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Education</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="col-span-2">
                        <Label className="text-muted-foreground text-xs">University</Label>
                        <p>{applicationDetail.university || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Major</Label>
                        <p>{applicationDetail.major || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Level of Study</Label>
                        <p>{applicationDetail.level_of_study || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Experience */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Experience</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <Label className="text-muted-foreground text-xs">Hackathons Attended</Label>
                        <p>{applicationDetail.hackathons_attended_count ?? 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Software Experience</Label>
                        <p>{applicationDetail.software_experience_level || 'N/A'}</p>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-muted-foreground text-xs">Heard About Us From</Label>
                        <p>{applicationDetail.heard_about || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Short Answers */}
                  {applicationDetail.short_answer_questions?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Short Answers</h4>
                      <div className="space-y-3 text-sm">
                        {[...applicationDetail.short_answer_questions]
                          .sort((a, b) => a.display_order - b.display_order)
                          .map((q) => (
                            <div key={q.id}>
                              <Label className="text-muted-foreground text-xs">
                                {q.question} {q.required && '*'}
                              </Label>
                              <p className="whitespace-pre-wrap">
                                {applicationDetail.short_answer_responses?.[q.id] || 'N/A'}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Event Preferences */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Event Preferences</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <Label className="text-muted-foreground text-xs">Shirt Size</Label>
                        <p>{applicationDetail.shirt_size || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Dietary Restrictions</Label>
                        <div className="flex flex-wrap gap-1">
                          {applicationDetail.dietary_restrictions?.length > 0 ? (
                            applicationDetail.dietary_restrictions.map((restriction) => (
                              <Badge key={restriction} variant="secondary" className="text-xs">
                                {restriction}
                              </Badge>
                            ))
                          ) : (
                            <span>None</span>
                          )}
                        </div>
                      </div>
                      {applicationDetail.accommodations && (
                        <div className="col-span-2">
                          <Label className="text-muted-foreground text-xs">Accommodations</Label>
                          <p>{applicationDetail.accommodations}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Links */}
                  {(applicationDetail.github || applicationDetail.linkedin || applicationDetail.website) && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Links</h4>
                      <div className="space-y-2 text-sm">
                        {applicationDetail.github && (
                          <div>
                            <Label className="text-muted-foreground text-xs">GitHub</Label>
                            <p>
                              <a
                                href={applicationDetail.github}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline break-all"
                              >
                                {applicationDetail.github}
                              </a>
                            </p>
                          </div>
                        )}
                        {applicationDetail.linkedin && (
                          <div>
                            <Label className="text-muted-foreground text-xs">LinkedIn</Label>
                            <p>
                              <a
                                href={applicationDetail.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline break-all"
                              >
                                {applicationDetail.linkedin}
                              </a>
                            </p>
                          </div>
                        )}
                        {applicationDetail.website && (
                          <div>
                            <Label className="text-muted-foreground text-xs">Website</Label>
                            <p>
                              <a
                                href={applicationDetail.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline break-all"
                              >
                                {applicationDetail.website}
                              </a>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Timeline</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <Label className="text-muted-foreground text-xs">Submitted</Label>
                        <p>{applicationDetail.submitted_at ? new Date(applicationDetail.submitted_at).toLocaleString() : 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Created</Label>
                        <p>{new Date(applicationDetail.created_at).toLocaleString()}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Last Updated</Label>
                        <p>{new Date(applicationDetail.updated_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
