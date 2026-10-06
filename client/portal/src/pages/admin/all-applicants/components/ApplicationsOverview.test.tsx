import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicationStats, ApplicationTimelinePoint } from "../types";
import { ApplicationsOverview } from "./ApplicationsOverview";

const stats: ApplicationStats = {
  total_applications: 240,
  submitted: 90,
  accepted: 60,
  rejected: 20,
  waitlisted: 10,
  draft: 60,
  acceptance_rate: 33.333,
  rsvp_pending: 0,
  rsvp_confirmed: 0,
  rsvp_declined: 0,
  checked_in: 0,
  no_shows: 0,
};

const points: ApplicationTimelinePoint[] = [
  { date: "2026-07-20", started: 100, submitted: 40 },
  { date: "2026-08-15", started: 20, submitted: 10 },
  { date: "2026-09-01", started: 3, submitted: 2 },
];

function renderOverview(
  props: Partial<Parameters<typeof ApplicationsOverview>[0]> = {},
) {
  return render(
    <ApplicationsOverview
      stats={stats}
      statsLoading={false}
      points={points}
      timeZone="America/Chicago"
      loading={false}
      error={null}
      {...props}
    />,
  );
}

describe("ApplicationsOverview", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-02T17:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("shows the headline stats in the header", () => {
    renderOverview();

    expect(screen.getByText("240")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("33.3%")).toBeInTheDocument();
  });

  it("defaults to the last 30 days", () => {
    renderOverview();

    expect(
      screen.getByRole("combobox", { name: "Select a time range" }),
    ).toHaveTextContent("Last 30 days");
  });

  it("shows an empty state before anyone applies", () => {
    renderOverview({ points: [] });

    expect(screen.getByText("No applications yet")).toBeInTheDocument();
  });

  it("shows the timeline error in place of the chart", () => {
    renderOverview({ points: [], error: "Unable to load" });

    expect(screen.getByText("Unable to load")).toBeInTheDocument();
  });

  it("hides the empty state while loading", () => {
    renderOverview({ points: [], loading: true });

    expect(screen.queryByText("No applications yet")).not.toBeInTheDocument();
  });
});
