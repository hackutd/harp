import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/shared/lib/utils";

// The selected item of a Radix tab list ("active") or toggle group ("on").
function activeItem(container: HTMLElement): HTMLElement | null {
  for (const child of Array.from(container.children)) {
    const state = child.getAttribute("data-state");
    if (state === "active" || state === "on") return child as HTMLElement;
  }
  return null;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function sameBox(a: Box | null, b: Box | null): boolean {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.x === b.x &&
      a.y === b.y &&
      a.width === b.width &&
      a.height === b.height)
  );
}

/**
 * The selected-item pill for a segmented control. Render it as the first
 * child of a `relative` tab list or toggle group, and give the items
 * `relative` and no active background of their own. It follows the active
 * item, so picking another one slides the pill across rather than jumping.
 */
export function SegmentedHighlight({ className }: { className?: string }) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  // Off for the first placement, so the pill starts under the active item
  // instead of flying in from the corner.
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    // The pill's own parent, since a ref on the list is not attached yet
    // when this effect runs.
    const container = pillRef.current?.parentElement;
    if (!container) return;

    const measure = () => {
      const active = activeItem(container);
      const next = active
        ? {
            x: active.offsetLeft,
            y: active.offsetTop,
            width: active.offsetWidth,
            height: active.offsetHeight,
          }
        : null;
      setBox((prev) => (sameBox(prev, next) ? prev : next));
    };

    // Items resize as their count badges load, and options come and go.
    const resize = new ResizeObserver(measure);
    const observeItems = () => {
      resize.disconnect();
      resize.observe(container);
      for (const child of Array.from(container.children)) resize.observe(child);
    };
    const mutation = new MutationObserver(() => {
      observeItems();
      measure();
    });
    mutation.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });

    observeItems();
    measure();
    const frame = requestAnimationFrame(() => setAnimate(true));

    return () => {
      cancelAnimationFrame(frame);
      mutation.disconnect();
      resize.disconnect();
    };
  }, []);

  return (
    <span
      ref={pillRef}
      aria-hidden
      data-slot="segmented-highlight"
      className={cn(
        "pointer-events-none absolute top-0 left-0 rounded-sm bg-toggle-active shadow-xs",
        !box && "hidden",
        animate &&
          "transition-[transform,width,height] duration-300 ease-out motion-reduce:transition-none",
        className,
      )}
      style={
        box
          ? {
              width: box.width,
              height: box.height,
              transform: `translate(${box.x}px, ${box.y}px)`,
            }
          : undefined
      }
    />
  );
}
