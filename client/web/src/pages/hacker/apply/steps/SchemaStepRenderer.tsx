import { ArrowLeft, Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  type ControllerRenderProps,
  type FieldValues,
  useFormContext,
} from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { getFieldPresets } from "@/shared/lib/field-presets";
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
  "origin-top overflow-hidden rounded-lg border-0 bg-[#3A3A3A] p-0 text-white shadow-2xl ease-[cubic-bezier(0.16,1,0.3,1)] data-[state=open]:duration-[400ms] data-[state=closed]:duration-200 data-[state=open]:!zoom-in-100 data-[state=closed]:!zoom-out-100 data-[side=bottom]:!slide-in-from-top-3 data-[side=top]:!slide-in-from-bottom-3";

const selectItem =
  "flex w-full cursor-pointer items-center justify-between gap-2 border-b border-white/[0.08] px-5 py-3.5 text-left text-sm font-light text-white/90 transition-colors last:border-b-0 hover:bg-white/[0.07] hover:text-white focus-visible:bg-white/[0.07] focus-visible:text-white focus-visible:outline-none";

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

  // Index where the trailing run of all-optional fields begins — the point
  // below which everything is optional. Anchoring the "OPTIONAL" divider here
  // (rather than at the first optional field) keeps it from landing above a
  // field that still has required fields after it, e.g. phone, which precedes
  // the required age field.
  let optionalStart = fields.length;
  for (let i = fields.length - 1; i >= 0; i--) {
    if (fields[i].required) break;
    optionalStart = i;
  }
  // Only show the divider when required fields precede the optional run.
  const firstOptionalIndex =
    optionalStart > 0 && optionalStart < fields.length ? optionalStart : -1;

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
    case "text": {
      // Well-known fields (university, major, country_of_residence) render a
      // searchable combobox with an "Other" free-text escape hatch instead of a
      // plain input. The stored value stays a plain string either way.
      const presets = getFieldPresets(field.id);
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
              {presets ? (
                <SchemaCombobox
                  field={field}
                  formField={formField}
                  options={presets}
                />
              ) : (
                <FormControl>
                  <Input
                    className={underlineField}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    {...formField}
                    value={formField.value ?? ""}
                  />
                </FormControl>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

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
              <PhoneInput formField={formField} />
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
                  placeholder="Type your answer here..."
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
                <FormLabel className="text-sm font-extralight">
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

/** Strip a value down to its 10 US national digits (drops +1 and formatting). */
function usNationalDigits(value: string): string {
  return value.replace(/\D/g, "").replace(/^1/, "").slice(0, 10);
}

/** Format up to 10 US national digits progressively as (XXX) XXX-XXXX. */
function formatUSPhone(digits: string): string {
  const d = digits.slice(0, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * US phone entry with a live (XXX) XXX-XXXX mask. The user types digits
 * continuously — parentheses, the space, and the dash appear as they go, with
 * no separate segments to tab between. The value is stored canonically as
 * "+1XXXXXXXXXX" (or "" when empty) so validation and the payload stay simple,
 * and any pasted formatting or leading country code is stripped on the way in.
 */
function PhoneInput({
  formField,
}: {
  formField: ControllerRenderProps<ApplicationFormValues>;
}) {
  const digits = usNationalDigits((formField.value as string) ?? "");
  return (
    <FormControl>
      <Input
        className={underlineField}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="(202) 555-1234"
        {...formField}
        value={formatUSPhone(digits)}
        onChange={(e) => {
          const d = usNationalDigits(e.target.value);
          formField.onChange(d ? `+1${d}` : "");
        }}
      />
    </FormControl>
  );
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
          <span className={cn("truncate", !value && "text-sm")}>
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

/**
 * Searchable combobox for well-known fields (university, major, country) that
 * have a large curated preset list. Type-to-filter over the presets with an
 * "Other" escape hatch that reveals a free-text input for values not in the
 * list. The stored value is always a plain string — a picked preset or the
 * free-typed entry — so it stays identical to what a plain text field produced.
 */
function SchemaCombobox({
  field,
  formField,
  options,
}: {
  field: ApplicationSchemaField;
  formField: ControllerRenderProps<ApplicationFormValues>;
  options: readonly string[];
}) {
  const value = (formField.value as string) ?? "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Free-text mode: on first render, infer it from a saved value that isn't a
  // known preset (e.g. a resumed draft or an existing submission).
  const [otherMode, setOtherMode] = useState(
    () => value !== "" && !options.includes(value),
  );

  if (otherMode) {
    return (
      <div className="space-y-2">
        <FormControl>
          <Input
            autoFocus
            className={underlineField}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            {...formField}
            value={value}
          />
        </FormControl>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs font-light text-[#8A8A8A] transition-colors hover:text-black"
          onClick={() => {
            setOtherMode(false);
            setQuery("");
            formField.onChange("");
          }}
        >
          <ArrowLeft className="size-3.5" />
          Choose from list
        </button>
      </div>
    );
  }

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
          <span className={cn("truncate", !value && "text-sm")}>
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
        <Command className="bg-transparent text-white">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={`Search ${field.label.toLowerCase()}...`}
            className="text-white placeholder:text-white/40"
          />
          <CommandList>
            <CommandEmpty className="px-5 py-3 text-left text-sm font-light text-white/60">
              No matches — choose “Other” below to enter it manually.
            </CommandEmpty>
            <CommandGroup className="p-0">
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    formField.onChange(opt);
                    setOpen(false);
                  }}
                  className="cursor-pointer justify-between rounded-none border-b border-white/[0.08] px-5 py-3.5 text-sm font-light text-white/90 data-[selected=true]:bg-white/[0.07] data-[selected=true]:text-white"
                >
                  <span className="truncate">{opt}</span>
                  {opt === value && <Check className="size-4 shrink-0" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {/* Outside CommandList so it's never hidden by the search filter. */}
        <button
          type="button"
          className="flex w-full items-center gap-2 border-t border-white/[0.08] px-5 py-3.5 text-left text-sm font-light text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
          onClick={() => {
            setOtherMode(true);
            formField.onChange(query);
            setOpen(false);
          }}
        >
          Other (enter manually)
        </button>
      </PopoverContent>
    </Popover>
  );
}
