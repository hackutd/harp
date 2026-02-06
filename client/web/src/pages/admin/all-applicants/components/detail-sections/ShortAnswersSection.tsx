import { Label } from '@/components/ui/label';
import type { Application } from '@/types';

interface ShortAnswersSectionProps {
  application: Application;
}

export function ShortAnswersSection({ application }: ShortAnswersSectionProps) {
  if (!application.short_answer_questions?.length) {
    return null;
  }

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Short Answers</h4>
      <div className="space-y-3 text-sm">
        {[...application.short_answer_questions]
          .sort((a, b) => a.display_order - b.display_order)
          .map((q) => (
            <div key={q.id}>
              <Label className="text-muted-foreground text-xs">
                {q.question} {q.required && '*'}
              </Label>
              <p className="whitespace-pre-wrap">
                {application.short_answer_responses?.[q.id] || 'N/A'}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
