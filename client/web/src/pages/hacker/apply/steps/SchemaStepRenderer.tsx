import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  type ControllerRenderProps,
  type FieldValues,
  useFormContext,
} from "react-hook-form";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { renderLabel } from "@/shared/lib/schema-utils";
import { cn } from "@/shared/lib/utils";
import type { ApplicationSchemaField } from "@/types";

type ApplicationFormValues = FieldValues & Record<string, unknown>;
type FormContext = ReturnType<typeof useFormContext<ApplicationFormValues>>;

const underlineField =
  "h-11 rounded-none border-0 border-b border-[#D9D9D9] bg-transparent px-0 text-base font-light shadow-none transition-colors focus-visible:border-black focus-visible:ring-0 dark:bg-transparent";

const fieldLabel = "text-xs font-light text-[#8A8A8A]";

// Dark floating dropdown panel (see design screenshot). Slides down out of the
// trigger: the zoom/scale is neutralized (`zoom-*-100`) so the motion reads as
// a slide rather than a fade-into-position, anchored to the top edge.
const selectContent =
  "origin-top overflow-hidden rounded-lg border-0 bg-[#3A3A3A] p-0 text-white shadow-2xl ease-[cubic-bezier(0.16,1,0.3,1)] data-[state=open]:duration-500 data-[state=closed]:duration-300 data-[state=open]:!zoom-in-100 data-[state=closed]:!zoom-out-100 data-[side=bottom]:!slide-in-from-top-3 data-[side=top]:!slide-in-from-bottom-3 data-[state=closed]:!slide-out-to-top-3";

const selectItem =
  "flex w-full cursor-pointer items-center justify-between gap-2 border-b border-white/[0.08] px-5 py-3.5 text-left text-[15px] font-light text-white/90 transition-colors last:border-b-0 hover:bg-white/[0.07] hover:text-white focus-visible:bg-white/[0.07] focus-visible:text-white focus-visible:outline-none";

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
                  type="text"
                  inputMode="numeric"
                  {...formField}
                  value={formField.value ?? 0}
                  // Select the whole value on focus so the leading 0 is
                  // replaced by the first keystroke instead of prepended.
                  onFocus={(e) => e.target.select()}
                  onMouseUp={(e) => e.preventDefault()}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^\d.-]/g, "");
                    if (cleaned === "" || cleaned === "-") {
                      formField.onChange(0);
                      return;
                    }
                    const num = Number(cleaned);
                    formField.onChange(Number.isNaN(num) ? 0 : num);
                  }}
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
              <SchemaSelect field={field} formField={formField} />
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

/**
 * Select field built on Popover rather than Radix Select. Radix Select teleports
 * its content into a detached DocumentFragment when closed (ignoring
 * `forceMount`), so a closing animation is impossible and unmounting the content
 * drops the selected value. Popover supports proper enter/exit animations, and
 * we render the selected label ourselves so it always persists.
 */
function SchemaSelect({
  field,
  formField,
}: {
  field: ApplicationSchemaField;
  formField: ControllerRenderProps<ApplicationFormValues>;
}) {
  const [open, setOpen] = useState(false);
  const value = (formField.value as string) ?? "";
  const options = field.options ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <FormControl>
        <PopoverTrigger
          onBlur={formField.onBlur}
          className={cn(
            underlineField,
            "flex w-full items-center justify-between gap-2 outline-none",
            !value && "text-[#8A8A8A]",
          )}
        >
          <span className="truncate">
            {value || `Select ${field.label.toLowerCase()}`}
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 opacity-50 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
              open && "rotate-180",
            )}
          />
        </PopoverTrigger>
      </FormControl>
      <PopoverContent
        align="start"
        sideOffset={-6}
        className={cn(selectContent, "w-[var(--radix-popover-trigger-width)]")}
      >
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={selectItem}
            onClick={() => {
              formField.onChange(opt);
              setOpen(false);
            }}
          >
            <span className="truncate">{opt}</span>
            {opt === value && <Check className="size-4 shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
