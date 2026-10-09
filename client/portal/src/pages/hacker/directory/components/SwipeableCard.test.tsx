import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SWIPE_THRESHOLD, SwipeableCard } from "./SwipeableCard";

function setup(disabled = false) {
  const onSwipeRight = vi.fn();
  const onSwipeLeft = vi.fn();
  const { container } = render(
    <SwipeableCard
      onSwipeRight={onSwipeRight}
      onSwipeLeft={onSwipeLeft}
      disabled={disabled}
    >
      <p>card</p>
    </SwipeableCard>,
  );
  const target = within(container).getByText("card");
  const swipe = (dx: number, dy = 0, pointerType = "touch") => {
    fireEvent.pointerDown(target, {
      pointerId: 1,
      pointerType,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(target, {
      pointerId: 1,
      pointerType,
      clientX: 100 + dx / 2,
      clientY: 100 + dy / 2,
    });
    fireEvent.pointerMove(target, {
      pointerId: 1,
      pointerType,
      clientX: 100 + dx,
      clientY: 100 + dy,
    });
    fireEvent.pointerUp(target, { pointerId: 1, pointerType });
  };
  return { onSwipeRight, onSwipeLeft, swipe };
}

describe("SwipeableCard", () => {
  it("swipe right pokes", () => {
    const { onSwipeRight, onSwipeLeft, swipe } = setup();
    swipe(SWIPE_THRESHOLD + 20);
    expect(onSwipeRight).toHaveBeenCalledOnce();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("swipe left hides", () => {
    const { onSwipeRight, onSwipeLeft, swipe } = setup();
    swipe(-(SWIPE_THRESHOLD + 20));
    expect(onSwipeLeft).toHaveBeenCalledOnce();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it("ignores short drags, vertical scrolls, mice, and disabled cards", () => {
    const short = setup();
    short.swipe(SWIPE_THRESHOLD - 10);
    short.swipe(10, 300);
    short.swipe(SWIPE_THRESHOLD + 50, 0, "mouse");
    expect(short.onSwipeRight).not.toHaveBeenCalled();

    const disabled = setup(true);
    disabled.swipe(SWIPE_THRESHOLD + 50);
    expect(disabled.onSwipeRight).not.toHaveBeenCalled();
  });
});
