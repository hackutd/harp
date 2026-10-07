import { Plus, Tags, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorAlert } from "@/shared/lib/api";

import {
  fetchDirectoryInterestTags,
  updateDirectoryInterestTags,
} from "../api";
import {
  MAX_DIRECTORY_TAG_LENGTH,
  MAX_DIRECTORY_TAGS,
  validateDirectoryTags,
} from "../directoryTags";

export default function DirectoryTagsTab() {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      const res = await fetchDirectoryInterestTags(controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setTags(res.data.tags);
      } else {
        errorAlert(res);
      }
      setLoading(false);
    }

    load();
    return () => controller.abort();
  }, []);

  const validationError = useMemo(() => validateDirectoryTags(tags), [tags]);

  function handleChange(index: number, value: string) {
    setTags((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  function handleRemove(index: number) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAdd() {
    setTags((prev) => [...prev, ""]);
  }

  async function handleSave() {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const res = await updateDirectoryInterestTags(tags.map((t) => t.trim()));
    if (res.status === 200 && res.data) {
      setTags(res.data.tags);
      toast.success("Interest tags saved.");
    } else {
      errorAlert(res);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg text-zinc-100">Directory Tags</h3>
      <p className="text-sm text-zinc-400">
        The interest tags hackers can pick for their attendee directory card and
        filter by. Removing a tag doesn't strip it from cards that already have
        it; it drops off the next time that hacker saves their card.
      </p>

      <div className="bg-zinc-900 rounded-md p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label className="text-sm font-medium text-zinc-100">
              Interest tags
            </Label>
            <p className="text-xs text-zinc-500">
              Up to {MAX_DIRECTORY_TAGS} tags, {MAX_DIRECTORY_TAG_LENGTH}{" "}
              characters each.
            </p>
          </div>
          <Tags className="size-5 text-zinc-500" />
        </div>

        <div className="space-y-2">
          {tags.length === 0 && !loading ? (
            <p className="text-xs text-zinc-500">
              No tags configured. Hackers won't be able to pick interests.
            </p>
          ) : null}

          {tags.map((tag, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={tag}
                onChange={(e) => handleChange(index, e.target.value)}
                disabled={loading || saving}
                maxLength={MAX_DIRECTORY_TAG_LENGTH}
                placeholder="Tag name"
                aria-label={`Tag ${index + 1}`}
                className="border-zinc-800 bg-zinc-950 text-zinc-100"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(index)}
                disabled={loading || saving}
                aria-label={`Remove tag ${index + 1}`}
                className="shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={handleAdd}
          disabled={loading || saving || tags.length >= MAX_DIRECTORY_TAGS}
          className="w-full border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
        >
          <Plus className="size-4" />
          Add Tag
        </Button>

        {validationError ? (
          <p className="text-xs text-red-400">{validationError}</p>
        ) : null}

        <Button
          onClick={handleSave}
          disabled={loading || saving || !!validationError}
          className="cursor-pointer bg-white text-black hover:bg-zinc-200"
        >
          {saving ? "Saving..." : "Save Tags"}
        </Button>
      </div>
    </div>
  );
}
