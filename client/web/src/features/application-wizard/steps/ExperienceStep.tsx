import { useFormContext } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApplicationFormData } from "@/lib/validations/applicationSchema";
import {
  EXPERIENCE_LEVEL_OPTIONS,
  HEARD_ABOUT_OPTIONS,
} from "@/lib/validations/applicationSchema";

export function ExperienceStep() {
  const form = useFormContext<ApplicationFormData>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Hackathon Experience</h2>
        <p className="text-sm text-muted-foreground">
          Tell us about your experience with hackathons and software development
        </p>
      </div>

      <FormField
        control={form.control}
        name="hackathons_attended_count"
        render={({ field }) => (
          <FormItem>
            <FormLabel>How many hackathons have you attended before? *</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={0}
                placeholder="0"
                {...field}
                onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
              />
            </FormControl>
            <FormMessage />
            <p className="text-xs text-muted-foreground">
              Enter 0 if this is your first hackathon
            </p>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="software_experience_level"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Relative software-building experience *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select your experience level" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {EXPERIENCE_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="heard_about"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Where did you hear about this event? *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select how you heard about us" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {HEARD_ABOUT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
