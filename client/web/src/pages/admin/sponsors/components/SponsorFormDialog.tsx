import { ImagePlus, Loader2, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { Sponsor, SponsorPayload } from "../types";

const TIER_OPTIONS = [
  "Title",
  "Platinum",
  "Gold",
  "Silver",
  "Bronze",
  "Standard",
];
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

interface SponsorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sponsor: Sponsor | null;
  saving: boolean;
  onSubmit: (payload: SponsorPayload, logoFile?: File) => void;
}

function SponsorForm({
  sponsor,
  saving,
  onSubmit,
  onCancel,
}: {
  sponsor: Sponsor | null;
  saving: boolean;
  onSubmit: (payload: SponsorPayload, logoFile?: File) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(sponsor?.name ?? "");
  const [tier, setTier] = useState(sponsor?.tier ?? "Standard");
  const [websiteUrl, setWebsiteUrl] = useState(sponsor?.website_url ?? "");
  const [description, setDescription] = useState(sponsor?.description ?? "");
  const [displayOrder, setDisplayOrder] = useState(sponsor?.display_order ?? 0);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>(
    sponsor?.logo_data
      ? `data:${sponsor.logo_content_type};base64,${sponsor.logo_data}`
      : "",
  );
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Unsupported file type. Use PNG, JPEG, WebP, or GIF.");
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      toast.error("File too large. Maximum size is 1MB.");
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(
      sponsor?.logo_data
        ? `data:${sponsor.logo_content_type};base64,${sponsor.logo_data}`
        : "",
    );
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !tier) return;

    onSubmit(
      {
        name: name.trim(),
        tier,
        website_url: websiteUrl.trim(),
        description: description.trim(),
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
              accept={ALLOWED_TYPES.join(",")}
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
          PNG, JPEG, WebP, or GIF (max 1MB)
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="sponsor-name">Name</Label>
        <Input
          id="sponsor-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sponsor name"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sponsor-tier">Tier</Label>
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger id="sponsor-tier">
            <SelectValue placeholder="Select tier" />
          </SelectTrigger>
          <SelectContent>
            {TIER_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="sponsor-website">Website URL</Label>
        <Input
          id="sponsor-website"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://example.com"
          type="url"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sponsor-description">Description</Label>
        <Textarea
          id="sponsor-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description"
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sponsor-order">Display Order</Label>
        <Input
          id="sponsor-order"
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
          disabled={saving || !name.trim()}
          className="cursor-pointer"
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {sponsor ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SponsorFormDialog({
  open,
  onOpenChange,
  sponsor,
  saving,
  onSubmit,
}: SponsorFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{sponsor ? "Edit Sponsor" : "Add Sponsor"}</DialogTitle>
        </DialogHeader>
        {open && (
          <SponsorForm
            key={sponsor?.id ?? "new"}
            sponsor={sponsor}
            saving={saving}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
