import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useApplicationTimeline } from "./useApplicationTimeline";

const api = vi.hoisted(() => ({
  fetchApplicationTimeline: vi.fn(),
}));

vi.mock("../api", () => api);

describe("useApplicationTimeline", () => {
  it("fetches once in the browser's zone and exposes the points", async () => {
    const timeline = [{ date: "2026-09-01", started: 4, submitted: 3 }];
    api.fetchApplicationTimeline.mockResolvedValue({
      status: 200,
      data: { time_zone: "America/Chicago", timeline },
    });

    const { result } = renderHook(() => useApplicationTimeline());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.points).toEqual(timeline);
    expect(result.current.timeZone).toBe("America/Chicago");
    expect(result.current.error).toBeNull();
    expect(api.fetchApplicationTimeline).toHaveBeenCalledTimes(1);
    expect(api.fetchApplicationTimeline).toHaveBeenCalledWith(
      "America/Chicago",
      expect.any(AbortSignal),
    );
  });

  it("reports an error and no points on failure", async () => {
    api.fetchApplicationTimeline.mockResolvedValue({
      status: 500,
      error: "boom",
    });

    const { result } = renderHook(() => useApplicationTimeline());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.points).toEqual([]);
    expect(result.current.error).toBe("boom");
  });

  it("aborts the request on unmount", () => {
    api.fetchApplicationTimeline.mockReturnValue(new Promise(() => {}));

    const { unmount } = renderHook(() => useApplicationTimeline());
    const signal = api.fetchApplicationTimeline.mock.calls[0][1] as AbortSignal;
    expect(signal.aborted).toBe(false);

    unmount();
    expect(signal.aborted).toBe(true);
  });
});
