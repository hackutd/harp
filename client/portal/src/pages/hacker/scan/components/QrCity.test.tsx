import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QrCity } from "./QrCity";

const { sceneState } = vi.hoisted(() => ({
  sceneState: {
    shouldThrow: false,
    instances: [] as {
      setProgress: ReturnType<typeof vi.fn>;
      setSize: ReturnType<typeof vi.fn>;
      dispose: ReturnType<typeof vi.fn>;
    }[],
  },
}));

vi.mock("../city/QrCityScene", () => ({
  QrCityScene: class {
    setProgress = vi.fn();
    setSize = vi.fn();
    dispose = vi.fn();
    constructor() {
      if (sceneState.shouldThrow) throw new Error("no webgl");
      sceneState.instances.push(this);
    }
  },
}));

const USER_ID = "3f2d9c6e-8a1b-4c7d-9e0f-123456789abc";

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches }));
}

describe("QrCity", () => {
  beforeEach(() => {
    sceneState.shouldThrow = false;
    sceneState.instances.length = 0;
  });

  it("renders the vector QR with the quiet zone baked into the viewBox", async () => {
    stubReducedMotion(true);
    render(<QrCity value={USER_ID} />);
    const svg = screen.getByRole("img", { name: "Your QR code" });
    expect(svg).toHaveAttribute("viewBox", "0 0 37 37");
    expect(svg.querySelector("path")?.getAttribute("d")).toMatch(/^M4 4h7/);
    await waitFor(() => expect(sceneState.instances).toHaveLength(1));
  });

  it("starts on the city and toggles to the QR on tap", async () => {
    stubReducedMotion(true);
    const user = userEvent.setup();
    render(<QrCity value={USER_ID} />);

    const button = await screen.findByRole("button", {
      name: "Show my QR code",
    });
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText("Tap the city to show your QR code"),
    ).toBeInTheDocument();
    const svg = screen.getByRole("img", { name: "Your QR code" });
    expect(svg.style.opacity).toBe("0");

    await user.click(button);

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Tap to return to the city")).toBeInTheDocument();
    expect(svg.style.opacity).toBe("1");
    const scene = sceneState.instances[0];
    expect(scene.setProgress).toHaveBeenLastCalledWith(1);

    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(svg.style.opacity).toBe("0");
    expect(scene.setProgress).toHaveBeenLastCalledWith(0);
  });

  it("falls back to the plain QR when WebGL is unavailable", async () => {
    stubReducedMotion(true);
    sceneState.shouldThrow = true;
    render(<QrCity value={USER_ID} />);

    await screen.findByText("Show this at check-in, meals, and events");
    const svg = screen.getByRole("img", { name: "Your QR code" });
    expect(svg.style.opacity).toBe("1");
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("disposes the scene on unmount", async () => {
    stubReducedMotion(true);
    const { unmount } = render(<QrCity value={USER_ID} />);
    await waitFor(() => expect(sceneState.instances).toHaveLength(1));
    unmount();
    expect(sceneState.instances[0].dispose).toHaveBeenCalledTimes(1);
  });
});
