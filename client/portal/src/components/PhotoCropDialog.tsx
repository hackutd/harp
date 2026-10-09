import {
  IconLoader2,
  IconPhoto,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";
import {
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { detectPlatform } from "@/shared/install";
import { cn } from "@/shared/lib/utils";
import {
  CENTERED_CROP,
  clampCrop,
  cropImageStyle,
  type ImageSize,
  MAX_PHOTO_ZOOM,
  panCrop,
  type PhotoCrop,
  renderCroppedPhoto,
} from "@/shared/photo";

interface PhotoSource {
  url: string;
  image: HTMLImageElement;
  size: ImageSize;
  /** An object URL for a picked file, revoked when replaced. */
  owned: boolean;
}

interface PhotoCropDialogProps {
  onClose: () => void;
  /** The current photo, offered for reframing when the browser can read it. */
  currentUrl: string | null;
  /** Shown on the Directory preview. */
  name: string;
  fallback: string;
  busy: boolean;
  onSave: (file: File) => Promise<boolean>;
}

// The OS photo picker is the gallery on phones: an image-only file input opens
// Photos on iOS and the system photo picker on Android, installed or not, and
// needs no permission prompt. Name it the way each platform does.
function pickLabel(): string {
  const platform = detectPlatform();
  if (platform === "ios") return "Choose from Photos";
  if (platform === "android") return "Choose from gallery";
  return "Choose a photo";
}

function loadImage(url: string, crossOrigin: boolean) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) {
      image.crossOrigin = "anonymous";
      image.referrerPolicy = "no-referrer";
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image failed to load"));
    image.src = url;
  });
}

interface CroppedImageProps {
  source: PhotoSource;
  crop: PhotoCrop;
}

// The framed photo, drawn with percentages so it fits any 4:5 box.
function CroppedImage({ source, crop }: CroppedImageProps) {
  const style: CSSProperties = {
    position: "absolute",
    maxWidth: "none",
    ...cropImageStyle(source.size, crop),
  };
  return (
    <img
      src={source.url}
      alt=""
      draggable={false}
      referrerPolicy="no-referrer"
      className="pointer-events-none select-none"
      style={style}
    />
  );
}

// Picks and frames the profile photo. One 4:5 crop serves both places it
// shows: the Directory card shows all of it, and round avatars show its centre
// square, outlined here as the circle.
// Render it only while open, so every opening starts fresh.
export function PhotoCropDialog({
  onClose,
  currentUrl,
  name,
  fallback,
  busy,
  onSave,
}: PhotoCropDialogProps) {
  const [source, setSource] = useState<PhotoSource | null>(null);
  const [crop, setCrop] = useState<PhotoCrop>(CENTERED_CROP);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  const replaceSource = (next: PhotoSource) => {
    setSource(next);
    setCrop(CENTERED_CROP);
  };

  // Start from the current photo if the browser will let us redraw it. A
  // picture served without CORS can still be shown, just not reframed.
  const [loading, setLoading] = useState(currentUrl != null);
  useEffect(() => {
    if (!currentUrl) return;
    let cancelled = false;
    loadImage(currentUrl, true)
      .then((image) => {
        if (cancelled) return;
        setSource({
          url: currentUrl,
          image,
          size: { width: image.naturalWidth, height: image.naturalHeight },
          owned: false,
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Only the photo the dialog opened with; saving changes it on the way out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Free a picked file's object URL when it's replaced or the dialog closes.
  useEffect(
    () => () => {
      if (source?.owned) URL.revokeObjectURL(source.url);
    },
    [source],
  );

  // Wheel and trackpad zoom. React's wheel listener is passive, so it can't
  // stop the page from scrolling; attach our own.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !source) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setCrop((c) =>
        clampCrop(source.size, {
          ...c,
          zoom: c.zoom * Math.exp(-e.deltaY * 0.002),
        }),
      );
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, [source]);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLoading(true);
    try {
      const image = await loadImage(url, false);
      replaceSource({
        url,
        image,
        size: { width: image.naturalWidth, height: image.naturalHeight },
        owned: true,
      });
    } catch {
      URL.revokeObjectURL(url);
      toast.error("Couldn't open that photo. Try a JPG or PNG.");
    } finally {
      setLoading(false);
    }
  };

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!source) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      pinch.current = { distance: distance(), zoom: crop.zoom };
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    const frame = frameRef.current;
    if (!prev || !source || !frame) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinch.current) {
      const start = pinch.current;
      setCrop((c) =>
        clampCrop(source.size, {
          ...c,
          zoom: start.zoom * (distance() / start.distance),
        }),
      );
      return;
    }
    const width = frame.getBoundingClientRect().width;
    setCrop((c) =>
      panCrop(source.size, c, e.clientX - prev.x, e.clientY - prev.y, width),
    );
  };

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!source || !frameRef.current) return;
    const width = frameRef.current.getBoundingClientRect().width;
    const step = 12;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setCrop((c) => panCrop(source.size, c, dx, dy, width));
    } else if (e.key === "+" || e.key === "=" || e.key === "-") {
      e.preventDefault();
      const factor = e.key === "-" ? 1 / 1.15 : 1.15;
      setCrop((c) => clampCrop(source.size, { ...c, zoom: c.zoom * factor }));
    }
  };

  const save = async () => {
    if (!source) return;
    const file = await renderCroppedPhoto(source.image, crop);
    if (!file) {
      toast.error("Couldn't prepare that photo. Try choosing it again.");
      return;
    }
    if (await onSave(file)) onClose();
  };

  // What to show when there's nothing to frame yet: the current photo as it
  // is (it couldn't be loaded for reframing), or the initials.
  const placeholder = currentUrl ? (
    <img
      src={currentUrl}
      alt=""
      referrerPolicy="no-referrer"
      className="size-full object-cover"
    />
  ) : (
    <span className="flex size-full items-center justify-center text-4xl font-light text-ink/65">
      {fallback}
    </span>
  );

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto rounded-xl border-ink/10 bg-surface p-5 text-ink sm:max-w-md sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-normal tracking-tight">
            Your photo
          </DialogTitle>
          <DialogDescription className="text-sm font-light text-ink/65">
            {source
              ? "Drag to center yourself, pinch or use the slider to zoom. The circle is your profile picture; the whole frame is your Directory card."
              : "Pick a photo, then drag to center yourself."}
          </DialogDescription>
        </DialogHeader>

        <div
          ref={frameRef}
          role={source ? "application" : undefined}
          aria-label={
            source
              ? "Photo framing. Drag or use the arrow keys to move, plus and minus to zoom."
              : undefined
          }
          tabIndex={source ? 0 : -1}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={onKeyDown}
          className={cn(
            "relative mx-auto aspect-[4/5] w-full max-w-[17rem] touch-none overflow-hidden rounded-[3px] bg-surface-2 select-none focus-visible:ring-2 focus-visible:ring-ice/50 focus-visible:outline-none",
            source && "cursor-grab active:cursor-grabbing",
          )}
        >
          {source ? (
            <>
              <CroppedImage source={source} crop={crop} />
              {/* The profile picture: the frame's centre square. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-1/2 aspect-square -translate-y-1/2 rounded-full border-2 border-dashed border-white/80 mix-blend-difference"
              />
            </>
          ) : (
            <>
              <div className="absolute inset-0 opacity-40">{placeholder}</div>
              <button
                type="button"
                disabled={loading}
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm font-normal text-ink"
              >
                {loading ? (
                  <IconLoader2 className="size-6 animate-spin" />
                ) : (
                  <>
                    <span className="flex size-12 items-center justify-center rounded-full bg-ink/10">
                      <IconPhoto className="size-6" strokeWidth={1.5} />
                    </span>
                    {pickLabel()}
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {source && (
          <div className="mx-auto flex w-full max-w-[17rem] items-center gap-3">
            <IconZoomOut
              className="size-4 shrink-0 text-ink/65"
              strokeWidth={1.75}
            />
            <Slider
              aria-label="Zoom"
              min={1}
              max={MAX_PHOTO_ZOOM}
              step={0.01}
              value={[crop.zoom]}
              onValueChange={([zoom]) =>
                setCrop((c) => clampCrop(source.size, { ...c, zoom }))
              }
            />
            <IconZoomIn
              className="size-4 shrink-0 text-ink/65"
              strokeWidth={1.75}
            />
          </div>
        )}

        {/* How the photo reads in each place it shows. */}
        <div className="flex items-end justify-center gap-8">
          <figure className="flex flex-col items-center gap-2">
            <div className="relative size-16 overflow-hidden rounded-full border border-ink/15 bg-surface-2">
              {source ? (
                <div className="absolute inset-x-0 top-1/2 aspect-[4/5] -translate-y-1/2 overflow-hidden">
                  <CroppedImage source={source} crop={crop} />
                </div>
              ) : (
                placeholder
              )}
            </div>
            <figcaption className="text-[11px] font-light tracking-widest text-ink/55 uppercase">
              Profile
            </figcaption>
          </figure>
          <figure className="flex flex-col items-center gap-2">
            <div className="directory-postcard w-[4.5rem] rounded-[2px] p-1 pb-2">
              <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
                {source ? (
                  <CroppedImage source={source} crop={crop} />
                ) : (
                  placeholder
                )}
              </div>
              <p className="mt-1 truncate text-[7px] font-medium text-ink">
                {name}
              </p>
            </div>
            <figcaption className="text-[11px] font-light tracking-widest text-ink/55 uppercase">
              Directory
            </figcaption>
          </figure>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFile(e)}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {source && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || loading}
              onClick={() => fileRef.current?.click()}
              className="h-11 flex-1 rounded-full border-ink/15 bg-transparent text-sm font-normal text-ink hover:bg-surface-2"
            >
              <IconPhoto className="size-4" strokeWidth={1.75} />
              {pickLabel()}
            </Button>
          )}
          <Button
            type="button"
            disabled={!source || busy}
            onClick={() => void save()}
            className="h-11 flex-1 rounded-full bg-tide text-sm font-normal text-white hover:bg-tide-hover"
          >
            {busy && <IconLoader2 className="size-4 animate-spin" />}
            Save photo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
