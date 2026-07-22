import { useEffect, useRef } from "react";

import type { Options } from "canvas-confetti";

interface CelebrationEffectProps {
  /** Unique key for localStorage dedup — e.g. app.id */
  id: string;
  /** Which event triggered this */
  type: "submit" | "accepted";
}

const STORAGE_PREFIX = "harp-confetti";

function getStorageKey(type: string, id: string): string {
  return `${STORAGE_PREFIX}:${type}:${id}`;
}

function hasFired(type: string, id: string): boolean {
  try {
    const key = getStorageKey(type, id);
    const val = localStorage.getItem(key);
    // Initialize to "false" if the key doesn't exist yet
    if (val === null) {
      localStorage.setItem(key, "false");
      return false;
    }
    return val === "true";
  } catch {
    return false;
  }
}

function markFired(type: string, id: string): void {
  try {
    localStorage.setItem(getStorageKey(type, id), "true");
  } catch {
    // localStorage unavailable — skip persistence
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Fires a confetti burst using canvas-confetti.
 * Dynamically imported so the library is only loaded when needed.
 */
async function fireConfetti(options: Options): Promise<void> {
  const confetti = (await import("canvas-confetti")).default;
  confetti(options);
}

/**
 * Submit variant — restrained, geometric, black/charcoal, center-origin.
 */
function fireSubmitConfetti(): void {
  void fireConfetti({
    particleCount: 40,
    spread: 70,
    origin: { x: 0.5, y: 0.4 },
    startVelocity: 25,
    gravity: 0.8,
    scalar: 0.8,
    shapes: ["square"],
    colors: ["#000000", "#555555", "#D9D9D9"],
  });
}

/**
 * Accepted variant — full burst, black/white/gold, multi-angle.
 */
async function fireAcceptedConfetti(): Promise<void> {
  const confettiModule = await import("canvas-confetti");
  const confetti = confettiModule.default;

  // First burst — center, diverse shapes
  confetti({
    particleCount: 50,
    spread: 100,
    origin: { x: 0.5, y: 0.35 },
    startVelocity: 35,
    gravity: 0.7,
    scalar: 1,
    shapes: ["square", "circle"],
    colors: ["#000000", "#FFFFFF", "#D4AF37"],
  });

  // Second burst — slight delay, from the left
  setTimeout(() => {
    confetti({
      particleCount: 30,
      spread: 80,
      angle: 70,
      origin: { x: 0.2, y: 0.3 },
      startVelocity: 30,
      gravity: 0.6,
      scalar: 0.9,
      shapes: ["square"],
      colors: ["#000000", "#D4AF37", "#FFFFFF"],
    });
  }, 150);

  // Third burst — from the right
  setTimeout(() => {
    confetti({
      particleCount: 30,
      spread: 80,
      angle: 110,
      origin: { x: 0.8, y: 0.3 },
      startVelocity: 30,
      gravity: 0.6,
      scalar: 0.9,
      shapes: ["square"],
      colors: ["#000000", "#D4AF37", "#FFFFFF"],
    });
  }, 300);

  // Fourth burst — big finale at center-top
  setTimeout(() => {
    confetti({
      particleCount: 60,
      spread: 120,
      origin: { x: 0.5, y: 0.2 },
      startVelocity: 40,
      gravity: 0.5,
      scalar: 1.1,
      shapes: ["square", "circle"],
      colors: ["#000000", "#FFFFFF", "#D4AF37", "#555555"],
    });
  }, 500);
}

/**
 * Reduced-motion fallback: renders a bold static badge for 1.5s.
 * For submit: a checkmark stating "Submitted".
 * For accepted: "Accepted" with a stronger visual flash.
 */
function ReducedMotionCelebration({ type }: { type: "submit" | "accepted" }) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const timer = setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "scale(0.8)";
    }, 1500);
    const removeTimer = setTimeout(() => {
      el?.remove();
    }, 2000);
    return () => {
      clearTimeout(timer);
      clearTimeout(removeTimer);
    };
  }, []);

  const isAccepted = type === "accepted";

  return (
    <div
      ref={elRef}
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center transition-all duration-500"
      style={{ animation: "celebration-fade-in 0.3s ease-out" }}
    >
      <div
        className={`flex items-center gap-3 rounded-full px-6 py-3 text-base font-semibold tracking-wider uppercase shadow-2xl ${
          isAccepted
            ? "bg-black text-white"
            : "border-2 border-black bg-white text-black"
        }`}
      >
        {isAccepted ? "✓ Accepted" : "✓ Submitted"}
      </div>
      <style>{`
        @keyframes celebration-fade-in {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export function CelebrationEffect({ id, type }: CelebrationEffectProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (hasFired(type, id)) return;

    fired.current = true;
    markFired(type, id);

    if (prefersReducedMotion()) {
      // The reduced-motion fallback renders through the component's return
      return;
    }

    if (type === "submit") {
      fireSubmitConfetti();
    } else {
      void fireAcceptedConfetti();
    }
  }, [type, id]);

  // For reduced motion, render the static fallback
  if (typeof window !== "undefined" && prefersReducedMotion()) {
    return <ReducedMotionCelebration type={type} />;
  }

  return null;
}