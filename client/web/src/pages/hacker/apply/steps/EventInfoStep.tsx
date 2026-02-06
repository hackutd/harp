import { useFormContext } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { ApplicationFormData } from "../validations";
import {
  DIETARY_RESTRICTION_OPTIONS,
  SHIRT_SIZE_OPTIONS,
} from "../validations";

export function EventInfoStep() {
  const form = useFormContext<ApplicationFormData>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Event Information</h2>
        <p className="text-sm text-muted-foreground">
          Help us prepare for your attendance
        </p>
      </div>

      <FormField
        control={form.control}
        name="shirt_size"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Shirt Size *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select your shirt size" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {SHIRT_SIZE_OPTIONS.map((option) => (
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
        name="dietary_restrictions"
        render={() => (
          <FormItem>
            <FormLabel>Allergies / Dietary Restrictions</FormLabel>
            <FormDescription>
              Select all that apply (optional)
            </FormDescription>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {DIETARY_RESTRICTION_OPTIONS.map((option) => (
                <FormField
                  key={option.value}
                  control={form.control}
                  name="dietary_restrictions"
                  render={({ field }) => {
                    const value = field.value || [];
                    return (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={value.includes(option.value as typeof value[number])}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...value, option.value]);
                              } else {
                                field.onChange(
                                  value.filter((v) => v !== option.value)
                                );
                              }
                            }}
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal cursor-pointer">
                          {option.label}
                        </FormLabel>
                      </FormItem>
                    );
                  }}
                />
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="accommodations"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Anything else we can do to better accommodate you at our hackathon?
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="List any accessibility concerns or special accommodations needed..."
                className="min-h-[80px]"
                {...field}
              />
            </FormControl>
            <FormDescription>Optional</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
