import { useFormContext } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { SelectWithOther } from "../components/SelectWithOther";
import { UniversityCombobox } from "../components/UniversityComboBox";
import type { ApplicationFormData } from "../validations";
import { LEVEL_OF_STUDY_OPTIONS } from "../validations";

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
              <UniversityCombobox
                value={field.value}
                onChange={field.onChange}
                placeholder="Search for your university..."
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
            <FormLabel>Field(s) of study *</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g., Computer Science, Data Science"
                {...field}
              />
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
            <FormControl>
              <SelectWithOther
                options={LEVEL_OF_STUDY_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                placeholder="Select your level of study"
                otherPlaceholder="Please specify your level of study"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}