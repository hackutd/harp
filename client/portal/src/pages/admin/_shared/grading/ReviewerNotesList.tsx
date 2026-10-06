import type { ReviewNote } from "@/pages/admin/reviews/types";
import { cn } from "@/shared/lib/utils";

interface ReviewerNotesListProps {
  notes: ReviewNote[];
  loading: boolean;
  /** Pads itself and rules edge to edge, for a panel with no padding. */
  flush?: boolean;
}

export function ReviewerNotesList({
  notes,
  loading,
  flush = false,
}: ReviewerNotesListProps) {
  return (
    <div>
      <div
        className={cn(
          "flex items-center justify-between",
          flush && "border-b px-5 py-4",
        )}
      >
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
        <p
          className={cn(
            "text-xs text-muted-foreground",
            flush ? "px-5 py-4" : "mt-3",
          )}
        >
          Loading notes...
        </p>
      ) : notes.length > 0 ? (
        <ul className={cn("divide-y", flush ? "border-b" : "mt-1")}>
          {notes.map((note, idx) => (
            <li
              key={`${note.admin_id}-${idx}`}
              className={cn("py-3", flush && "px-5")}
            >
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
        <p
          className={cn(
            "text-xs text-muted-foreground",
            flush ? "px-5 py-4" : "mt-3",
          )}
        >
          No reviewer notes
        </p>
      )}
    </div>
  );
}
