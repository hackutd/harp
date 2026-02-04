import { useEffect, useState, useCallback, useRef } from 'react';
import { useReviewsStore } from '@/store';
import { getRequest, errorAlert } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
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
import { ClipboardPen, Minimize2, X, ThumbsDown, Minus, ThumbsUp, MessageSquare, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import type { ReviewVote, Application, ReviewNote, NotesListResponse } from '@/types';
import { NotesTextarea } from './NotesTextarea';

export default function Assigned() {
  const { reviews, loading, submitting, fetchPendingReviews, submitVote } = useReviewsStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applicationDetail, setApplicationDetail] = useState<Application | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [otherReviewerNotes, setOtherReviewerNotes] = useState<ReviewNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  // Local overrides for votes and notes (keyed by review id)
  const [localVotes, setLocalVotes] = useState<Record<string, ReviewVote | null>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchPendingReviews();
  }, [fetchPendingReviews]);

  // Fetch full application and other reviewers' notes when a review is selected
  useEffect(() => {
    if (!selectedId) {
      setApplicationDetail(null);
      setOtherReviewerNotes([]);
      return;
    }

    const selectedReview = reviews.find((r) => r.id === selectedId);
    if (!selectedReview) return;

    let cancelled = false;

    (async () => {
      setDetailLoading(true);
      setNotesLoading(true);

      // Fetch application details and other reviewers' notes in parallel
      const [appRes, notesRes] = await Promise.all([
        getRequest<Application>(
          `/v1/admin/applications/${selectedReview.application_id}`,
          'application'
        ),
        getRequest<NotesListResponse>(
          `/v1/admin/applications/${selectedReview.application_id}/notes`,
          'notes'
        ),
      ]);

      if (cancelled) return;

      if (appRes.status === 200 && appRes.data) {
        setApplicationDetail(appRes.data);
      } else {
        errorAlert(appRes);
      }

      if (notesRes.status === 200 && notesRes.data) {
        setOtherReviewerNotes(notesRes.data.notes);
      }

      setDetailLoading(false);
      setNotesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId, reviews]);

  const selectedReview = reviews.find((r) => r.id === selectedId) ?? null;

  const getVote = (reviewId: string, serverVote: ReviewVote | null): ReviewVote | null => {
    return reviewId in localVotes ? localVotes[reviewId] : serverVote;
  };

  const getNotes = (reviewId: string, serverNotes: string | null): string => {
    return reviewId in localNotes ? localNotes[reviewId] : serverNotes ?? '';
  };

  const handleVote = useCallback(async (id: string, vote: ReviewVote) => {
    if (submitting) return;

    // Don't allow re-voting on already voted reviews
    const review = reviews.find((r) => r.id === id);
    if (review?.vote) return;

    // Calculate next application BEFORE submitting (since reviews array will change)
    const currentIndex = reviews.findIndex((r) => r.id === id);
    const nextReview = reviews[currentIndex + 1] ?? reviews[currentIndex - 1] ?? null;

    const notes = getNotes(id, review?.notes ?? null);
    const result = await submitVote(id, {
      vote,
      notes: notes || undefined,
    });

    if (result.success) {
      // Clear local state for this review
      setLocalVotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setLocalNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      // Auto-advance to next application (or close panel if none left)
      setSelectedId(nextReview?.id ?? null);
    } else {
      alert(result.error || 'Failed to submit vote');
    }
  }, [submitting, reviews, localNotes, submitVote]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLInputElement;

      // Tab: Focus notes textarea in expanded view
      if (e.key === 'Tab' && isExpanded && selectedId && !isInputFocused) {
        e.preventDefault();
        notesTextareaRef.current?.focus();
        return;
      }

      // Arrow keys: Navigate between reviews (only when not typing)
      if (!isInputFocused && reviews.length > 0) {
        const currentIndex = selectedId ? reviews.findIndex((r) => r.id === selectedId) : -1;

        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          if (currentIndex > 0) {
            setSelectedId(reviews[currentIndex - 1].id);
          } else if (currentIndex === -1) {
            // No selection, select the last one
            setSelectedId(reviews[reviews.length - 1].id);
          }
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          if (currentIndex === -1) {
            // No selection, select the first one
            setSelectedId(reviews[0].id);
          } else if (currentIndex < reviews.length - 1) {
            setSelectedId(reviews[currentIndex + 1].id);
          }
        }
      }

      // Cmd/Ctrl + J/K/L: Vote shortcuts (only in expanded view with selected review)
      if ((e.metaKey || e.ctrlKey) && isExpanded && selectedId) {
        const selectedReview = reviews.find((r) => r.id === selectedId);
        // Don't allow voting if already voted or submitting
        if (selectedReview?.vote || submitting) return;

        if (e.key === 'j') {
          e.preventDefault();
          handleVote(selectedId, 'reject');
        } else if (e.key === 'k') {
          e.preventDefault();
          handleVote(selectedId, 'waitlist');
        } else if (e.key === 'l') {
          e.preventDefault();
          handleVote(selectedId, 'accept');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, selectedId, reviews, submitting, handleVote]);

  const handleNotesChange = useCallback((id: string, notes: string) => {
    setLocalNotes((prev) => ({ ...prev, [id]: notes }));
  }, []);

  const handleClosePanel = () => {
    setSelectedId(null);
    setApplicationDetail(null);
    setIsExpanded(false);
  };

  const getVoteBadge = (vote: ReviewVote | null) => {
    switch (vote) {
      case 'accept':
        return <Badge className="bg-green-100 text-green-800">Accept</Badge>;
      case 'waitlist':
        return <Badge className="bg-yellow-100 text-yellow-800">Waitlist</Badge>;
      case 'reject':
        return <Badge className="bg-red-100 text-red-800">Reject</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Pending</Badge>;
    }
  };

  const formatName = (firstName: string | null, lastName: string | null) => {
    if (!firstName && !lastName) return '-';
    return `${firstName ?? ''} ${lastName ?? ''}`.trim();
  };

  if (loading && reviews.length === 0) {
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
    <div className="h-[calc(100vh-80px)] overflow-hidden">
      <div className="flex h-full">
        {/* Left: Table */}
        {!isExpanded && (
        <Card
          className={`overflow-hidden flex flex-col h-full ${
            selectedId ? 'w-1/2 rounded-r-none' : 'w-full'
          }`}
        >
          <CardHeader className='shrink-0'>
            <CardDescription>
              {reviews.length} review(s) assigned to you
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
                    <TableHead>Vote</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>University</TableHead>
                    <TableHead>Major</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Hackathons</TableHead>
                    <TableHead>Assigned At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-gray-500">
                        No pending reviews
                      </TableCell>
                    </TableRow>
                  ) : (
                    reviews.map((review) => {
                      const vote = getVote(review.id, review.vote);
                      return (
                        <TableRow
                          key={review.id}
                          className={`group hover:bg-muted/50 [&>td]:py-3 cursor-pointer ${
                            selectedId === review.id ? 'bg-muted/50' : ''
                          }`}
                          onClick={() => setSelectedId(review.id)}
                        >
                          <TableCell>{getVoteBadge(vote)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center justify-between gap-4">
                              <span>{formatName(review.first_name, review.last_name)}</span>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="opacity-0 cursor-pointer group-hover:opacity-100 transition-opacity h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedId(review.id);
                                }}
                              >
                                <Maximize2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{review.email}</TableCell>
                          <TableCell>{review.age ?? '-'}</TableCell>
                          <TableCell>{review.university ?? '-'}</TableCell>
                          <TableCell>{review.major ?? '-'}</TableCell>
                          <TableCell>{review.country_of_residence ?? '-'}</TableCell>
                          <TableCell>{review.hackathons_attended_count ?? '-'}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {new Date(review.assigned_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Right: Detail Panel */}
        {selectedId && selectedReview && (() => {
          const vote = getVote(selectedReview.id, selectedReview.vote);
          const notes = getNotes(selectedReview.id, selectedReview.notes);
          const gridCols = isExpanded ? 'grid-cols-4' : 'grid-cols-2';

          // Application details JSX (inlined to avoid remounting issues)
          const applicationDetailsContent = applicationDetail && (
            <div className="space-y-6 pb-2">
              {/* Personal Info */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Personal Information</h4>
                <div className={`grid ${gridCols} gap-3 text-sm`}>
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
                <div className={`grid ${gridCols} gap-3 text-sm`}>
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
                <div className={`grid ${gridCols} gap-3 text-sm`}>
                  <div className={isExpanded ? '' : 'col-span-2'}>
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
                <div className={`grid ${gridCols} gap-3 text-sm`}>
                  <div>
                    <Label className="text-muted-foreground text-xs">Hackathons Attended</Label>
                    <p>{applicationDetail.hackathons_attended_count ?? 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Software Experience</Label>
                    <p>{applicationDetail.software_experience_level || 'N/A'}</p>
                  </div>
                  <div className={isExpanded ? '' : 'col-span-2'}>
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
                <div className={`grid ${gridCols} gap-3 text-sm`}>
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
                    <div className={isExpanded ? '' : 'col-span-2'}>
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
                  <div className={`grid ${isExpanded ? 'grid-cols-3' : 'grid-cols-1'} gap-2 text-sm`}>
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
                <div className={`grid ${gridCols} gap-3 text-sm`}>
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

              {/* Review Info */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Review Details</h4>
                <div className={`grid ${gridCols} gap-3 text-sm`}>
                  <div className={isExpanded ? '' : 'col-span-2'}>
                    <Label className="text-muted-foreground text-xs">Application ID</Label>
                    <p className="font-mono text-xs">{selectedReview.application_id}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Assigned At</Label>
                    <p>{new Date(selectedReview.assigned_at).toLocaleString()}</p>
                  </div>
                  {selectedReview.reviewed_at && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Reviewed At</Label>
                      <p>{new Date(selectedReview.reviewed_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );

          // Notes and voting JSX (inlined to avoid remounting issues)
          const notesAndVotingContent = (
            <div className="space-y-3">
              {/* Other Reviewers' Notes */}
              {otherReviewerNotes.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">
                      Other Reviewers' Notes ({otherReviewerNotes.length})
                    </Label>
                  </div>
                  <div className={`space-y-2 overflow-y-auto ${isExpanded ? 'max-h-48' : 'max-h-32'}`}>
                    {otherReviewerNotes.map((note, idx) => (
                      <div
                        key={`${note.admin_id}-${idx}`}
                        className="bg-white border rounded-md p-2 text-sm"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            {note.admin_email}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(note.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{note.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {notesLoading && otherReviewerNotes.length === 0 && (
                <div className="text-xs text-muted-foreground">Loading notes...</div>
              )}

              {/* Your Notes */}
              <div>
                <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Your Notes</Label>
                  {!selectedReview.vote && (
                    <span className="text-xs text-muted-foreground italic">
                      Write notes before casting your vote
                    </span>
                  )}
                </div>
                <NotesTextarea
                  ref={notesTextareaRef}
                  reviewId={selectedReview.id}
                  initialValue={notes}
                  disabled={submitting || !!selectedReview.vote}
                  rows={isExpanded ? 4 : 3}
                  onNotesChange={handleNotesChange}
                />
              </div>

              {selectedReview.vote ? (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground">
                    You voted: {getVoteBadge(selectedReview.vote)}
                  </p>
                  {selectedReview.reviewed_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(selectedReview.reviewed_at).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Cast your vote</p>
                  <div className={`flex gap-2 ${isExpanded ? 'flex-col' : ''}`}>
                    <Button
                      variant="outline"
                      className="flex-1 cursor-pointer hover:bg-red-50 hover:text-red-700 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleVote(selectedReview.id, 'reject')}
                      disabled={submitting}
                    >
                      <ThumbsDown className="h-4 w-4 mr-1.5" />
                      Reject
                      {isExpanded && <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">⌘J</kbd>}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 cursor-pointer hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleVote(selectedReview.id, 'waitlist')}
                      disabled={submitting}
                    >
                      <Minus className="h-4 w-4 mr-1.5" />
                      Waitlist
                      {isExpanded && <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">⌘K</kbd>}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 cursor-pointer hover:bg-green-50 hover:text-green-700  disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleVote(selectedReview.id, 'accept')}
                      disabled={submitting}
                    >
                      <ThumbsUp className="h-4 w-4 mr-1.5" />
                      Accept
                      {isExpanded && <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">⌘L</kbd>}
                    </Button>
                  </div>
                  {submitting && (
                    <p className="text-xs text-muted-foreground text-center">Submitting vote...</p>
                  )}
                </>
              )}

            </div>
          );

          return (
            <Card className={`shrink-0 flex flex-col h-full py-0! gap-0! ${
              isExpanded
                ? 'w-full rounded-xl'
                : 'w-1/2 rounded-l-none border-l-0'
            }`}>
              {/* Header */}
              <div className={`flex items-center justify-between shrink-0 bg-gray-50 border-b px-4 py-3 ${
                isExpanded ? 'rounded-t-xl' : 'rounded-tr-xl'
              }`}>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">
                    {formatName(selectedReview.first_name, selectedReview.last_name)}
                  </p>
                  {getVoteBadge(vote)}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => setIsExpanded(!isExpanded)}>
                    {isExpanded ? <Minimize2 className="h-4 w-4" /> : <ClipboardPen className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={handleClosePanel}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Content area - different layout based on mode */}
              {isExpanded ? (
                <div className="flex flex-1 overflow-hidden">
                  {/* Left: Application details (3/4) */}
                  <div className="w-3/4 overflow-auto p-6 border-r">
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                      </div>
                    ) : applicationDetailsContent}
                  </div>

                  {/* Right: Comments & Vote column (1/4) */}
                  <div className="w-1/4 flex flex-col bg-gray-50">
                    <div className="flex-1 overflow-auto p-4">
                      {notesAndVotingContent}
                    </div>
                    {/* Navigation arrows - fixed at bottom of sidebar */}
                    <div className="shrink-0 border-t bg-gray-50 p-4 pt-2">
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        Use <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">←</kbd> <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">→</kbd> arrow keys to navigate
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <CardContent className="flex-1 overflow-auto py-4">
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                  ) : applicationDetailsContent}
                </CardContent>
              )}
            </Card>
          );
        })()}
      </div>
    </div>
  );
}
