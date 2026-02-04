import { useState, useEffect, useCallback, forwardRef } from 'react';
import { Textarea } from '@/components/ui/textarea';

interface NotesTextareaProps {
  reviewId: string;
  initialValue: string;
  disabled: boolean;
  rows: number;
  onNotesChange: (id: string, notes: string) => void;
}

export const NotesTextarea = forwardRef<HTMLTextAreaElement, NotesTextareaProps>(
  function NotesTextarea(
    { reviewId, initialValue, disabled, rows, onNotesChange },
    ref
  ) {
  const [value, setValue] = useState(initialValue);

  // Sync when reviewId or initialValue changes (intentional reset on prop change)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: reset local state when props change
    setValue(initialValue);
  }, [reviewId, initialValue]);

  // Sync to parent on blur
  const handleBlur = useCallback(() => {
    onNotesChange(reviewId, value);
  }, [reviewId, value, onNotesChange]);

  return (
    <Textarea
      ref={ref}
      placeholder="Press Tab to select notes..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      className="mt-1 resize-none bg-white"
      rows={rows}
      disabled={disabled}
    />
  );
});
