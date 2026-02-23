import { useFormContext } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import type { ApplicationFormData } from "../validations";

export function SponsorInfoStep() {
  const form = useFormContext<ApplicationFormData>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Sponsor Information</h2>
        <p className="text-sm text-muted-foreground">
          Share your profiles with our sponsors (all optional)
        </p>
      </div>

      <FormField
        control={form.control}
        name="github"
        render={({ field }) => (
          <FormItem>
            <FormLabel>GitHub</FormLabel>
            <FormControl>
              <Input placeholder="https://github.com/username" {...field} />
            </FormControl>
            <FormDescription>Optional</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="linkedin"
        render={({ field }) => (
          <FormItem>
            <FormLabel>LinkedIn</FormLabel>
            <FormControl>
              <Input
                placeholder="https://linkedin.com/in/username"
                {...field}
              />
            </FormControl>
            <FormDescription>Optional</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="website"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Personal Website</FormLabel>
            <FormControl>
              <Input placeholder="https://yourwebsite.com" {...field} />
            </FormControl>
            <FormDescription>Optional</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
