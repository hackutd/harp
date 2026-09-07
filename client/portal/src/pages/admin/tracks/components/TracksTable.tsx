import { Code, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
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
import { cn } from "@/shared/lib/utils";

import { fetchTracks } from "../api";
import { ALLOWED_LOGO_TYPES, MAX_LOGO_BYTES } from "../constants";
import type { Track, TrackPayload } from "../types";
import { TrackFormDialog } from "./TrackFormDialog";

interface TracksTableProps {
  tracks: Track[];
  saving: boolean;
  canEdit: boolean;
  onCreateTrack: (payload: TrackPayload) => Promise<string | null>;
  onUpdateTrack: (id: string, payload: TrackPayload) => Promise<boolean>;
  onDeleteTrack: (id: string) => Promise<boolean>;
  onUploadLogo: (
    trackId: string,
    file: File,
  ) => Promise<{ success: boolean } | null>;
}

export function TracksTable({
  tracks,
  saving,
  canEdit,
  onCreateTrack,
  onUpdateTrack,
  onDeleteTrack,
  onUploadLogo,
}: TracksTableProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Track | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Track | null>(null);
  const [uploadingLogoId, setUploadingLogoId] = useState<string | null>(null);
  const [jsonPopoverOpen, setJsonPopoverOpen] = useState(false);
  const [loadingJson, setLoadingJson] = useState(false);
  const [jsonResponse, setJsonResponse] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoTargetIdRef = useRef<string | null>(null);

  const loadJsonResponse = useCallback(async () => {
    setLoadingJson(true);
    setJsonError(null);

    const response = await fetchTracks();

    if (response.status === 200 && response.data) {
      const truncated = response.data.tracks.map((t) => ({
        ...t,
        logo_data: t.logo_data
          ? `${t.logo_data.slice(0, 40)}... (${Math.round((t.logo_data.length * 3) / 4 / 1024)}KB)`
          : "",
      }));
      setJsonResponse(JSON.stringify({ data: { tracks: truncated } }, null, 2));
    } else {
      setJsonResponse("");
      setJsonError(response.error ?? "Failed to fetch tracks.");
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

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (track: Track) => {
    if (!canEdit) return;
    setEditTarget(track);
    setFormOpen(true);
  };

  // The record is saved first so a create has an id to hang the logo on; each
  // step reports separately because either can fail on its own.
  const handleSubmit = async (payload: TrackPayload, logoFile?: File) => {
    if (editTarget) {
      const success = await onUpdateTrack(editTarget.id, payload);
      if (!success) return;

      toast.success("Track updated");
      setFormOpen(false);

      if (logoFile) {
        const result = await onUploadLogo(editTarget.id, logoFile);
        if (result) toast.success("Logo uploaded");
      }
    } else {
      const trackId = await onCreateTrack(payload);
      if (!trackId) return;

      toast.success("Track created");
      setFormOpen(false);

      if (logoFile) {
        const result = await onUploadLogo(trackId, logoFile);
        if (result) toast.success("Logo uploaded");
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const success = await onDeleteTrack(deleteTarget.id);
    if (success) {
      toast.success("Track deleted");
    }
    setDeleteTarget(null);
  };

  const handleLogoClick = (trackId: string) => {
    logoTargetIdRef.current = trackId;
    logoInputRef.current?.click();
  };

  const handleLogoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    const trackId = logoTargetIdRef.current;
    if (!file || !trackId) return;

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error("Unsupported file type. Use PNG, JPEG, WebP, or GIF.");
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      toast.error("File too large. Maximum size is 750KB.");
      return;
    }

    setUploadingLogoId(trackId);
    const result = await onUploadLogo(trackId, file);
    setUploadingLogoId(null);

    if (result) {
      toast.success("Logo uploaded");
    }

    if (logoInputRef.current) logoInputRef.current.value = "";
    logoTargetIdRef.current = null;
  };

  const renderLogoButton = (track: Track) => (
    <button
      type="button"
      className="cursor-pointer relative group/logo disabled:cursor-default"
      onClick={(e) => {
        e.stopPropagation();
        handleLogoClick(track.id);
      }}
      disabled={!canEdit || uploadingLogoId === track.id}
      title={canEdit ? "Click to upload logo" : undefined}
    >
      {uploadingLogoId === track.id ? (
        <Skeleton className="size-10 rounded border" />
      ) : track.logo_data ? (
        <div className="relative">
          <img
            src={`data:${track.logo_content_type};base64,${track.logo_data}`}
            alt={track.sponsor_name || track.title}
            className="size-10 rounded object-contain border"
          />
          {canEdit && (
            <div className="absolute inset-0 rounded bg-black/50 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center">
              <ImagePlus className="size-4 text-white" />
            </div>
          )}
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
        accept={ALLOWED_LOGO_TYPES.join(",")}
        className="hidden"
        onChange={handleLogoFileChange}
      />

      <Card className="overflow-hidden flex flex-col h-full min-h-0">
        <CardHeader className="shrink-0 flex flex-row items-center justify-between">
          <CardDescription className="font-light">
            {tracks.length} track(s) configured
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
                    <code>GET /v1/public/tracks</code> — logo_data truncated
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
            <Button
              size="sm"
              onClick={openCreate}
              disabled={!canEdit}
              className="cursor-pointer"
            >
              <Plus className="mr-1 size-4" />
              Add Track
            </Button>
          </div>
        </CardHeader>
        {!canEdit && (
          <div className="mx-6 mb-3 shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            A super admin has disabled track editing for admins. You can view
            tracks but can&apos;t add, edit, or delete them.
          </div>
        )}
        <CardContent className="p-0 flex-1 overflow-hidden">
          <div className="relative overflow-auto h-full p-6 pt-0 pb-3">
            {tracks.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No tracks yet. Click &quot;Add Track&quot; to get started.
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-16">Order</TableHead>
                    <TableHead className="w-20">Logo</TableHead>
                    <TableHead className="w-72">Track</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-56">Prizes</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tracks.map((track) => (
                    <TableRow
                      key={track.id}
                      className={cn(
                        "group [&>td]:py-3",
                        canEdit && "cursor-pointer hover:bg-muted/50",
                      )}
                      onClick={canEdit ? () => openEdit(track) : undefined}
                    >
                      <TableCell className="tabular-nums">
                        {track.display_order}
                      </TableCell>
                      <TableCell>{renderLogoButton(track)}</TableCell>
                      <TableCell>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {track.sponsor_name && (
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                Presented by {track.sponsor_name}
                              </div>
                            )}
                            <span className="font-medium">{track.title}</span>
                          </div>
                          {canEdit && (
                            <Pencil className="mt-1 size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground line-clamp-2 block max-w-xl whitespace-pre-line">
                          {track.description}
                        </span>
                      </TableCell>
                      <TableCell>
                        {track.prizes.length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        ) : (
                          <ul className="space-y-0.5 text-sm text-muted-foreground">
                            {track.prizes.map((prize, i) => (
                              <li key={i} className="line-clamp-1">
                                <span className="font-medium text-foreground">
                                  {prize.place}
                                </span>
                                : {prize.prize}
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="cursor-pointer text-muted-foreground hover:text-red-500 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(track);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <TrackFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        track={editTarget}
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
            <AlertDialogTitle>Delete Track</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this track? This action cannot be
              undone.
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
