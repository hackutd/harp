import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Camera,
  Eye,
  EyeOff,
  Link2,
  MessageCircle,
  Trash2,
} from "lucide-react";
import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { HackerPageLoader } from "@/components/HackerPageLoader";
import { Switch } from "@/components/ui/switch";
import { errorAlert } from "@/shared/lib/api";
import { cn } from "@/shared/lib/utils";

import {
  fetchDiscordAuthorizeURL,
  MAX_HEADSHOT_SIZE_BYTES,
  requestHeadshotUploadURL,
  saveDirectoryProfile,
  setDirectoryDiscoverable,
  unlinkDiscord,
  uploadHeadshotToSignedURL,
} from "./api";
import { useDirectoryStore } from "./store";
import type { DirectoryMe, HeadshotContentType } from "./types";
import { initials, INTENT_LABELS, roleLabel } from "./utils";
import {
  type DirectoryProfileForm,
  directoryProfileSchema,
  formToPayload,
  ICEBREAKER_MAX,
  MAX_INTEREST_TAGS,
  MAX_SKILLS,
  profileToForm,
  WANT_TO_BUILD_MAX,
} from "./validations";

const HEADSHOT_TYPES: HeadshotContentType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const fieldClass =
  "w-full rounded-lg border border-white/12 bg-[#05060C] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-[#21FFF0]/50 focus:outline-none aria-invalid:border-[#FF5A7A]";

interface SectionProps {
  title: string;
  hint?: string;
  children: ReactNode;
}

function Section({ title, hint, children }: SectionProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#0B0C15]/85 p-4">
      <h2 className="text-[11px] font-medium tracking-[0.18em] text-white/55 uppercase">
        {title}
      </h2>
      {hint && <p className="mt-1 text-xs font-light text-white/45">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

interface FieldErrorProps {
  message?: string;
}

function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[#FF8FA6]">{message}</p>;
}

interface ChoiceProps {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function Choice({ selected, disabled, onClick, children }: ChoiceProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40",
        selected
          ? "border-[#21FFF0]/50 bg-[#21FFF0]/12 text-[#21FFF0]"
          : "border-white/12 text-white/70 hover:border-white/25",
      )}
    >
      {children}
    </button>
  );
}

interface DirectoryMeProps {
  me: DirectoryMe;
}

function VisibilityCard({ me }: DirectoryMeProps) {
  const setMe = useDirectoryStore((s) => s.setMe);
  const [busy, setBusy] = useState(false);
  const discoverable = me.profile?.discoverable ?? true;

  const handleToggle = async (checked: boolean) => {
    if (!me.profile) return;
    setBusy(true);
    const res = await setDirectoryDiscoverable(checked);
    setBusy(false);
    if (res.status === 200 && res.data) {
      setMe(res.data);
      toast.success(checked ? "Your card is visible" : "Your card is hidden");
    } else {
      errorAlert(res);
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        discoverable
          ? "border-[#21FFF0]/30 bg-[#21FFF0]/[0.06]"
          : "border-white/15 bg-white/[0.03]",
      )}
    >
      {discoverable ? (
        <Eye className="mt-0.5 size-5 shrink-0 text-[#21FFF0]" />
      ) : (
        <EyeOff className="mt-0.5 size-5 shrink-0 text-white/55" />
      )}
      <div className="flex-1">
        <label
          htmlFor="directory-discoverable"
          className="block text-sm font-medium text-white"
        >
          Show my card in the directory
        </label>
        <p className="mt-0.5 text-xs font-light text-white/60">
          {discoverable
            ? "Other confirmed hackers can find, poke, and save you."
            : "You're hidden. No new pokes or saves, but you can still browse, and existing matches keep your Discord."}
        </p>
        {!me.profile && (
          <p className="mt-1 text-xs font-light text-white/45">
            You can change this after you save your card.
          </p>
        )}
      </div>
      <Switch
        id="directory-discoverable"
        checked={discoverable}
        disabled={busy || !me.profile}
        onCheckedChange={handleToggle}
        className="mt-0.5 data-[state=checked]:bg-[#21FFF0] data-[state=unchecked]:bg-white/20"
      />
    </div>
  );
}

function DiscordSection({ me }: DirectoryMeProps) {
  const setMe = useDirectoryStore((s) => s.setMe);
  const [busy, setBusy] = useState(false);
  const linked = me.profile?.discord_user_id;

  const handleLink = async () => {
    setBusy(true);
    const res = await fetchDiscordAuthorizeURL();
    if (res.status === 200 && res.data) {
      window.location.assign(res.data.url);
      return;
    }
    setBusy(false);
    errorAlert(res);
  };

  const handleUnlink = async () => {
    setBusy(true);
    const res = await unlinkDiscord();
    setBusy(false);
    if (res.status === 200 && res.data) setMe(res.data);
    else errorAlert(res);
  };

  return (
    <Section
      title="Discord"
      hint="Only people you match with (you both poked) see this."
    >
      {linked ? (
        <div className="flex items-center gap-3">
          <MessageCircle className="size-5 text-[#8C96FF]" />
          <p className="flex-1 text-sm text-white">
            Linked as {me.profile?.discord_username}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={handleUnlink}
            className="text-xs text-white/55 hover:text-white"
          >
            Unlink
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm font-light text-white/75">
            {me.rsvp_discord_username
              ? `Matches will see ${me.rsvp_discord_username} from your RSVP.`
              : "You didn't add a Discord username on your RSVP, so matches won't have a way to reach you yet."}
          </p>
          {me.discord_oauth_enabled && me.profile && (
            <button
              type="button"
              disabled={busy}
              onClick={handleLink}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#5865F2] px-4 py-2 text-xs font-medium text-white hover:bg-[#4752C4] disabled:opacity-60"
            >
              <Link2 className="size-3.5" />
              Link Discord for a one-tap message button
            </button>
          )}
        </>
      )}
    </Section>
  );
}

function Editor({ me }: DirectoryMeProps) {
  const navigate = useNavigate();
  const setMe = useDirectoryStore((s) => s.setMe);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [headshotPath, setHeadshotPath] = useState<string | null>(
    me.profile?.headshot_path ?? null,
  );
  const [headshotPreview, setHeadshotPreview] = useState<string | null>(
    me.profile?.headshot_url ?? null,
  );
  const [uploading, setUploading] = useState(false);

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

  const intent = useWatch({ control, name: "intent" });
  const tags = useWatch({ control, name: "interest_tags" });
  const roles = useWatch({ control, name: "roles_looking_for" });
  const answer = useWatch({ control, name: "icebreaker_answer" });
  const build = useWatch({ control, name: "want_to_build" });
  const spots = useWatch({ control, name: "spots_needed" });

  useEffect(() => {
    return () => {
      if (headshotPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(headshotPreview);
      }
    };
  }, [headshotPreview]);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!HEADSHOT_TYPES.includes(file.type as HeadshotContentType)) {
      toast.error("Use a JPG, PNG, or WebP photo");
      return;
    }
    if (file.size > MAX_HEADSHOT_SIZE_BYTES) {
      toast.error("Photos need to be under 2 MB");
      return;
    }
    setUploading(true);
    const urlRes = await requestHeadshotUploadURL(
      file.type as HeadshotContentType,
    );
    if (urlRes.status !== 200 || !urlRes.data) {
      setUploading(false);
      errorAlert(urlRes);
      return;
    }
    const upload = await uploadHeadshotToSignedURL(
      urlRes.data.upload_url,
      file,
    );
    setUploading(false);
    if (upload.error) {
      toast.error("Photo upload failed. Please try again.");
      return;
    }
    setHeadshotPath(urlRes.data.headshot_path);
    setHeadshotPreview(URL.createObjectURL(file));
  };

  const onSubmit = handleSubmit(async (values) => {
    const res = await saveDirectoryProfile(formToPayload(values, headshotPath));
    if (res.status === 200 && res.data) {
      const created = !me.profile;
      setMe(res.data);
      toast.success(created ? "Your card is live" : "Card saved");
      if (created) navigate("/app/directory");
    } else {
      errorAlert(res);
    }
  });

  const displayName = useWatch({ control, name: "display_name" });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
      <VisibilityCard me={me} />

      <Section title="You">
        <div className="flex items-center gap-4">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-full border border-white/15 bg-[#5900FF]/25">
            {headshotPreview ? (
              <img
                src={headshotPreview}
                alt="Your directory photo"
                className="size-full object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-xl text-[#D8C5FF]">
                {initials(displayName || "?")}
              </span>
            )}
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept={HEADSHOT_TYPES.join(",")}
              className="hidden"
              onChange={handleFile}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-white/85 hover:bg-white/5 disabled:opacity-60"
            >
              <Camera className="size-3.5" />
              {uploading
                ? "Uploading..."
                : headshotPreview
                  ? "Change photo"
                  : "Add photo"}
            </button>
            {headshotPreview && (
              <button
                type="button"
                onClick={() => {
                  setHeadshotPath(null);
                  setHeadshotPreview(null);
                }}
                className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"
              >
                <Trash2 className="size-3" /> Remove
              </button>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <div>
            <label htmlFor="display_name" className="text-xs text-white/60">
              Display name
            </label>
            <input
              id="display_name"
              {...register("display_name")}
              aria-invalid={Boolean(errors.display_name)}
              className={cn(fieldClass, "mt-1")}
            />
            <FieldError message={errors.display_name?.message} />
          </div>
          <div>
            <label htmlFor="pronouns" className="text-xs text-white/60">
              Pronouns
            </label>
            <input
              id="pronouns"
              {...register("pronouns")}
              placeholder="she/her"
              className={cn(fieldClass, "mt-1")}
            />
            <FieldError message={errors.pronouns?.message} />
          </div>
        </div>
      </Section>

      <Section
        title="Status"
        hint="Saving re-confirms your status. Cards that go stale close to the event sink in the directory."
      >
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
            <label htmlFor="spots_needed" className="text-xs text-white/60">
              Open spots on your team
            </label>
            <select
              id="spots_needed"
              value={spots ?? ""}
              onChange={(e) =>
                setValue(
                  "spots_needed",
                  e.target.value ? Number(e.target.value) : null,
                  { shouldValidate: true },
                )
              }
              className={cn(fieldClass, "mt-1 w-32")}
            >
              <option value="">Pick</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <FieldError message={errors.spots_needed?.message} />
          </div>
        )}
        <div>
          <p className="text-xs text-white/60">Roles you're looking for</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
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
      </Section>

      <Section title="What you're into">
        <div>
          <p className="text-xs text-white/60">Top {MAX_SKILLS} skills</p>
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {Array.from({ length: MAX_SKILLS }, (_, i) => (
              <input
                key={i}
                aria-label={`Skill ${i + 1}`}
                {...register(`skills.${i}` as const)}
                placeholder={["Go", "Figma", "PyTorch"][i]}
                className={fieldClass}
              />
            ))}
          </div>
          <FieldError message={errors.skills?.find?.((e) => e)?.message} />
        </div>
        <div>
          <p className="text-xs text-white/60">
            Interests ({tags.length}/{MAX_INTEREST_TAGS})
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
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
          </div>
          <FieldError message={errors.interest_tags?.message} />
        </div>
        <div>
          <label htmlFor="want_to_build" className="text-xs text-white/60">
            What I want to build
          </label>
          <input
            id="want_to_build"
            {...register("want_to_build")}
            maxLength={WANT_TO_BUILD_MAX}
            placeholder="A study buddy that roasts my flashcards"
            className={cn(fieldClass, "mt-1")}
          />
          <p className="mt-1 text-right text-[11px] text-white/35">
            {build.length}/{WANT_TO_BUILD_MAX}
          </p>
        </div>
      </Section>

      <Section title="Icebreaker">
        <select
          aria-label="Icebreaker prompt"
          {...register("icebreaker_prompt")}
          aria-invalid={Boolean(errors.icebreaker_prompt)}
          className={fieldClass}
        >
          <option value="">Pick a prompt</option>
          {me.options.icebreaker_prompts.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <FieldError message={errors.icebreaker_prompt?.message} />
        <textarea
          aria-label="Icebreaker answer"
          {...register("icebreaker_answer")}
          maxLength={ICEBREAKER_MAX}
          rows={3}
          className={fieldClass}
        />
        <p className="text-right text-[11px] text-white/35">
          {answer.length}/{ICEBREAKER_MAX}
        </p>
      </Section>

      {me.profile && <DiscordSection me={me} />}

      <div className="sticky bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#05060C]/90 p-3 backdrop-blur md:bottom-4">
        <p className="text-xs font-light text-white/50">
          Saving also confirms your status.
        </p>
        <button
          type="submit"
          disabled={isSubmitting || uploading}
          className="rounded-full bg-[#5900FF] px-6 py-2.5 text-sm font-medium text-white shadow-[0_0_24px_rgba(89,0,255,0.45)] hover:bg-[#6D1CFF] disabled:opacity-60"
        >
          {isSubmitting
            ? "Saving..."
            : me.profile
              ? "Save card"
              : "Create my card"}
        </button>
      </div>
    </form>
  );
}

export default function CardEditorPage() {
  const me = useDirectoryStore((s) => s.me);
  const meLoading = useDirectoryStore((s) => s.meLoading);
  const fetchMe = useDirectoryStore((s) => s.fetchMe);

  useEffect(() => {
    const controller = new AbortController();
    fetchMe(controller.signal);
    return () => controller.abort();
  }, [fetchMe]);

  if (meLoading && !me) return <HackerPageLoader />;

  return (
    <div className="mx-auto min-h-svh max-w-2xl px-5 pt-4 pb-6 text-white md:px-8 md:pt-6">
      <Link
        to="/app/directory"
        className="inline-flex items-center gap-1 text-xs text-white/55 hover:text-white"
      >
        <ArrowLeft className="size-3.5" /> Who's Attending
      </Link>
      <p className="mt-3 text-[11px] font-medium tracking-[0.2em] text-[#21FFF0]/75 uppercase">
        Attendee directory
      </p>
      <h1 className="mt-1 text-2xl font-light tracking-tight">
        {me?.profile ? "My card" : "Make your card"}
      </h1>
      {!me?.eligible ? (
        <p className="mt-4 text-sm font-light text-white/65">
          Directory cards open once you've confirmed your RSVP.
        </p>
      ) : (
        // Remount only when a card is created. Visibility and Discord changes
        // also bump updated_at, and remounting on those would wipe unsaved edits.
        <Editor key={me.profile ? "edit" : "new"} me={me} />
      )}
    </div>
  );
}
