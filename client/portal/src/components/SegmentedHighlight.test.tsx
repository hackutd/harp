import { render, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SegmentedHighlight } from "./SegmentedHighlight";

// jsdom has no layout, so give each item a fixed box by its label.
const BOXES: Record<string, { left: number; width: number }> = {
  A: { left: 2, width: 40 },
  B: { left: 42, width: 60 },
};
const PROPS = ["offsetLeft", "offsetTop", "offsetWidth", "offsetHeight"];
const originals = PROPS.map((prop) =>
  Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop),
);

beforeAll(() => {
  const box = (el: HTMLElement) => BOXES[el.textContent ?? ""];
  Object.defineProperties(HTMLElement.prototype, {
    offsetLeft: {
      configurable: true,
      get(this: HTMLElement) {
        return box(this)?.left ?? 0;
      },
    },
    offsetTop: { configurable: true, get: () => 2 },
    offsetWidth: {
      configurable: true,
      get(this: HTMLElement) {
        return box(this)?.width ?? 0;
      },
    },
    offsetHeight: { configurable: true, get: () => 30 },
  });
});

afterAll(() => {
  PROPS.forEach((prop, i) => {
    const original = originals[i];
    if (original) Object.defineProperty(HTMLElement.prototype, prop, original);
  });
});

function Segmented({ active }: { active: "A" | "B" | null }) {
  return (
    <div>
      <SegmentedHighlight />
      {(["A", "B"] as const).map((label) => (
        <button
          key={label}
          data-state={active === label ? "active" : "inactive"}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function pill(container: HTMLElement) {
  return container.querySelector<HTMLElement>(
    '[data-slot="segmented-highlight"]',
  );
}

describe("SegmentedHighlight", () => {
  it("sits under the active item", () => {
    const { container } = render(<Segmented active="A" />);
    expect(pill(container)?.style.transform).toBe("translate(2px, 2px)");
    expect(pill(container)?.style.width).toBe("40px");
  });

  it("slides to the newly selected item", async () => {
    const { container, rerender } = render(<Segmented active="A" />);
    rerender(<Segmented active="B" />);
    await waitFor(() =>
      expect(pill(container)?.style.transform).toBe("translate(42px, 2px)"),
    );
    expect(pill(container)?.style.width).toBe("60px");
  });

  it("hides without a selection", () => {
    const { container } = render(<Segmented active={null} />);
    expect(pill(container)).toHaveClass("hidden");
  });
});
