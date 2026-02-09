import { MessageSquare,Minus, ThumbsDown, ThumbsUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import type { Review, ReviewNote,ReviewVote } from '../types';
import { NotesTextarea } from './NotesTextarea';
import { VoteBadge } from './VoteBadge';

interface VotingPanelProps {
  review: Review;
  notes: string;
  otherReviewerNotes: ReviewNote[];
  notesLoading: boolean;
  isExpanded: boolean;
  submitting: boolean;
  notesTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onNotesChange: (id: string, notes: string) => void;
  onVote: (id: string, vote: ReviewVote) => void;
}

export function VotingPanel({
  review,
  notes,
  otherReviewerNotes,
  notesLoading,
  isExpanded,
  submitting,
  notesTextareaRef,
  onNotesChange,
  onVote,
}: VotingPanelProps) {
  return (
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
          {!review.vote && (
            <span className="text-xs text-muted-foreground italic">
              Write notes before casting your vote
            </span>
          )}
        </div>
        <NotesTextarea
          ref={notesTextareaRef}
          reviewId={review.id}
          initialValue={notes}
          disabled={submitting || !!review.vote}
          rows={isExpanded ? 4 : 3}
          onNotesChange={onNotesChange}
        />
      </div>

      {review.vote ? (
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground">
            You voted: <VoteBadge vote={review.vote} />
          </p>
          {review.reviewed_at && (
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(review.reviewed_at).toLocaleString()}
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Cast your vote</p>
          <div className={`flex gap-2 ${isExpanded ? 'flex-col' : ''}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 cursor-pointer hover:bg-red-50 hover:text-red-700 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => onVote(review.id, 'reject')}
                  disabled={submitting}
                >
                  <ThumbsDown className="h-4 w-4 mr-1.5" />
                  Reject
                  {isExpanded && (
                    <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">
                      ⌘J
                    </kbd>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reject (⌘J)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 cursor-pointer hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => onVote(review.id, 'waitlist')}
                  disabled={submitting}
                >
                  <Minus className="h-4 w-4 mr-1.5" />
                  Waitlist
                  {isExpanded && (
                    <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">
                      ⌘K
                    </kbd>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Waitlist (⌘K)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 cursor-pointer hover:bg-green-50 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => onVote(review.id, 'accept')}
                  disabled={submitting}
                >
                  <ThumbsUp className="h-4 w-4 mr-1.5" />
                  Accept
                  {isExpanded && (
                    <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">
                      ⌘L
                    </kbd>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Accept (⌘L)</TooltipContent>
            </Tooltip>
          </div>
          {submitting && (
            <p className="text-xs text-muted-foreground text-center">Submitting vote...</p>
          )}
        </>
      )}
    </div>
  );
}
