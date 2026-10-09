import { type ReactNode, useLayoutEffect, useRef } from "react";

/** Align each card's sky to one shared image spanning the whole stack. */
export function SkyCardStack({ children }: { children: ReactNode }) {
  const stackRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;

    const alignBackgrounds = () => {
      const stackBounds = stack.getBoundingClientRect();
      const cards = Array.from(
        stack.querySelectorAll<HTMLElement>(".hacker-application-card"),
        (card) => ({ card, top: card.getBoundingClientRect().top }),
      );

      stack.style.setProperty("--sky-stack-height", `${stackBounds.height}px`);
      for (const { card, top } of cards) {
        card.style.setProperty(
          "--sky-card-offset",
          `${stackBounds.top - top}px`,
        );
      }
    };

    alignBackgrounds();
    // Includes text wrapping and font loading.
    const observer = new ResizeObserver(alignBackgrounds);
    observer.observe(stack);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div ref={stackRef} className="flow-root">
      {children}
    </div>
  );
}
