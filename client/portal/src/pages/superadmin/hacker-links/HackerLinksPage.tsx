import {
  BookOpen,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { HackerLinkIconComponent } from "@/shared/lib/hacker-link-icons";
import {
  HACKER_LINK_ICON_OPTIONS,
  hackerLinkIcon,
} from "@/shared/lib/hacker-link-icons";
import { cn } from "@/shared/lib/utils";

import { HackerPackEmbedCard } from "./components/HackerPackEmbedCard";
import { useHackerLinksStore } from "./store";
import type { HackerLink, HackerLinkPayload } from "./types";

// Fixed cards the hacker home page renders ahead of the configurable links
// (see pages/hacker/dashboard/DashboardPage.tsx QUICK_LINKS). Shown in the
// preview for context only — they aren't managed here.
const BUILT_IN_LINKS = [
  { label: "Hacker Pack", icon: BookOpen },
  { label: "FAQ", icon: MessageSquare },
  { label: "Contact", icon: Mail },
] as const;

interface PreviewCardProps {
  label: string;
  icon: HackerLinkIconComponent;
  href?: string;
  muted?: boolean;
}

// Mirrors the quick-link card markup on /app. Built-in cards render as inert
// divs; configured links stay clickable so their URLs can be sanity-checked.
function PreviewCard({ label, icon: Icon, href, muted }: PreviewCardProps) {
  const className = cn(
    "flex flex-col items-start gap-2 rounded-lg border border-[#E5E5E5] bg-white p-4",
    href && "active:scale-[0.98]",
    muted && "opacity-40",
  );
  const content = (
    <>
      <Icon className="size-5 text-black" strokeWidth={1.5} />
      <span className="text-sm font-normal text-black">{label}</span>
    </>
  );
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

interface FormState {
  label: string;
  url: string;
  icon: string;
  display_order: string;
}

const EMPTY_FORM: FormState = {
  label: "",
  url: "",
  icon: "link",
  display_order: "0",
};

function formFromLink(link: HackerLink): FormState {
  return {
    label: link.label,
    url: link.url,
    icon: link.icon,
    display_order: String(link.display_order),
  };
}

export default function HackerLinksPage() {
  const {
    links,
    hackerPackURL,
    loading,
    saving,
    savingHackerPack,
    fetch,
    createLink,
    updateLink,
    deleteLink,
    saveHackerPackURL,
  } = useHackerLinksStore();
  const [editingID, setEditingID] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    const controller = new AbortController();
    fetch(controller.signal);
    return () => controller.abort();
  }, [fetch]);

  const isEditing = editingID !== null;

  const handleStartEdit = (link: HackerLink) => {
    setEditingID(link.id);
    setForm(formFromLink(link));
  };

  const handleCancel = () => {
    setEditingID(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async () => {
    const label = form.label.trim();
    const url = form.url.trim();
    if (!label || !url) {
      toast.error("Label and URL are required");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      toast.error("URL must start with http:// or https://");
      return;
    }
    const payload: HackerLinkPayload = {
      label,
      url,
      icon: form.icon,
      display_order: Number(form.display_order) || 0,
    };
    if (isEditing && editingID) {
      const ok = await updateLink(editingID, payload);
      if (ok) {
        toast.success("Link updated");
        handleCancel();
      }
    } else {
      const id = await createLink(payload);
      if (id) {
        toast.success("Link added");
        setForm(EMPTY_FORM);
      }
    }
  };

  const handleDelete = async (link: HackerLink) => {
    const ok = await deleteLink(link.id);
    if (ok) {
      toast.success(`Deleted "${link.label}"`);
      if (editingID === link.id) handleCancel();
    }
  };

  if (loading && links.length === 0) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {/* Hacker-side preview — mirrors the quick-link cards on /app */}
      <Card>
        <CardHeader>
          <CardTitle>Hacker preview</CardTitle>
          <CardDescription>
            How the quick links appear on the hacker home page. Hacker Pack,
            FAQ, and Contact are built in and shown for reference; the links you
            configure here open in a new tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl bg-[#F5F5F3] p-4">
            <div className="grid grid-cols-3 gap-3">
              {BUILT_IN_LINKS.map(({ label, icon }) => (
                <PreviewCard
                  key={label}
                  label={label}
                  icon={icon}
                  muted={label === "Hacker Pack" && !hackerPackURL}
                />
              ))}
              {links.map((link) => (
                <PreviewCard
                  key={link.id}
                  label={link.label}
                  icon={hackerLinkIcon(link.icon)}
                  href={link.url}
                />
              ))}
            </div>
          </div>
          {!hackerPackURL && (
            <p className="text-xs text-muted-foreground">
              Hacker Pack is hidden on the hacker home page until a Notion embed
              is saved.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {/* Editor */}
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? "Edit link" : "Add a link"}</CardTitle>
            <CardDescription>
              Configure the links hackers see on their home page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="hacker-link-label">Label</Label>
                  <Input
                    id="hacker-link-label"
                    placeholder="Devpost"
                    value={form.label}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, label: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Icon</Label>
                  <Select
                    value={form.icon}
                    onValueChange={(icon) => setForm((f) => ({ ...f, icon }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Icon" />
                    </SelectTrigger>
                    {/* Popper mode anchors the menu under the trigger; the
                        default item-aligned mode centres on the selected
                        item and can push the list up off the screen. */}
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      avoidCollisions={false}
                      showScrollButtons={false}
                      matchTriggerHeight={false}
                    >
                      {HACKER_LINK_ICON_OPTIONS.map((opt) => {
                        const Icon = hackerLinkIcon(opt.value);
                        return (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className="flex items-center gap-2">
                              <Icon className="size-4" />
                              {opt.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                <div className="space-y-1.5">
                  <Label htmlFor="hacker-link-url">URL</Label>
                  <Input
                    id="hacker-link-url"
                    type="url"
                    placeholder="https://..."
                    value={form.url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, url: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hacker-link-order">Order</Label>
                  <Input
                    id="hacker-link-order"
                    type="number"
                    min={0}
                    value={form.display_order}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, display_order: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={saving}>
                  {!isEditing && <Plus className="size-4" />}
                  {isEditing ? "Save changes" : "Add link"}
                </Button>
                {isEditing && (
                  <Button variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Current links</p>
              {links.length === 0 ? (
                <p className="text-sm text-muted-foreground">No links yet.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {links.map((link) => {
                    const Icon = hackerLinkIcon(link.icon);
                    return (
                      <li
                        key={link.id}
                        className="flex items-center gap-3 px-3 py-2.5"
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {link.label}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {link.url}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          #{link.display_order}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${link.label}`}
                          onClick={() => handleStartEdit(link)}
                          disabled={saving}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${link.label}`}
                          onClick={() => handleDelete(link)}
                          disabled={saving}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <HackerPackEmbedCard
          url={hackerPackURL}
          saving={savingHackerPack}
          onSave={saveHackerPackURL}
        />
      </div>
    </div>
  );
}
