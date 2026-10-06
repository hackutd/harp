import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TravelRequestsSetting } from "./TravelRequestsSetting";

const api = vi.hoisted(() => ({
  fetchTravelRequestsEnabled: vi.fn(),
  setTravelRequestsEnabled: vi.fn(),
}));
vi.mock("../api", () => api);

const sharedApi = vi.hoisted(() => ({ errorAlert: vi.fn() }));
vi.mock("@/shared/lib/api", () => sharedApi);

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

async function findLoadedSwitch() {
  const toggle = await screen.findByRole("switch", {
    name: "Travel reimbursement requests",
  });
  await vi.waitFor(() => expect(toggle).toBeEnabled());
  return toggle;
}

describe("TravelRequestsSetting", () => {
  it("shows the saved state once loaded", async () => {
    api.fetchTravelRequestsEnabled.mockResolvedValue({
      status: 200,
      data: { enabled: false },
    });
    render(<TravelRequestsSetting />);

    expect(await findLoadedSwitch()).not.toBeChecked();
  });

  it("stays disabled and alerts when the state cannot be loaded", async () => {
    const failure = { status: 500, error: "boom" };
    api.fetchTravelRequestsEnabled.mockResolvedValue(failure);
    render(<TravelRequestsSetting />);

    await vi.waitFor(() =>
      expect(sharedApi.errorAlert).toHaveBeenCalledWith(failure),
    );
    expect(
      screen.getByRole("switch", { name: "Travel reimbursement requests" }),
    ).toBeDisabled();
  });

  it("closes travel reimbursement requests", async () => {
    const user = userEvent.setup();
    api.fetchTravelRequestsEnabled.mockResolvedValue({
      status: 200,
      data: { enabled: true },
    });
    api.setTravelRequestsEnabled.mockResolvedValue({
      status: 200,
      data: { enabled: false },
    });
    render(<TravelRequestsSetting />);

    const toggle = await findLoadedSwitch();
    await user.click(toggle);

    expect(api.setTravelRequestsEnabled).toHaveBeenCalledWith(false);
    await vi.waitFor(() => expect(toggle).not.toBeChecked());
    expect(toast.success).toHaveBeenCalledWith(
      "Travel reimbursement questions are now hidden from applicants.",
    );
  });

  it("keeps the switch on and alerts when the save fails", async () => {
    const user = userEvent.setup();
    const failure = { status: 500, error: "boom" };
    api.fetchTravelRequestsEnabled.mockResolvedValue({
      status: 200,
      data: { enabled: true },
    });
    api.setTravelRequestsEnabled.mockResolvedValue(failure);
    render(<TravelRequestsSetting />);

    const toggle = await findLoadedSwitch();
    await user.click(toggle);

    await vi.waitFor(() =>
      expect(sharedApi.errorAlert).toHaveBeenCalledWith(failure),
    );
    expect(toggle).toBeChecked();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
