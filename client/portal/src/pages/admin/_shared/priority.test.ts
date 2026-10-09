import { beforeEach, describe, expect, it, vi } from "vitest";

import { isPriorityApplication, usePriorityDeadlineStore } from "./priority";

const api = vi.hoisted(() => ({ getRequest: vi.fn() }));
vi.mock("@/shared/lib/api", () => ({ getRequest: api.getRequest }));

const DEADLINE = new Date("2026-10-03T23:59:59.999-05:00");

beforeEach(() => {
  api.getRequest.mockReset();
  usePriorityDeadlineStore.setState(
    usePriorityDeadlineStore.getInitialState(),
    true,
  );
});

describe("isPriorityApplication", () => {
  it("counts a submission at or before the deadline", () => {
    expect(
      isPriorityApplication("2026-10-03T23:59:59.999-05:00", DEADLINE),
    ).toBe(true);
    expect(isPriorityApplication("2026-09-20T10:00:00Z", DEADLINE)).toBe(true);
  });

  it("does not count a later submission", () => {
    expect(isPriorityApplication("2026-10-04T05:00:00Z", DEADLINE)).toBe(false);
  });

  it("marks nothing without a deadline or a submission time", () => {
    expect(isPriorityApplication("2026-09-20T10:00:00Z", null)).toBe(false);
    expect(isPriorityApplication(null, DEADLINE)).toBe(false);
    expect(isPriorityApplication("garbage", DEADLINE)).toBe(false);
  });
});

describe("usePriorityDeadlineStore", () => {
  it("shares one request between concurrent callers", async () => {
    api.getRequest.mockResolvedValue({
      status: 200,
      data: { deadline: "2026-10-03T23:59:59.999-05:00" },
    });

    const { fetchDeadline } = usePriorityDeadlineStore.getState();
    await Promise.all([fetchDeadline(), fetchDeadline(), fetchDeadline()]);

    expect(api.getRequest).toHaveBeenCalledTimes(1);
    const state = usePriorityDeadlineStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.deadline?.getTime()).toBe(DEADLINE.getTime());
  });

  it("settles with no deadline when the request fails", async () => {
    api.getRequest.mockResolvedValue({ status: 500, error: "boom" });

    await usePriorityDeadlineStore.getState().fetchDeadline();

    const state = usePriorityDeadlineStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.deadline).toBeNull();
  });

  it("applies a deadline saved in settings", () => {
    usePriorityDeadlineStore.getState().setDeadline(null);
    expect(usePriorityDeadlineStore.getState().deadline).toBeNull();

    usePriorityDeadlineStore
      .getState()
      .setDeadline("2026-10-03T23:59:59.999-05:00");
    expect(usePriorityDeadlineStore.getState().deadline?.getTime()).toBe(
      DEADLINE.getTime(),
    );
  });
});
