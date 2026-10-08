import { IconBookmark, IconEyeOff, IconHandStop } from "@tabler/icons-react";
import { type PointerEvent, type ReactNode, useRef, useState } from "react";

import { cn } from "@/shared/lib/utils";

// Distance (px) a card has to travel before a release counts as a swipe.
export const SWIPE_THRESHOLD = 90;

interface SwipeableCardProps {
  children: ReactNode;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  disabled?: boolean;
  className?: string;
}

// Wraps a card with horizontal swipe gestures for touch. Vertical movement is
// left to the browser (touch-action: pan-y) so the grid still scrolls.
export function SwipeableCard({
  children,
  onSwipeRight,
  onSwipeLeft,
  disabled,
  className,
}: SwipeableCardProps) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  // A drag ends in a click on whatever was under the finger; swallow it so a
  // swipe doesn't also open the card's details.
  const dragged = useRef(false);

  const reset = () => {
    start.current = null;
    setDx(0);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.pointerType === "mouse") return;
    dragged.current = false;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const moveX = e.clientX - s.x;
    const moveY = e.clientY - s.y;
    // A mostly-vertical drag is a scroll; let it go.
    if (dx === 0 && Math.abs(moveY) > Math.abs(moveX)) {
      start.current = null;
      return;
    }
    if (Math.abs(moveX) > 8) dragged.current = true;
    setDx(moveX);
  };

  const onPointerUp = () => {
    if (!start.current) return;
    if (dx > SWIPE_THRESHOLD) {
      setLeaving("right");
      onSwipeRight();
    } else if (dx < -SWIPE_THRESHOLD) {
      setLeaving("left");
      onSwipeLeft();
    }
    reset();
  };

  const progress = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);

  return (
    <div
      className={cn("relative touch-pan-y select-none", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={reset}
      onClickCapture={(e) => {
        if (!dragged.current) return;
        dragged.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
      onTransitionEnd={() => setLeaving(null)}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center rounded-[3px] px-5 text-sm font-medium",
          dx > 0
            ? "justify-start bg-ice/15 text-ink"
            : "justify-end bg-ink/[0.03] text-ink/75",
        )}
        style={{ opacity: dx === 0 ? 0 : progress }}
      >
        {dx > 0 ? (
          <span className="flex items-center gap-1.5">
            <IconHandStop className="size-4" /> Poke
            <IconBookmark className="ml-1 size-4" /> Save
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            Hide <IconEyeOff className="size-4" />
          </span>
        )}
      </div>
      <div
        className={cn(
          "relative h-full",
          dx === 0 && "transition-transform duration-200",
        )}
        style={{
          transform:
            leaving === "right"
              ? "translateX(0)"
              : `translateX(${dx}px) rotate(${dx / 40}deg)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
