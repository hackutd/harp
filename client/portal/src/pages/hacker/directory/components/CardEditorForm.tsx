import { zodResolver } from "@hookform/resolvers/zod";
import { IconPlus, IconX } from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorAlert } from "@/shared/lib/api";
import { cn } from "@/shared/lib/utils";

import { saveDirectoryProfile } from "../api";
import { useDirectoryStore } from "../store";
import type { DirectoryMe } from "../types";
import { INTENT_LABELS, roleLabel } from "../utils";
import {
  type DirectoryProfileForm,
  directoryProfileSchema,
  EXPERIENCE_FIELD_MAX,
  formToPayload,
  ICEBREAKER_MAX,
  MAX_EXPERIENCES,
  MAX_INTEREST_TAGS,
  MAX_SKILLS,
  profileToForm,
  SKILL_MAX,
  WANT_TO_BUILD_MAX,
} from "../validations";

// Same field styles as the application wizard.
const underlineField =
  "h-11 rounded-none border-0 border-b border-ink/10 bg-transparent px-0 pt-3.5 pb-1 text-base font-light shadow-none transition-colors focus-visible:border-ice/50 focus-visible:ring-0 aria-invalid:border-destructive dark:bg-transparent";
const fieldLabel = "text-sm font-light text-ink/85";

interface GroupProps {
  title: string;
  children: ReactNode;
}

// A titled group of fields, headed the same way as the Profile page sections.
function Group({ title, children }: GroupProps) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-light tracking-widest text-ink/65 uppercase">
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

interface FieldErrorProps {
  message?: string;
}

function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-light text-destructive">{message}</p>;
}

interface ChoiceProps {
  selected: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onClick: () => void;
  children: ReactNode;
}

function Choice({
  selected,
  disabled,
  ariaLabel,
  onClick,
  children,
}: ChoiceProps) {
  return (
    <button
      type="button"
      aria-pressed={ariaLabel ? undefined : selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-light transition-colors disabled:opacity-40",
        selected
          ? "border-ice/30 bg-ice/10 text-ice"
          : "border-ink/10 text-ink/65 hover:border-ink/30 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

interface DirectoryMeProps {
  me: DirectoryMe;
}

// Matches see the Discord username from the RSVP; it isn't edited here.
function DiscordRow({ me }: DirectoryMeProps) {
  const shown = me.rsvp_discord_username;
  return (
    <div className="min-w-0">
      <p className={fieldLabel}>Discord</p>
      <p className="truncate text-xs font-light text-ink/65">
        {shown
          ? `Matches see ${shown}`
          : "Add one on your RSVP so matches can reach you"}
      </p>
    </div>
  );
}

interface CardEditorFormProps {
  me: DirectoryMe;
  /** Runs after a successful save, with whether the card was just created. */
  onSaved?: (created: boolean) => void;
  onCancel?: () => void;
}

// Edits the hacker's profile in place on the Profile page. The photo and the
// visibility switch live elsewhere on that page, so they aren't repeated here.
export function CardEditorForm({ me, onSaved, onCancel }: CardEditorFormProps) {
  const setMe = useDirectoryStore((s) => s.setMe);
  const draftDiscoverable = useDirectoryStore((s) => s.draftDiscoverable);
  const form = useForm<DirectoryProfileForm>({
    resolver: zodResolver(directoryProfileSchema),
    defaultValues: profileToForm(me.profile),
  });
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const experiences = useFieldArray({ control, name: "experiences" });

  const intent = useWatch({ control, name: "intent" });
  const tags = useWatch({ control, name: "interest_tags" });
  const skills = useWatch({ control, name: "skills" });
  const roles = useWatch({ control, name: "roles_looking_for" });
  const spots = useWatch({ control, name: "spots_needed" });
  const [customInterest, setCustomInterest] = useState("");

  // Typing a listed interest just selects it; anything else is kept as the
  // hacker's own.
  const addCustomInterest = () => {
    const value = customInterest.trim();
    if (!value) return;
    const key = value.toLowerCase();
    const listed = me.options.interest_tags.find(
      (t) => t.toLowerCase() === key,
    );
    if (listed) {
      if (!tags.includes(listed) && tags.length < MAX_INTEREST_TAGS) {
        setValue("interest_tags", [...tags, listed], { shouldValidate: true });
      }
    } else if (
      !skills.some((s) => s.toLowerCase() === key) &&
      skills.length < MAX_SKILLS
    ) {
      setValue("skills", [...skills, value], { shouldValidate: true });
    }
    setCustomInterest("");
  };

  const onSubmit = handleSubmit(async (values) => {
    const res = await saveDirectoryProfile(
      formToPayload(values, me.profile ? undefined : draftDiscoverable),
    );
    if (res.status === 200 && res.data) {
      const created = !me.profile;
      setMe(res.data);
      toast.success(
        !created
          ? "Profile saved"
          : res.data.profile?.discoverable
            ? "Your profile is live in the Directory"
            : "Profile saved. It's hidden from the Directory until you turn it on.",
      );
      onSaved?.(created);
    } else {
      errorAlert(res);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-8">
      <Group title="About">
        <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
          <div>
            <label htmlFor="display_name" className={fieldLabel}>
              Display name
            </label>
            <Input
              id="display_name"
              {...register("display_name")}
              aria-invalid={Boolean(errors.display_name)}
              className={underlineField}
            />
            <FieldError message={errors.display_name?.message} />
          </div>
          <div>
            <label htmlFor="pronouns" className={fieldLabel}>
              Pronouns
            </label>
            <Input
              id="pronouns"
              {...register("pronouns")}
              placeholder="Optional"
              className={underlineField}
            />
            <FieldError message={errors.pronouns?.message} />
          </div>
        </div>
      </Group>

      <Group title="Status">
        <div className="flex flex-wrap gap-2">
          {me.options.intents.map((value) => (
            <Choice
              key={value}
              selected={intent === value}
              onClick={() =>
                setValue("intent", value, { shouldValidate: true })
              }
            >
              {INTENT_LABELS[value]}
            </Choice>
          ))}
        </div>
        {intent === "partial_team" && (
          <div>
            <p className={fieldLabel}>Open spots</p>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Choice
                  key={n}
                  selected={spots === n}
                  onClick={() =>
                    setValue("spots_needed", n, { shouldValidate: true })
                  }
                >
                  {n}
                </Choice>
              ))}
            </div>
            <FieldError message={errors.spots_needed?.message} />
          </div>
        )}
        <div>
          <p className={fieldLabel}>Looking for</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {me.options.roles.map((role) => (
              <Choice
                key={role}
                selected={roles.includes(role)}
                onClick={() =>
                  setValue(
                    "roles_looking_for",
                    roles.includes(role)
                      ? roles.filter((r) => r !== role)
                      : [...roles, role],
                  )
                }
              >
                {roleLabel(role)}
              </Choice>
            ))}
          </div>
        </div>
      </Group>

      <Group title="Interests">
        <div>
          <div className="flex flex-wrap gap-2">
            {me.options.interest_tags.map((tag) => {
              const selected = tags.includes(tag);
              return (
                <Choice
                  key={tag}
                  selected={selected}
                  disabled={!selected && tags.length >= MAX_INTEREST_TAGS}
                  onClick={() =>
                    setValue(
                      "interest_tags",
                      selected ? tags.filter((t) => t !== tag) : [...tags, tag],
                      { shouldValidate: true },
                    )
                  }
                >
                  {tag}
                </Choice>
              );
            })}
            {skills.map((skill) => (
              <Choice
                key={`custom-${skill}`}
                selected
                ariaLabel={`Remove ${skill}`}
                onClick={() =>
                  setValue(
                    "skills",
                    skills.filter((s) => s !== skill),
                    { shouldValidate: true },
                  )
                }
              >
                {skill}
                <IconX className="size-3" />
              </Choice>
            ))}
          </div>
          {skills.length < MAX_SKILLS && (
            <div className="mt-2 flex items-end gap-3">
              <Input
                aria-label="Add your own interest"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  addCustomInterest();
                }}
                maxLength={SKILL_MAX}
                placeholder="Add your own"
                className={cn(underlineField, "flex-1")}
              />
              <button
                type="button"
                onClick={addCustomInterest}
                disabled={!customInterest.trim()}
                className="shrink-0 pb-1.5 text-sm font-light text-ink hover:text-ink disabled:text-ink/65"
              >
                Add
              </button>
            </div>
          )}
          <FieldError
            message={
              errors.interest_tags?.message ??
              errors.skills?.message ??
              errors.skills?.find?.((e) => e)?.message
            }
          />
        </div>
        <div>
          <label htmlFor="want_to_build" className={fieldLabel}>
            What I want to build
          </label>
          <Input
            id="want_to_build"
            {...register("want_to_build")}
            maxLength={WANT_TO_BUILD_MAX}
            placeholder="Optional"
            className={underlineField}
          />
        </div>
      </Group>

      <Group title="Links">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="github_username" className={fieldLabel}>
              GitHub
            </label>
            <Input
              id="github_username"
              {...register("github_username")}
              aria-invalid={Boolean(errors.github_username)}
              placeholder="Username or link"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={underlineField}
            />
            <FieldError message={errors.github_username?.message} />
          </div>
          <div>
            <label htmlFor="linkedin_handle" className={fieldLabel}>
              LinkedIn
            </label>
            <Input
              id="linkedin_handle"
              {...register("linkedin_handle")}
              aria-invalid={Boolean(errors.linkedin_handle)}
              placeholder="Profile link"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={underlineField}
            />
            <FieldError message={errors.linkedin_handle?.message} />
          </div>
        </div>
        {me.profile && <DiscordRow me={me} />}
      </Group>

      <Group title="Experience">
        {experiences.fields.map((field, i) => (
          <div key={field.id}>
            <div className="flex items-end gap-3">
              <div className="grid flex-1 gap-x-5 sm:grid-cols-2">
                <Input
                  aria-label={`Role ${i + 1}`}
                  {...register(`experiences.${i}.title` as const)}
                  aria-invalid={Boolean(errors.experiences?.[i]?.title)}
                  maxLength={EXPERIENCE_FIELD_MAX}
                  placeholder="Role"
                  className={underlineField}
                />
                <Input
                  aria-label={`Company ${i + 1}`}
                  {...register(`experiences.${i}.company` as const)}
                  aria-invalid={Boolean(errors.experiences?.[i]?.company)}
                  maxLength={EXPERIENCE_FIELD_MAX}
                  placeholder="Company"
                  className={underlineField}
                />
              </div>
              <button
                type="button"
                aria-label={`Remove experience ${i + 1}`}
                onClick={() => experiences.remove(i)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <IconX className="size-4" strokeWidth={1.5} />
              </button>
            </div>
            <FieldError
              message={
                errors.experiences?.[i]?.title?.message ??
                errors.experiences?.[i]?.company?.message
              }
            />
          </div>
        ))}
        {experiences.fields.length < MAX_EXPERIENCES && (
          <button
            type="button"
            onClick={() => experiences.append({ company: "", title: "" })}
            className="inline-flex items-center gap-1.5 text-sm font-light text-ink/65 hover:text-ink"
          >
            <IconPlus className="size-4" strokeWidth={1.5} />
            Add experience
          </button>
        )}
      </Group>

      <Group title="Icebreaker">
        <div>
          <select
            aria-label="Icebreaker prompt"
            {...register("icebreaker_prompt")}
            aria-invalid={Boolean(errors.icebreaker_prompt)}
            className={cn(underlineField, "w-full [&>option]:bg-surface")}
          >
            <option value="">Pick a prompt</option>
            {me.options.icebreaker_prompts.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <FieldError message={errors.icebreaker_prompt?.message} />
        </div>
        <Textarea
          aria-label="Icebreaker answer"
          {...register("icebreaker_answer")}
          maxLength={ICEBREAKER_MAX}
          placeholder="Your answer"
          className="min-h-[96px] rounded-md border-ink/10 bg-transparent text-base font-light shadow-none focus-visible:border-ice/50 focus-visible:ring-0"
        />
      </Group>

      <div className="sticky bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-10 flex gap-3 bg-surface/95 py-3 backdrop-blur-sm md:bottom-0">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-12 flex-1 rounded-full border border-ink/10 text-sm font-normal text-ink transition-colors hover:bg-ink/5 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-12 flex-1 rounded-full bg-tide text-sm font-normal text-white hover:bg-tide-hover disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
