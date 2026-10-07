import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DirectoryTagsTab from "./DirectoryTagsTab";

const api = vi.hoisted(() => ({
  getRequest: vi.fn(),
  postRequest: vi.fn(),
  putRequest: vi.fn(),
  errorAlert: vi.fn(),
}));
vi.mock("@/shared/lib/api", () => api);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const ENDPOINT = "/superadmin/settings/directory-interest-tags";

describe("DirectoryTagsTab", () => {
  beforeEach(() => {
    api.getRequest.mockResolvedValue({
      status: 200,
      data: { tags: ["AI/ML", "Design"] },
    });
  });

  it("saves edited tags trimmed", async () => {
    api.putRequest.mockResolvedValue({
      status: 200,
      data: { tags: ["AI/ML", "Robotics"] },
    });
    const user = userEvent.setup();
    render(<DirectoryTagsTab />);

    const second = await screen.findByDisplayValue("Design");
    await user.clear(second);
    await user.type(second, " Robotics ");
    await user.click(screen.getByRole("button", { name: "Save Tags" }));

    expect(api.putRequest).toHaveBeenCalledWith(
      ENDPOINT,
      { tags: ["AI/ML", "Robotics"] },
      "directory interest tags",
    );
    expect(toast.success).toHaveBeenCalledWith("Interest tags saved.");
  });

  it("blocks saving a duplicate tag", async () => {
    const user = userEvent.setup();
    render(<DirectoryTagsTab />);

    const second = await screen.findByDisplayValue("Design");
    await user.clear(second);
    await user.type(second, "AI/ML");

    expect(screen.getByText("Duplicate tag: AI/ML")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Tags" })).toBeDisabled();
    expect(api.putRequest).not.toHaveBeenCalled();
  });

  it("removes a tag", async () => {
    api.putRequest.mockResolvedValue({
      status: 200,
      data: { tags: ["Design"] },
    });
    const user = userEvent.setup();
    render(<DirectoryTagsTab />);

    await screen.findByDisplayValue("AI/ML");
    await user.click(screen.getByRole("button", { name: "Remove tag 1" }));
    await user.click(screen.getByRole("button", { name: "Save Tags" }));

    expect(api.putRequest).toHaveBeenCalledWith(
      ENDPOINT,
      { tags: ["Design"] },
      "directory interest tags",
    );
  });
});
