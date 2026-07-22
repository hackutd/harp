import { BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorAlert } from "@/shared/lib/api";

import { fetchHackerPackURL, updateHackerPackURL } from "../api";

const PLACEHOLDER = `<iframe src="https://your-workspace.notion.site/ebd/..." width="100%" height="600" frameborder="0" allowfullscreen />`;

function toEmbedCode(url: string): string {
  if (!url) return "";
  return `<iframe src="${url}" width="100%" height="600" frameborder="0" allowfullscreen />`;
}

function extractEmbedURL(value: string): string | null {
  const match = value.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  if (!match) return null;
  const src = match[1].trim();
  if (!/^https?:\/\//i.test(src)) return null;
  return src;
}

export default function HackerPackTab() {
  const [embedCode, setEmbedCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const validationError = useMemo(() => {
    const trimmed = embedCode.trim();
    if (!trimmed) return null;
    if (!extractEmbedURL(trimmed)) {
      return 'Paste the full <iframe ... /> embed code copied from Notion\'s "Embed this page" option.';
    }
    return null;
  }, [embedCode]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const res = await fetchHackerPackURL(controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setEmbedCode(toEmbedCode(res.data.url));
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
    const url = extractEmbedURL(embedCode.trim()) ?? "";
    const res = await updateHackerPackURL(url);
    if (res.status === 200 && res.data) {
      setEmbedCode(toEmbedCode(res.data.url));
      toast.success("Hacker Pack embed saved.");
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
              htmlFor="hacker-pack-embed"
              className="text-sm font-medium text-zinc-100"
            >
              Notion Embed Code
            </Label>
            <ol className="list-decimal space-y-0.5 pl-4 text-xs text-zinc-500">
              <li>Publish your Notion page (Share → Publish).</li>
              <li>
                Click{" "}
                <span className="text-zinc-300">&lt;/&gt; Embed this page</span>
                .
              </li>
              <li>
                Click <span className="text-zinc-300">Copy code</span> and paste
                the &lt;iframe&gt; snippet below. This is the only way the embed
                works.
              </li>
            </ol>
          </div>
          <BookOpen className="size-5 text-zinc-500" />
        </div>

        <Textarea
          id="hacker-pack-embed"
          placeholder={PLACEHOLDER}
          value={embedCode}
          disabled={loading || saving}
          onChange={(e) => setEmbedCode(e.target.value)}
          rows={3}
          className="border-zinc-800 bg-zinc-950 font-mono text-xs text-zinc-100 placeholder:text-zinc-600"
        />

        {validationError ? (
          <p className="text-xs text-red-400">{validationError}</p>
        ) : (
          <p className="text-xs text-zinc-500">
            Content updates live — no redeploy needed. Leave empty to hide the
            page.
          </p>
        )}

        <Button
          onClick={save}
          disabled={loading || saving || !!validationError}
          className="cursor-pointer bg-white text-black hover:bg-zinc-200"
        >
          {saving ? "Saving..." : "Save Hacker Pack Embed"}
        </Button>
      </div>
    </div>
  );
}
