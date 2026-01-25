import { useFormContext } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationFormData } from "@/lib/validations/applicationSchema";

export function ShortAnswerStep() {
  const form = useFormContext<ApplicationFormData>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Short Answer Questions</h2>
        <p className="text-sm text-muted-foreground">
          Help us get to know you better
        </p>
      </div>

      <FormField
        control={form.control}
        name="why_attend"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Why do you want to attend this event? *</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Share your motivation for attending..."
                className="min-h-[100px]"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="hackathons_learned"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              How many hackathons have you submitted to and what did you learn
              from them? *
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Tell us about your hackathon experiences and learnings..."
                className="min-h-[100px]"
                {...field}
              />
            </FormControl>
            <FormDescription>
              If you haven't attended any, write "N/A" and answer the next
              question instead
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="first_hackathon_goals"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              If you haven't been to a hackathon, what do you hope to learn from
              HackPortal? *
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Share what you're hoping to learn and achieve..."
                className="min-h-[100px]"
                {...field}
              />
            </FormControl>
            <FormDescription>
              If you have hackathon experience, share what you still hope to learn
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="looking_forward"
        render={({ field }) => (
          <FormItem>
            <FormLabel>What are you looking forward to at this event? *</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Share what excites you about the event..."
                className="min-h-[100px]"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
