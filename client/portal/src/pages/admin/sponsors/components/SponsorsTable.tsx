import {
  Code,
  ExternalLink,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { fetchSponsors } from "../api";
import type { Sponsor, SponsorPayload } from "../types";
import { SponsorFormDialog } from "./SponsorFormDialog";

const tierColors: Record<string, string> = {
  Title: "bg-rose-100 text-rose-800",
  Platinum: "bg-violet-100 text-violet-800",
  Gold: "bg-amber-100 text-amber-800",
  Silver: "bg-gray-100 text-gray-800",
  Bronze: "bg-orange-100 text-orange-800",
  Standard: "bg-blue-100 text-blue-800",
};

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

interface SponsorsTableProps {
  sponsors: Sponsor[];
  saving: boolean;
  onCreateSponsor: (payload: SponsorPayload) => Promise<string | null>;
  onUpdateSponsor: (id: string, payload: SponsorPayload) => Promise<boolean>;
  onDeleteSponsor: (id: string) => Promise<boolean>;
  onUploadLogo: (
    sponsorId: string,
    file: File,
  ) => Promise<{ success: boolean } | null>;
}

export function SponsorsTable({
  sponsors,
  saving,
  onCreateSponsor,
  onUpdateSponsor,
  onDeleteSponsor,
  onUploadLogo,
}: SponsorsTableProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Sponsor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Sponsor | null>(null);
  const [uploadingLogoId, setUploadingLogoId] = useState<string | null>(null);
  const [jsonPopoverOpen, setJsonPopoverOpen] = useState(false);
  const [loadingJson, setLoadingJson] = useState(false);
  const [jsonResponse, setJsonResponse] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const loadJsonResponse = useCallback(async () => {
    setLoadingJson(true);
    setJsonError(null);

    const response = await fetchSponsors();

    if (response.status === 200 && response.data) {
      const truncated = response.data.sponsors.map((s) => ({
        ...s,
        logo_data: s.logo_data
          ? `${s.logo_data.slice(0, 40)}... (${Math.round((s.logo_data.length * 3) / 4 / 1024)}KB)`
          : "",
      }));
      setJsonResponse(
        JSON.stringify({ data: { sponsors: truncated } }, null, 2),
      );
    } else {
      setJsonResponse("");
      setJsonError(response.error ?? "Failed to fetch sponsors.");
    }

    setLoadingJson(false);
  }, []);

  const handleJsonPopoverOpenChange = useCallback(
    (open: boolean) => {
      setJsonPopoverOpen(open);
      if (open) {
        void loadJsonResponse();
      }
    },
    [loadJsonResponse],
  );

  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoTargetIdRef = useRef<string | null>(null);

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (sponsor: Sponsor) => {
    setEditTarget(sponsor);
    setFormOpen(true);
  };

  const handleSubmit = async (payload: SponsorPayload, logoFile?: File) => {
    if (editTarget) {
      const success = await onUpdateSponsor(editTarget.id, payload);
      if (!success) {
        toast.error("Failed to update sponsor");
        return;
      }

      toast.success("Sponsor updated");
      setFormOpen(false);

      if (logoFile) {
        const result = await onUploadLogo(editTarget.id, logoFile);
        if (result) {
          toast.success("Logo uploaded");
        } else {
          toast.error("Failed to upload logo");
        }
      }
    } else {
      const sponsorId = await onCreateSponsor(payload);

      if (sponsorId) {
        toast.success("Sponsor created");
        setFormOpen(false);

        if (logoFile) {
          const result = await onUploadLogo(sponsorId, logoFile);
          if (result) {
            toast.success("Logo uploaded");
          } else {
            toast.error("Failed to upload logo");
          }
        }
      } else {
        toast.error("Failed to create sponsor");
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const success = await onDeleteSponsor(deleteTarget.id);
    if (success) {
      toast.success("Sponsor deleted");
    } else {
      toast.error("Failed to delete sponsor");
    }
    setDeleteTarget(null);
  };

  const handleLogoClick = (sponsorId: string) => {
    logoTargetIdRef.current = sponsorId;
    logoInputRef.current?.click();
  };

  const handleLogoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    const sponsorId = logoTargetIdRef.current;
    if (!file || !sponsorId) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Unsupported file type. Use PNG, JPEG, WebP, or GIF.");
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      toast.error("File too large. Maximum size is 1MB.");
      return;
    }

    setUploadingLogoId(sponsorId);
    const result = await onUploadLogo(sponsorId, file);
    setUploadingLogoId(null);

    if (result) {
      toast.success("Logo uploaded");
    } else {
      toast.error("Failed to upload logo");
    }

    if (logoInputRef.current) logoInputRef.current.value = "";
    logoTargetIdRef.current = null;
  };

  const renderLogoButton = (sponsor: Sponsor) => (
    <button
      type="button"
      className="cursor-pointer relative group/logo"
      onClick={(e) => {
        e.stopPropagation();
        handleLogoClick(sponsor.id);
      }}
      disabled={uploadingLogoId === sponsor.id}
      title="Click to upload logo"
    >
      {uploadingLogoId === sponsor.id ? (
        <Skeleton className="size-10 rounded border" />
      ) : sponsor.logo_data ? (
        <div className="relative">
          <img
            src={`data:${sponsor.logo_content_type};base64,${sponsor.logo_data}`}
            alt={sponsor.name}
            className="size-10 rounded object-contain border"
          />
          <div className="absolute inset-0 rounded bg-black/50 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center">
            <ImagePlus className="size-4 text-white" />
          </div>
        </div>
      ) : (
        <div className="size-10 rounded border border-dashed flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">
          <ImagePlus className="size-4" />
        </div>
      )}
    </button>
  );

  return (
    <>
      <input
        ref={logoInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={handleLogoFileChange}
      />

      <Card className="overflow-hidden flex flex-col h-full min-h-0">
        <CardHeader className="shrink-0 flex flex-row items-center justify-between">
          <CardDescription className="font-light">
            {sponsors.length} sponsor(s) configured
          </CardDescription>
          <div className="flex items-center gap-2">
            {saving && <Skeleton className="size-4 rounded-full" />}
            <Popover
              open={jsonPopoverOpen}
              onOpenChange={handleJsonPopoverOpenChange}
            >
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="cursor-pointer">
                  <Code className="mr-1 size-4" />
                  Preview API
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(90vw,640px)] p-3">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    <code>GET /v1/public/sponsors</code> — logo_data truncated
                  </p>
                  {loadingJson ? (
                    <p className="text-sm text-muted-foreground">
                      Loading JSON response...
                    </p>
                  ) : jsonError ? (
                    <p className="text-sm text-destructive">{jsonError}</p>
                  ) : (
                    <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                      {jsonResponse}
                    </pre>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Button size="sm" onClick={openCreate} className="cursor-pointer">
              <Plus className="mr-1 size-4" />
              Add Sponsor
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <div className="relative overflow-auto h-full p-6 pt-0 pb-3">
            {sponsors.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No sponsors yet. Click &quot;Add Sponsor&quot; to get started.
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-20">Logo</TableHead>
                    <TableHead className="w-48">Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-56">Tier</TableHead>
                    <TableHead className="w-20">Order</TableHead>
                    <TableHead className="w-48">Link</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sponsors.map((sponsor) => (
                    <TableRow
                      key={sponsor.id}
                      className="group [&>td]:py-3 cursor-pointer hover:bg-muted/50"
                      onClick={() => openEdit(sponsor)}
                    >
                      <TableCell>{renderLogoButton(sponsor)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{sponsor.name}</span>
                          <Pencil className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                      </TableCell>
                      <TableCell>
                        {sponsor.description && (
                          <span className="text-sm text-muted-foreground truncate block max-w-xs">
                            {sponsor.description}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-xs px-1.5 py-0 ${tierColors[sponsor.tier] ?? "bg-blue-100 text-blue-800"}`}
                        >
                          {sponsor.tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {sponsor.display_order}
                      </TableCell>
                      <TableCell>
                        {sponsor.website_url && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href={sponsor.website_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="size-4" />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{sponsor.website_url}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="cursor-pointer text-muted-foreground hover:text-red-500 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(sponsor);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <SponsorFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        sponsor={editTarget}
        saving={saving}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sponsor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget?.name ?? "this sponsor"}</strong>? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 cursor-pointer"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
