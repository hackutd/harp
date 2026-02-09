import { ClipboardPen, Minimize2, X } from 'lucide-react';
import { useCallback, useEffect, useRef,useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Tooltip, TooltipContent,TooltipTrigger } from '@/components/ui/tooltip';
import { errorAlert,getRequest } from '@/shared/lib/api';
import type { Application } from '@/types';

import { ApplicationDetailsPanel } from './components/ApplicationDetailsPanel';
import { ReviewsTable } from './components/ReviewsTable';
import { VoteBadge } from './components/VoteBadge';
import { VotingPanel } from './components/VotingPanel';
import { useReviewKeyboardShortcuts } from './hooks/useReviewKeyboardShortcuts';
import { useReviewsStore } from './store';
import type { NotesListResponse,ReviewNote, ReviewVote } from './types';

function formatName(firstName: string | null, lastName: string | null) {
  if (!firstName && !lastName) return '-';
  return `${firstName ?? ''} ${lastName ?? ''}`.trim();
}

export default function AssignedPage() {
  const { reviews, loading, submitting, fetchPendingReviews, submitVote } = useReviewsStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applicationDetail, setApplicationDetail] = useState<Application | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [otherReviewerNotes, setOtherReviewerNotes] = useState<ReviewNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [localVotes, setLocalVotes] = useState<Record<string, ReviewVote | null>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

  const selectReview = useCallback((id: string | null) => {
    setSelectedId(id);
    if (!id) {
      setApplicationDetail(null);
      setOtherReviewerNotes([]);
    }
  }, []);

  useEffect(() => {
    fetchPendingReviews();
  }, [fetchPendingReviews]);

  // Fetch full application and other reviewers' notes when a review is selected
  useEffect(() => {
    if (!selectedId) return;

    const selectedReview = reviews.find((r) => r.id === selectedId);
    if (!selectedReview) return;

    let cancelled = false;

    (async () => {
      setDetailLoading(true);
      setNotesLoading(true);

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

  const getVote = useCallback(
    (reviewId: string, serverVote: ReviewVote | null): ReviewVote | null => {
      return reviewId in localVotes ? localVotes[reviewId] : serverVote;
    },
    [localVotes]
  );

  const getNotes = useCallback(
    (reviewId: string, serverNotes: string | null): string => {
      return reviewId in localNotes ? localNotes[reviewId] : serverNotes ?? '';
    },
    [localNotes]
  );

  const handleVote = useCallback(
    async (id: string, vote: ReviewVote) => {
      if (submitting) return;

      const review = reviews.find((r) => r.id === id);
      if (review?.vote) return;

      const currentIndex = reviews.findIndex((r) => r.id === id);
      const nextReview = reviews[currentIndex + 1] ?? reviews[currentIndex - 1] ?? null;

      const notes = getNotes(id, review?.notes ?? null);
      const result = await submitVote(id, {
        vote,
        notes: notes || undefined,
      });

      if (result.success) {
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
        selectReview(nextReview?.id ?? null);
      } else {
        alert(result.error || 'Failed to submit vote');
      }
    },
    [submitting, reviews, getNotes, submitVote, selectReview]
  );

  const handleNotesChange = useCallback((id: string, notes: string) => {
    setLocalNotes((prev) => ({ ...prev, [id]: notes }));
  }, []);

  const handleClosePanel = useCallback(() => {
    selectReview(null);
    setIsExpanded(false);
  }, [selectReview]);

  const handleCloseExpanded = useCallback(() => {
    setIsExpanded(false);
  }, []);

  useReviewKeyboardShortcuts({
    isExpanded,
    selectedId,
    reviews,
    submitting,
    notesTextareaRef,
    onVote: handleVote,
    onNavigate: selectReview,
    onCloseExpanded: handleCloseExpanded,
  });

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

  const vote = selectedReview ? getVote(selectedReview.id, selectedReview.vote) : null;
  const notes = selectedReview ? getNotes(selectedReview.id, selectedReview.notes) : '';

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
            <CardHeader className="shrink-0 flex flex-row items-center justify-between">
              <CardDescription className='font-light'>{reviews.length} review(s) assigned to you</CardDescription>
              {reviews.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer font-light"
                      onClick={() => {
                        selectReview(reviews[0].id);
                        setIsExpanded(true);
                      }}
                    >
                      <ClipboardPen className="h-4 w-4 mr-1.5" />
                      Start Grading
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Grade {formatName(reviews[0].first_name, reviews[0].last_name)}</TooltipContent>
                </Tooltip>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ReviewsTable
                reviews={reviews}
                selectedId={selectedId}
                loading={loading}
                onSelectReview={selectReview}
                getVote={getVote}
              />
            </CardContent>
          </Card>
        )}

        {/* Right: Detail Panel */}
        {selectedId && selectedReview && (
          <Card
            className={`shrink-0 flex flex-col h-full py-0! gap-0! ${
              isExpanded ? 'w-full rounded-xl' : 'w-1/2 rounded-l-none border-l-0'
            }`}
          >
            {/* Header */}
            <div
              className={`flex items-center justify-between shrink-0 bg-gray-50 border-b px-4 py-3 ${
                isExpanded ? 'rounded-t-xl' : 'rounded-tr-xl'
              }`}
            >
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">
                  {formatName(selectedReview.first_name, selectedReview.last_name)}
                </p>
                <VoteBadge vote={vote} />
              </div>
              <div className="flex items-center gap-1">
                {isExpanded ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="cursor-pointer"
                        onClick={() => setIsExpanded(false)}
                      >
                        <Minimize2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Close (Esc)</TooltipContent>
                  </Tooltip>
                ) : (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="cursor-pointer"
                          onClick={() => setIsExpanded(true)}
                        >
                          <ClipboardPen className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Grade applicant</TooltipContent>
                    </Tooltip>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="cursor-pointer"
                      onClick={handleClosePanel}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
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
                  ) : (
                    applicationDetail && (
                      <ApplicationDetailsPanel
                        application={applicationDetail}
                        selectedReview={selectedReview}
                        isExpanded={isExpanded}
                      />
                    )
                  )}
                </div>

                {/* Right: Comments & Vote column (1/4) */}
                <div className="w-1/4 flex flex-col bg-gray-50">
                  <div className="flex-1 overflow-auto p-4">
                    <VotingPanel
                      review={selectedReview}
                      notes={notes}
                      otherReviewerNotes={otherReviewerNotes}
                      notesLoading={notesLoading}
                      isExpanded={isExpanded}
                      submitting={submitting}
                      notesTextareaRef={notesTextareaRef}
                      onNotesChange={handleNotesChange}
                      onVote={handleVote}
                    />
                  </div>
                  {/* Navigation arrows - fixed at bottom of sidebar */}
                  <div className="shrink-0 border-t bg-gray-50 p-4 pt-2">
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Use{' '}
                      <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">←</kbd>{' '}
                      <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">→</kbd>{' '}
                      arrow keys to navigate
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
                ) : (
                  applicationDetail && (
                    <ApplicationDetailsPanel
                      application={applicationDetail}
                      selectedReview={selectedReview}
                      isExpanded={isExpanded}
                    />
                  )
                )}
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
