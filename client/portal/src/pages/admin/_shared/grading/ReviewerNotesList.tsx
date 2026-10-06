import type { ReviewNote } from "@/pages/admin/reviews/types";

interface ReviewerNotesListProps {
  notes: ReviewNote[];
  loading: boolean;
}

export function ReviewerNotesList({ notes, loading }: ReviewerNotesListProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-normal uppercase tracking-wider text-foreground">
          Reviewer notes
        </h3>
        {!loading && notes.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {notes.length}
          </span>
        )}
      </div>
      {loading ? (
        <p className="mt-3 text-xs text-muted-foreground">Loading notes...</p>
      ) : notes.length > 0 ? (
        <ul className="mt-1 divide-y">
          {notes.map((note, idx) => (
            <li key={`${note.admin_id}-${idx}`} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-xs text-muted-foreground">
                  {note.admin_email}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {new Date(note.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                {note.notes}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No reviewer notes</p>
      )}
    </div>
  );
}
