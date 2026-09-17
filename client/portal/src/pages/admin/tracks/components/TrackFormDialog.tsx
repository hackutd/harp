import { ImagePlus, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { ALLOWED_LOGO_TYPES, MAX_LOGO_BYTES } from "../constants";
import type { Track, TrackPayload, TrackPrize } from "../types";

interface TrackFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track: Track | null;
  saving: boolean;
  onSubmit: (payload: TrackPayload, logoFile?: File) => void;
}

function logoPreviewFor(track: Track | null): string {
  return track?.logo_data
    ? `data:${track.logo_content_type};base64,${track.logo_data}`
    : "";
}

function TrackForm({
  track,
  saving,
  onSubmit,
  onCancel,
}: {
  track: Track | null;
  saving: boolean;
  onSubmit: (payload: TrackPayload, logoFile?: File) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(track?.title ?? "");
  const [sponsorName, setSponsorName] = useState(track?.sponsor_name ?? "");
  const [description, setDescription] = useState(track?.description ?? "");
  const [prizes, setPrizes] = useState<TrackPrize[]>(
    track?.prizes?.length ? track.prizes : [{ place: "1st", prize: "" }],
  );
  const [displayOrder, setDisplayOrder] = useState(track?.display_order ?? 0);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>(logoPreviewFor(track));
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error("Unsupported file type. Use PNG, JPEG, WebP, or GIF.");
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      toast.error("File too large. Maximum size is 750KB.");
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(logoPreviewFor(track));
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const updatePrize = (index: number, patch: Partial<TrackPrize>) => {
    setPrizes((current) =>
      current.map((prize, i) => (i === index ? { ...prize, ...patch } : prize)),
    );
  };

  const addPrize = () => {
    setPrizes((current) => [...current, { place: "", prize: "" }]);
  };

  const removePrize = (index: number) => {
    setPrizes((current) => current.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Blank rows are the natural state of a freshly added prize, so drop them
    // rather than failing validation on the server.
    const filledPrizes = prizes
      .map((p) => ({ place: p.place.trim(), prize: p.prize.trim() }))
      .filter((p) => p.place !== "" || p.prize !== "");

    if (filledPrizes.some((p) => p.place === "" || p.prize === "")) {
      toast.error("Every prize needs both a place and a prize.");
      return;
    }

    onSubmit(
      {
        title: title.trim(),
        sponsor_name: sponsorName.trim(),
        description: description.trim(),
        prizes: filledPrizes,
        display_order: displayOrder,
      },
      logoFile ?? undefined,
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Logo</Label>
        <div className="flex items-center gap-3">
          {logoPreview ? (
            <img
              src={logoPreview}
              alt="Logo preview"
              className="size-12 rounded object-contain border"
            />
          ) : (
            <div className="size-12 rounded border border-dashed flex items-center justify-center text-muted-foreground">
              <ImagePlus className="size-5" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept={ALLOWED_LOGO_TYPES.join(",")}
              className="hidden"
              onChange={handleLogoChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              className="cursor-pointer"
            >
              <ImagePlus className="mr-1 size-3" />
              {logoPreview ? "Replace" : "Choose file"}
            </Button>
            {logoFile && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={clearLogo}
                className="cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPEG, WebP, or GIF (max 750KB)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="track-title">Title</Label>
        <Input
          id="track-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Best Financial Hack"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="track-sponsor">Presented by</Label>
        <Input
          id="track-sponsor"
          value={sponsorName}
          onChange={(e) => setSponsorName(e.target.value)}
          placeholder="Capital One"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="track-description">Description</Label>
        <Textarea
          id="track-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Your chance to change the game in fintech."
          rows={5}
        />
        <p className="text-xs text-muted-foreground">
          Line breaks are preserved.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Prizes</Label>
        <div className="space-y-2">
          {prizes.map((prize, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={prize.place}
                onChange={(e) => updatePrize(index, { place: e.target.value })}
                placeholder="1st"
                aria-label={`Prize ${index + 1} place`}
                className="w-20 shrink-0"
              />
              <Input
                value={prize.prize}
                onChange={(e) => updatePrize(index, { prize: e.target.value })}
                placeholder="$300 Amazon gift card"
                aria-label={`Prize ${index + 1} reward`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removePrize(index)}
                className="cursor-pointer text-muted-foreground hover:text-red-500 shrink-0"
                title="Remove prize"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPrize}
          disabled={prizes.length >= 10}
          className="cursor-pointer"
        >
          <Plus className="mr-1 size-3" />
          Add prize
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="track-order">Display Order</Label>
        <Input
          id="track-order"
          type="number"
          min={0}
          value={displayOrder}
          onChange={(e) => setDisplayOrder(Number(e.target.value))}
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={saving}
          disabled={!title.trim()}
          className="cursor-pointer"
        >
          {track ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TrackFormDialog({
  open,
  onOpenChange,
  track,
  saving,
  onSubmit,
}: TrackFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{track ? "Edit Track" : "Add Track"}</DialogTitle>
        </DialogHeader>
        {open && (
          <TrackForm
            key={track?.id ?? "new"}
            track={track}
            saving={saving}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
