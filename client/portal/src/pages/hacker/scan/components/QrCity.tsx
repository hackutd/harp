import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

import sky from "@/assets/sky.webp";
import { cn } from "@/shared/lib/utils";

import {
  buildCityLayout,
  modulesToSvgPath,
  PLATE_CORNER_RADIUS,
  QUIET_ZONE,
  ROOF_COLOR,
} from "../city/qrCity";
import type { QrCityScene } from "../city/QrCityScene";
import {
  overlayOpacity,
  prefersReducedMotion,
  startTween,
} from "../city/tween";

const TRANSITION_MS = 900;
/** Movement past this many pixels turns a press into a drag, not a tap. */
const DRAG_THRESHOLD_PX = 6;

interface DragState {
  pointerId: number;
  x: number;
  y: number;
  moved: boolean;
}

type SceneStatus = "loading" | "ready" | "unsupported";
type ViewMode = "city" | "qr";

interface QrCityProps {
  value: string;
  className?: string;
}

/**
 * The hacker's QR code as a neon city: every dark module is a building, so
 * looking straight down turns the skyline into the code. A tap tweens the
 * camera between the two views; the real vector QR fades in on top at the end
 * so scanners always read a crisp code rather than a shaded render. Dragging
 * in the city view turns the camera around it instead.
 */
export function QrCity({ value, className }: QrCityProps) {
  const layout = useMemo(() => buildCityLayout(value), [value]);
  const svgPath = useMemo(
    () => modulesToSvgPath(layout.modules, QUIET_ZONE),
    [layout],
  );

  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const skyRef = useRef<HTMLImageElement>(null);
  const sceneRef = useRef<QrCityScene | null>(null);
  const progressRef = useRef(0);
  const cancelTweenRef = useRef<() => void>(() => {});
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const [status, setStatus] = useState<SceneStatus>("loading");
  const [mode, setMode] = useState<ViewMode>("city");

  const applyProgress = (progress: number) => {
    progressRef.current = progress;
    sceneRef.current?.setProgress(progress);
    if (overlayRef.current) {
      overlayRef.current.style.opacity = String(overlayOpacity(progress));
    }
    if (skyRef.current) {
      skyRef.current.style.opacity = String(1 - progress);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let scene: QrCityScene | null = null;

    import("../city/QrCityScene")
      .then((module) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        try {
          scene = new module.QrCityScene(canvas, layout, {
            animate: !prefersReducedMotion(),
          });
        } catch {
          setStatus("unsupported");
          return;
        }
        sceneRef.current = scene;
        scene.setSize(frameRef.current?.clientWidth ?? canvas.clientWidth);
        scene.setProgress(progressRef.current);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("unsupported");
      });

    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [layout]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || status !== "ready") return;
    const observer = new ResizeObserver(() => {
      sceneRef.current?.setSize(frame.clientWidth);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [status]);

  useEffect(() => {
    const cancelTween = cancelTweenRef;
    return () => cancelTween.current();
  }, []);

  const canOrbit = status === "ready" && mode === "city";

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    suppressClickRef.current = false;
    if (!canOrbit || !event.isPrimary || event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    drag.x = event.clientX;
    drag.y = event.clientY;
    // A drag across the whole frame turns the city half way round.
    const radiansPerPx = Math.PI / Math.max(event.currentTarget.clientWidth, 1);
    sceneRef.current?.orbitBy(-dx * radiansPerPx, dy * radiansPerPx);
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    // The click that follows a drag must not toggle to the QR.
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
  };

  const handlePointerCancel = () => {
    dragRef.current = null;
  };

  const handleToggle = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (status !== "ready") return;
    const next: ViewMode = mode === "city" ? "qr" : "city";
    setMode(next);
    cancelTweenRef.current();
    cancelTweenRef.current = startTween({
      from: progressRef.current,
      to: next === "qr" ? 1 : 0,
      durationMs: prefersReducedMotion() ? 0 : TRANSITION_MS,
      onUpdate: applyProgress,
    });
  };

  const showStaticCode = status === "unsupported";
  const hint =
    status === "loading"
      ? "Building your city…"
      : showStaticCode
        ? "Show this at check-in, meals, and events"
        : mode === "city"
          ? "Drag to look around, tap to show your QR code"
          : "Tap to return to the city";

  return (
    <div className={cn("flex w-full flex-col items-center", className)}>
      <button
        type="button"
        onClick={handleToggle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        disabled={status !== "ready"}
        aria-pressed={mode === "qr"}
        aria-label={
          mode === "qr" ? "Return to the city view" : "Show my QR code"
        }
        className={cn(
          "relative block aspect-square w-full max-w-[440px] overflow-hidden outline-none select-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
          // Vertical swipes still scroll the page on touch screens.
          canOrbit && "cursor-grab touch-pan-y active:cursor-grabbing",
        )}
        style={{ borderRadius: `${PLATE_CORNER_RADIUS * 100}%` }}
      >
        <img
          ref={skyRef}
          src={sky}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover object-[60%_0%] mask-x-from-75% mask-t-from-85% mask-b-from-65%"
          style={{ opacity: showStaticCode ? 0 : 1 }}
        />
        <div ref={frameRef} className="absolute inset-0">
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="block h-full w-full"
          />
        </div>
        <svg
          ref={overlayRef}
          data-hacker-keep-light
          role="img"
          aria-label="Your QR code"
          viewBox={`0 0 ${layout.plateSize} ${layout.plateSize}`}
          shapeRendering="crispEdges"
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ opacity: showStaticCode ? 1 : overlayOpacity(0) }}
        >
          <rect
            width={layout.plateSize}
            height={layout.plateSize}
            fill="#ffffff"
          />
          <path d={svgPath} fill={ROOF_COLOR} />
        </svg>
      </button>
      <p className="mt-3 text-center text-xs font-light text-[#8A8A8A]">
        {hint}
      </p>
    </div>
  );
}
