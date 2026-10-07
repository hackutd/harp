import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_AI_ASSESSMENT } from "@/shared/lib/ai-assessment";
import type { AIAssessment } from "@/types";

import { calculateAIAssessment, updateAIAssessment } from "../api";
import { AIAssessmentField } from "./AIAssessmentField";

vi.mock("../api", () => ({
  calculateAIAssessment: vi.fn(),
  updateAIAssessment: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const result: AIAssessment = {
  ai_score: 0.5956428647041321,
  verdict: "ai",
  classes: {
    human: 0.4043571352958679,
    ai: 0.5150407552719116,
    ai_edited: 0.010439506731927395,
    humanized: 0.07016260176897049,
  },
};

async function openBreakdown(user: ReturnType<typeof userEvent.setup>) {
  await user.hover(screen.getByRole("button", { name: /^AI score/ }));
  return within(await screen.findByRole("tooltip"));
}

function Editor({ initial = result }: { initial?: AIAssessment }) {
  const [assessment, setAssessment] = useState(initial);
  return (
    <AIAssessmentField
      applicationId="app-1"
      assessment={assessment}
      onUpdate={setAssessment}
    />
  );
}

describe("AI assessment editor", () => {
  it("shows only the score until the breakdown is hovered", async () => {
    const user = userEvent.setup();
    render(<Editor initial={{ ...EMPTY_AI_ASSESSMENT, ai_score: 0.6 }} />);
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.queryByText("Not set")).not.toBeInTheDocument();
    const breakdown = await openBreakdown(user);
    expect(breakdown.getAllByText("Not set")).toHaveLength(5);
  });

  it("edits only the AI percent and saves it as a 0–1 score", async () => {
    const user = userEvent.setup();
    vi.mocked(updateAIAssessment).mockResolvedValue({
      status: 200,
      data: { ...result, ai_score: 0 },
    });
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "Edit AI score" }));
    const input = screen.getByRole("spinbutton", { name: "AI score" });
    expect(input).toHaveFocus();
    expect(input).toHaveValue(59.6);
    expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "0");
    await user.click(screen.getByRole("button", { name: "Save AI score" }));
    expect(updateAIAssessment).toHaveBeenCalledExactlyOnceWith("app-1", {
      ai_score: 0,
    });
    expect(await screen.findByText("0%")).toBeInTheDocument();
  });

  it("can clear the AI percent", async () => {
    const user = userEvent.setup();
    vi.mocked(updateAIAssessment).mockResolvedValue({
      status: 200,
      data: { ...result, ai_score: null },
    });
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "Edit AI score" }));
    await user.clear(screen.getByRole("spinbutton", { name: "AI score" }));
    await user.click(screen.getByRole("button", { name: "Save AI score" }));
    expect(updateAIAssessment).toHaveBeenCalledExactlyOnceWith("app-1", {
      ai_score: null,
    });
    expect(await screen.findByText("Not set")).toBeInTheDocument();
  });

  it("closes without saving when the percent is unchanged", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "Edit AI score" }));
    await user.click(screen.getByRole("button", { name: "Save AI score" }));
    expect(updateAIAssessment).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Edit AI score" }),
    ).toBeInTheDocument();
  });

  it("cancels editing with Escape", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "Edit AI score" }));
    await user.type(screen.getByRole("spinbutton", { name: "AI score" }), "1");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getByText("59.6%")).toBeInTheDocument();
    expect(updateAIAssessment).not.toHaveBeenCalled();
  });

  it("keeps the draft after a failed save", async () => {
    const user = userEvent.setup();
    vi.mocked(updateAIAssessment).mockResolvedValue({
      status: 500,
      error: "Save failed",
    });
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "Edit AI score" }));
    const input = screen.getByRole("spinbutton", { name: "AI score" });
    await user.clear(input);
    await user.type(input, "80");
    await user.click(screen.getByRole("button", { name: "Save AI score" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save AI score" }),
      ).toBeEnabled(),
    );
    expect(input).toHaveValue(80);
    expect(updateAIAssessment).toHaveBeenCalledExactlyOnceWith("app-1", {
      ai_score: 0.8,
    });
  });

  it("calculates once and displays the complete saved response", async () => {
    const user = userEvent.setup();
    let finish!: (
      value: Awaited<ReturnType<typeof calculateAIAssessment>>,
    ) => void;
    vi.mocked(calculateAIAssessment).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<Editor initial={EMPTY_AI_ASSESSMENT} />);
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    expect(
      screen.getByRole("button", { name: "Edit AI score" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /Calculating/ })).toBeDisabled();
    finish({ status: 200, data: result });
    expect(await screen.findByText("59.6%")).toBeInTheDocument();
    const breakdown = await openBreakdown(user);
    expect(breakdown.getByText("40.4%")).toBeInTheDocument();
    expect(breakdown.getByText("51.5%")).toBeInTheDocument();
    expect(breakdown.getByText("1%")).toBeInTheDocument();
    expect(breakdown.getByText("7%")).toBeInTheDocument();
    expect(calculateAIAssessment).toHaveBeenCalledExactlyOnceWith("app-1");
    expect(updateAIAssessment).not.toHaveBeenCalled();
  });

  it("preserves existing values when calculation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(calculateAIAssessment).mockResolvedValue({
      status: 502,
      error: "Detector unavailable",
    });
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    expect(screen.getByText("59.6%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calculate" })).toBeEnabled();
    expect(updateAIAssessment).not.toHaveBeenCalled();
  });
});
