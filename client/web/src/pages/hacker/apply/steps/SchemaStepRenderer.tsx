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
import type { ApplicationSchemaField } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormContext = ReturnType<typeof useFormContext<FieldValues & Record<string, any>>>;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useFormContext() as any as FormContext;

  if (fields.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">
            {sectionLabel}
          </h2>
        </div>
        <p className="text-muted-foreground">No fields configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          {sectionLabel}
        </h2>
      </div>

      {header}

      {fields.map((field) => (
        <SchemaFormField key={field.id} field={field} form={form} />
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
              <FormLabel>
                {field.label}
                {requiredMark}
              </FormLabel>
              <FormControl>
                <Input {...formField} value={formField.value ?? ""} />
              </FormControl>
              {!field.required && (
                <FormDescription>Optional</FormDescription>
              )}
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
              <FormLabel>
                {field.label}
                {requiredMark}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="+12025551234"
                  {...formField}
                  value={formField.value ?? ""}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Include country code (e.g., +1 for US)
              </p>
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
              <FormLabel>
                {field.label}
                {requiredMark}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={typeof validation.min === "number" ? validation.min : undefined}
                  max={typeof validation.max === "number" ? validation.max : undefined}
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
              <FormLabel>
                {field.label}
                {requiredMark}
              </FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-[100px]"
                  {...formField}
                  value={formField.value ?? ""}
                />
              </FormControl>
              {typeof validation.maxLength === "number" && (
                <FormDescription>
                  Max {validation.maxLength} characters
                </FormDescription>
              )}
              {!field.required && !validation.maxLength && (
                <FormDescription>Optional</FormDescription>
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
              <FormLabel>
                {field.label}
                {requiredMark}
              </FormLabel>
              <Select
                onValueChange={formField.onChange}
                value={formField.value ?? ""}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
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
              <FormLabel>{field.label}</FormLabel>
              <FormDescription>Select all that apply</FormDescription>
              <div className="grid grid-cols-2 gap-3 mt-2">
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
                          <FormLabel className="text-sm font-normal cursor-pointer">
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
                  checked={formField.value ?? false}
                  onCheckedChange={formField.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="font-normal">
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
