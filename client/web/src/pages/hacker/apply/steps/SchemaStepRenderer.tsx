import { type FieldValues, useFormContext } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
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
import { Textarea } from "@/components/ui/textarea";
import { renderLabel } from "@/shared/lib/schema-utils";
import { cn } from "@/shared/lib/utils";
import type { ApplicationSchemaField } from "@/types";

type ApplicationFormValues = FieldValues & Record<string, unknown>;
type FormContext = ReturnType<typeof useFormContext<ApplicationFormValues>>;

const underlineField =
  "h-11 rounded-none border-0 border-b border-[#D9D9D9] bg-transparent px-0 text-base font-light shadow-none transition-colors focus-visible:border-black focus-visible:ring-0 dark:bg-transparent";

const fieldLabel = "text-xs font-light text-[#8A8A8A]";

interface SchemaStepRendererProps {
  sectionLabel: string;
  fields: ApplicationSchemaField[];
  /** Extra content rendered before the fields (e.g., read-only email). */
  header?: React.ReactNode;
}

export function SchemaStepRenderer({
  sectionLabel,
  fields,
  header,
}: SchemaStepRendererProps) {
  const form = useFormContext<ApplicationFormValues>();

  // Index of the first optional field that follows required ones, used to
  // render an "OPTIONAL" divider between the two groups.
  const firstOptionalIndex = fields.findIndex(
    (f, i) => !f.required && fields.slice(0, i).some((p) => p.required),
  );

  return (
    <div className="space-y-7">
      <h1 className="text-3xl font-light tracking-tight text-black">
        {sectionLabel}
      </h1>

      {header}

      {fields.length === 0 && (
        <p className="text-sm font-light text-[#8A8A8A]">
          No fields configured.
        </p>
      )}

      {fields.map((field, index) => (
        <div key={field.id} className="space-y-7">
          {index === firstOptionalIndex && (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-[11px] font-light tracking-[0.2em] text-[#B8B8B8]">
                OPTIONAL
              </span>
              <span className="h-px flex-1 bg-[#EDEDED]" />
            </div>
          )}
          <SchemaFormField field={field} form={form} />
        </div>
      ))}
    </div>
  );
}

function SchemaFormField({
  field,
  form,
}: {
  field: ApplicationSchemaField;
  form: FormContext;
}) {
  const requiredMark = field.required ? " *" : "";
  const validation = field.validation ?? {};

  switch (field.type) {
    case "text":
      return (
        <FormField
          control={form.control}
          name={field.id}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel className={fieldLabel}>
                {field.label}
                {requiredMark}
              </FormLabel>
              <FormControl>
                <Input
                  className={underlineField}
                  {...formField}
                  value={formField.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "phone":
      return (
        <FormField
          control={form.control}
          name={field.id}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel className={fieldLabel}>
                {field.label}
                {requiredMark}
              </FormLabel>
              <FormControl>
                <Input
                  className={underlineField}
                  placeholder="+12025551234"
                  {...formField}
                  value={formField.value ?? ""}
                />
              </FormControl>
              <FormDescription className="text-xs font-light">
                Include country code (e.g., +1 for US)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "number":
      return (
        <FormField
          control={form.control}
          name={field.id}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel className={fieldLabel}>
                {field.label}
                {requiredMark}
              </FormLabel>
              <FormControl>
                <Input
                  className={underlineField}
                  type="number"
                  min={
                    typeof validation.min === "number"
                      ? validation.min
                      : undefined
                  }
                  max={
                    typeof validation.max === "number"
                      ? validation.max
                      : undefined
                  }
                  {...formField}
                  onChange={(e) =>
                    formField.onChange(e.target.valueAsNumber || 0)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "textarea":
      return (
        <FormField
          control={form.control}
          name={field.id}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel className={fieldLabel}>
                {field.label}
                {requiredMark}
              </FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-[120px] rounded-md border-[#D9D9D9] bg-transparent text-base font-light shadow-none focus-visible:border-black focus-visible:ring-0"
                  {...formField}
                  value={formField.value ?? ""}
                />
              </FormControl>
              {typeof validation.maxLength === "number" && (
                <FormDescription className="text-xs font-light">
                  Max {validation.maxLength} characters
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "select":
      return (
        <FormField
          control={form.control}
          name={field.id}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel className={fieldLabel}>
                {field.label}
                {requiredMark}
              </FormLabel>
              <Select
                onValueChange={formField.onChange}
                value={formField.value ?? ""}
              >
                <FormControl>
                  <SelectTrigger
                    className={cn(underlineField, "w-full justify-between")}
                  >
                    <SelectValue
                      placeholder={`Select ${field.label.toLowerCase()}`}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(field.options ?? []).map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "multi_select":
      return (
        <FormField
          control={form.control}
          name={field.id}
          render={() => (
            <FormItem>
              <FormLabel className={fieldLabel}>{field.label}</FormLabel>
              <FormDescription className="text-xs font-light">
                Select all that apply
              </FormDescription>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {(field.options ?? []).map((opt) => (
                  <FormField
                    key={opt}
                    control={form.control}
                    name={field.id}
                    render={({ field: formField }) => {
                      const value = (formField.value as string[]) || [];
                      return (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={value.includes(opt)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  formField.onChange([...value, opt]);
                                } else {
                                  formField.onChange(
                                    value.filter((v) => v !== opt),
                                  );
                                }
                              }}
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer text-sm font-light">
                            {opt}
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
      );

    case "checkbox":
      return (
        <FormField
          control={form.control}
          name={field.id}
          render={({ field: formField }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  className="mt-0.5"
                  checked={formField.value ?? false}
                  onCheckedChange={formField.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-snug">
                <FormLabel className="text-sm font-light">
                  {renderLabel(field.label)}
                  {requiredMark}
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
      );

    default:
      return null;
  }
}
