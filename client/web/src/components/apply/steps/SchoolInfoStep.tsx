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
import { LEVEL_OF_STUDY_OPTIONS } from "@/lib/validations/applicationSchema";

export function SchoolInfoStep() {
  const form = useFormContext<ApplicationFormData>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">School Information</h2>
        <p className="text-sm text-muted-foreground">
          Tell us about your academic background
        </p>
      </div>

      <FormField
        control={form.control}
        name="university"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Which university do you attend? *</FormLabel>
            <FormControl>
              <Input
                placeholder="University of Texas at Dallas"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="major"
        render={({ field }) => (
          <FormItem>
            <FormLabel>What is your major? *</FormLabel>
            <FormControl>
              <Input placeholder="Computer Science" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="level_of_study"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Current level of study *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select your level of study" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {LEVEL_OF_STUDY_OPTIONS.map((option) => (
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
