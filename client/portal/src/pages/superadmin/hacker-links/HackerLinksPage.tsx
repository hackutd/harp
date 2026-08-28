import { Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  HACKER_LINK_ICON_OPTIONS,
  hackerLinkIcon,
} from "@/shared/lib/hacker-link-icons";

import { useHackerLinksStore } from "./store";
import type { HackerLink, HackerLinkPayload } from "./types";

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
  const { links, loading, saving, fetch, createLink, updateLink, deleteLink } =
    useHackerLinksStore();
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
            How these links appear on the hacker home page. Each card opens its
            URL in a new tab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-[#F5F5F3] p-4">
            {links.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No links configured. Add one on the right.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {links.map((link) => {
                  const Icon = hackerLinkIcon(link.icon);
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-start gap-2 rounded-lg border border-[#E5E5E5] bg-white p-4 active:scale-[0.98]"
                    >
                      <Icon className="size-5 text-black" strokeWidth={1.5} />
                      <span className="text-sm font-normal text-black">
                        {link.label}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
                  <SelectContent>
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
    </div>
  );
}
