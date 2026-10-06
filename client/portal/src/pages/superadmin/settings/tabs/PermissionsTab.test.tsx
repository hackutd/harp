import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PermissionsTab from "./PermissionsTab";

const api = vi.hoisted(() => ({
  getRequest: vi.fn(),
  postRequest: vi.fn(),
  putRequest: vi.fn(),
  errorAlert: vi.fn(),
}));
vi.mock("@/shared/lib/api", () => api);

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const TRAVEL_ENDPOINT = "/superadmin/settings/travel-applications-enabled";

/** Every permission loads as enabled except travel, which loads as given. */
function loadSettings(travelEnabled: boolean) {
  api.getRequest.mockImplementation(async (endpoint: string) => ({
    status: 200,
    data: { enabled: endpoint === TRAVEL_ENDPOINT ? travelEnabled : true },
  }));
}

async function findTravelSwitch() {
  const toggle = await screen.findByRole("switch", {
    name: "Travel Reimbursement Requests",
  });
  // Switches stay disabled until every setting has loaded.
  await vi.waitFor(() => expect(toggle).toBeEnabled());
  return toggle;
}

describe("PermissionsTab travel reimbursement toggle", () => {
  beforeEach(() => {
    loadSettings(true);
  });

  it("shows the saved closed state", async () => {
    loadSettings(false);
    render(<PermissionsTab />);

    expect(await findTravelSwitch()).not.toBeChecked();
  });

  it("closes travel reimbursement requests", async () => {
    const user = userEvent.setup();
    api.putRequest.mockResolvedValue({ status: 200, data: { enabled: false } });
    render(<PermissionsTab />);

    const toggle = await findTravelSwitch();
    expect(toggle).toBeChecked();
    await user.click(toggle);

    expect(api.putRequest).toHaveBeenCalledWith(
      TRAVEL_ENDPOINT,
      { enabled: false },
      "travel applications enabled",
    );
    await vi.waitFor(() => expect(toggle).not.toBeChecked());
    expect(toast.success).toHaveBeenCalledWith(
      "Travel reimbursement questions are now hidden from applicants.",
    );
  });

  it("keeps the switch on and alerts when the save fails", async () => {
    const user = userEvent.setup();
    const failure = { status: 500, error: "boom" };
    api.putRequest.mockResolvedValue(failure);
    render(<PermissionsTab />);

    const toggle = await findTravelSwitch();
    await user.click(toggle);

    await vi.waitFor(() =>
      expect(api.errorAlert).toHaveBeenCalledWith(failure),
    );
    expect(toggle).toBeChecked();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
