import { BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorAlert } from "@/shared/lib/api";

import { fetchHackerPackURL, updateHackerPackURL } from "../api";

function extractEmbedURL(value: string): string {
  const match = value.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  return match ? match[1] : value;
}

export default function HackerPackTab() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const validationError = useMemo(() => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) {
      return "URL must start with http:// or https://";
    }
    return null;
  }, [url]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const res = await fetchHackerPackURL(controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setUrl(res.data.url);
      } else {
        errorAlert(res);
      }
      setLoading(false);
    }
    load();
    return () => controller.abort();
  }, []);

  async function save() {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const res = await updateHackerPackURL(url.trim());
    if (res.status === 200 && res.data) {
      setUrl(res.data.url);
      toast.success("Hacker Pack URL saved.");
    } else {
      errorAlert(res);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg text-zinc-100">Hacker Pack</h3>
      <p className="text-sm text-zinc-400">
        Configure the Notion page embedded on the hacker-facing Hacker Pack
        page.
      </p>

      <div className="bg-zinc-900 rounded-md p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label
              htmlFor="hacker-pack-url"
              className="text-sm font-medium text-zinc-100"
            >
              Notion Share URL
            </Label>
            <p className="text-xs text-zinc-500">
              Paste a Notion embed link (Share → Embed this page) or the full
              &lt;iframe&gt; snippet — the URL is extracted automatically.
              Content updates live — no redeploy needed. Leave empty to hide the
              page.
            </p>
          </div>
          <BookOpen className="size-5 text-zinc-500" />
        </div>

        <Input
          id="hacker-pack-url"
          type="url"
          inputMode="url"
          placeholder="https://your-workspace.notion.site/..."
          value={url}
          disabled={loading || saving}
          onChange={(e) => setUrl(extractEmbedURL(e.target.value))}
          className="border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
        />

        {validationError ? (
          <p className="text-xs text-red-400">{validationError}</p>
        ) : (
          <p className="text-xs text-zinc-500">
            Notion "Embed this page" links (notion.site/ebd/...) render inline.
            Regular "Share to web" URLs are blocked from iframing by Notion, but
            hackers can always open them via the "Open in Notion" link.
          </p>
        )}

        <Button
          onClick={save}
          disabled={loading || saving || !!validationError}
          className="cursor-pointer bg-white text-black hover:bg-zinc-200"
        >
          {saving ? "Saving..." : "Save Hacker Pack URL"}
        </Button>
      </div>
    </div>
  );
}
