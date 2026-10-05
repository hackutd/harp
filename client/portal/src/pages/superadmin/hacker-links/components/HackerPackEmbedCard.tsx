import { BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  extractEmbedURL,
  HACKER_PACK_EMBED_HELP,
  HACKER_PACK_EMBED_PLACEHOLDER,
  toEmbedCode,
} from "../../settings/hackerPackEmbed";

interface HackerPackEmbedCardProps {
  url: string;
  saving: boolean;
  onSave: (url: string) => Promise<boolean>;
}

export function HackerPackEmbedCard({
  url,
  saving,
  onSave,
}: HackerPackEmbedCardProps) {
  const [embedCode, setEmbedCode] = useState(() => toEmbedCode(url));

  // Re-sync when the saved URL changes (initial load, or a save that
  // normalised the snippet) without clobbering in-progress edits otherwise.
  useEffect(() => {
    setEmbedCode(toEmbedCode(url));
  }, [url]);

  const validationError = useMemo(() => {
    const trimmed = embedCode.trim();
    if (!trimmed) return null;
    if (!extractEmbedURL(trimmed)) return HACKER_PACK_EMBED_HELP;
    return null;
  }, [embedCode]);

  const handleSave = async () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    const ok = await onSave(extractEmbedURL(embedCode.trim()) ?? "");
    if (ok) toast.success("Hacker Pack embed saved.");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Hacker Pack embed</CardTitle>
            <CardDescription>
              Configure the Notion page embedded on the hacker-facing Hacker
              Pack page.
            </CardDescription>
          </div>
          <BookOpen className="size-5 shrink-0 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="hacker-links-pack-embed">Notion Embed Code</Label>
          <ol className="list-decimal space-y-0.5 pl-4 text-xs text-muted-foreground">
            <li>Publish your Notion page (Share → Publish).</li>
            <li>
              Click{" "}
              <span className="text-foreground">&lt;/&gt; Embed this page</span>
              .
            </li>
            <li>
              Click <span className="text-foreground">Copy code</span> and paste
              the &lt;iframe&gt; snippet below. This is the only way the embed
              works.
            </li>
          </ol>
        </div>

        <Textarea
          id="hacker-links-pack-embed"
          placeholder={HACKER_PACK_EMBED_PLACEHOLDER}
          value={embedCode}
          disabled={saving}
          onChange={(e) => setEmbedCode(e.target.value)}
          rows={3}
          className="font-mono text-xs"
        />

        {validationError ? (
          <p className="text-xs text-destructive">{validationError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Content updates live — no redeploy needed. Leave empty to hide the
            Hacker Pack card and page.
          </p>
        )}

        <Button onClick={handleSave} disabled={saving || !!validationError}>
          {saving ? "Saving..." : "Save Hacker Pack Embed"}
        </Button>
      </CardContent>
    </Card>
  );
}
