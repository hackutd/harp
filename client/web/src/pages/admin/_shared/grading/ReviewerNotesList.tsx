import { MessageSquare } from "lucide-react";

import { Label } from "@/components/ui/label";
import type { ReviewNote } from "@/pages/admin/assigned/types";

interface ReviewerNotesListProps {
  notes: ReviewNote[];
  loading: boolean;
}

export function ReviewerNotesList({ notes, loading }: ReviewerNotesListProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2.5">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm text-muted-foreground">
          Reviewer Notes ({notes.length})
        </Label>
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading notes...</div>
      ) : notes.length > 0 ? (
        <div className="space-y-2.5">
          {notes.map((note, idx) => (
            <div
              key={`${note.admin_id}-${idx}`}
              className="bg-white border rounded-md p-3 text-sm"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-muted-foreground">
                  {note.admin_email}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(note.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {note.notes}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          No reviewer notes
        </p>
      )}
    </div>
  );
}
