import { useFormContext } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import type { ShortAnswerQuestion } from "@/types";

import type { ApplicationFormData } from "../validations";

interface ShortAnswerStepProps {
  questions: ShortAnswerQuestion[];
}

export function ShortAnswerStep({ questions }: ShortAnswerStepProps) {
  const form = useFormContext<ApplicationFormData>();

  const sortedQuestions = [...questions].sort(
    (a, b) => a.display_order - b.display_order,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Short Answer Questions</h2>
        <p className="text-sm text-muted-foreground">
          Tell us more about yourself.
        </p>
      </div>

      {sortedQuestions.length === 0 ? (
        <p className="text-muted-foreground">No questions configured.</p>
      ) : (
        sortedQuestions.map((q) => (
          <FormField
            key={q.id}
            control={form.control}
            name={`short_answer_responses.${q.id}`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {q.question} {q.required && "*"}
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Your answer..."
                    className="min-h-[100px]"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))
      )}
    </div>
  );
}
