import { render, screen, waitFor } from "@testing-library/react";
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
  it("shows migrated percentages with unset details", () => {
    render(<Editor initial={{ ...EMPTY_AI_ASSESSMENT, ai_score: 0.6 }} />);
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getAllByText("Not set")).toHaveLength(5);
  });

  it("saves only the changed class and preserves zero", async () => {
    const user = userEvent.setup();
    vi.mocked(updateAIAssessment).mockResolvedValue({
      status: 200,
      data: { ...result, classes: { ...result.classes, human: 0 } },
    });
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      screen.getByRole("spinbutton", { name: "AI score (0–1)" }),
    ).toHaveFocus();
    const input = screen.getByRole("spinbutton", { name: "Human (0–1)" });
    await user.clear(input);
    await user.type(input, "0");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(updateAIAssessment).toHaveBeenCalledExactlyOnceWith("app-1", {
      classes: { human: 0 },
    });
    expect(await screen.findByText("0%")).toBeInTheDocument();
    expect(screen.getByText("59.6%")).toBeInTheDocument();
    expect(screen.getByText("51.5%")).toBeInTheDocument();
  });

  it("can independently clear the score and verdict", async () => {
    const user = userEvent.setup();
    vi.mocked(updateAIAssessment).mockResolvedValue({
      status: 200,
      data: { ...result, ai_score: null, verdict: null },
    });
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(
      screen.getByRole("spinbutton", { name: "AI score (0–1)" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Verdict" }),
      "",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(updateAIAssessment).toHaveBeenCalledExactlyOnceWith("app-1", {
      ai_score: null,
      verdict: null,
    });
    expect(screen.getByText("40.4%")).toBeInTheDocument();
    expect(screen.getAllByText("Not set")).toHaveLength(2);
  });

  it("keeps the draft after a failed save", async () => {
    const user = userEvent.setup();
    vi.mocked(updateAIAssessment).mockResolvedValue({
      status: 500,
      error: "Save failed",
    });
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByRole("spinbutton", { name: "Humanized (0–1)" });
    await user.clear(input);
    await user.type(input, "0.8");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save changes" }),
      ).toBeEnabled(),
    );
    expect(input).toHaveValue(0.8);
    expect(updateAIAssessment).toHaveBeenCalledExactlyOnceWith("app-1", {
      classes: { humanized: 0.8 },
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
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Calculating/ })).toBeDisabled();
    finish({ status: 200, data: result });
    expect(await screen.findByText("59.6%")).toBeInTheDocument();
    expect(screen.getByText("40.4%")).toBeInTheDocument();
    expect(screen.getByText("51.5%")).toBeInTheDocument();
    expect(screen.getByText("1%")).toBeInTheDocument();
    expect(screen.getByText("7%")).toBeInTheDocument();
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
