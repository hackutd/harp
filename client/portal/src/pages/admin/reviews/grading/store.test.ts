import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Review, ReviewNote } from "../types";
import { useAdminGradingStore } from "./store";

const reviewApi = vi.hoisted(() => ({
  fetchPendingReviews: vi.fn(),
  fetchReviewNotes: vi.fn(),
  submitReviewVote: vi.fn(),
}));

const adminApi = vi.hoisted(() => ({
  fetchApplicationById: vi.fn(),
}));

vi.mock("../api", () => ({
  fetchPendingReviews: reviewApi.fetchPendingReviews,
  fetchReviewNotes: reviewApi.fetchReviewNotes,
  submitReviewVote: reviewApi.submitReviewVote,
}));

vi.mock("@/pages/admin/all-applicants/api", () => ({
  fetchApplicationById: adminApi.fetchApplicationById,
  fetchApplications: vi.fn(),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function makeReview(id: string): Review {
  return {
    id,
    admin_id: "a1",
    application_id: "app-" + id,
    vote: null,
    notes: null,
    assigned_at: "2026-03-14T15:00:00Z",
    reviewed_at: null,
    created_at: "2026-03-14T15:00:00Z",
    updated_at: "2026-03-14T15:00:00Z",
    first_name: "Ada",
    last_name: "L",
    email: "ada@example.com",
    age: 20,
    university: "UTD",
    major: "CS",
    country_of_residence: "US",
    hackathons_attended: 0,
  };
}

beforeEach(() => {
  useAdminGradingStore.getState().reset();
  vi.clearAllMocks();
});

describe("admin grading store: failed vote preserves review and clears submitting", () => {
  it("keeps the review under evaluation and clears submitting on a failed vote", async () => {
    reviewApi.fetchPendingReviews.mockResolvedValue({
      status: 200,
      data: { reviews: [makeReview("r1")] },
    });
    await useAdminGradingStore.getState().fetchReviews();

    useAdminGradingStore.setState({ localNotes: "keep me" });
    reviewApi.submitReviewVote.mockResolvedValue({
      success: false,
      error: "nope",
    });

    await useAdminGradingStore.getState().submitVote("r1", "reject");

    const s = useAdminGradingStore.getState();
    expect(s.submitting).toBe(false);
    expect(s.reviews.map((r) => r.id)).toEqual(["r1"]); // preserved
    expect(s.localNotes).toBe("keep me"); // not cleared
    expect(toast.error).toHaveBeenCalledWith("nope");
  });

  it("removes the review and clears notes when the vote succeeds", async () => {
    reviewApi.fetchPendingReviews.mockResolvedValue({
      status: 200,
      data: { reviews: [makeReview("r1")] },
    });
    await useAdminGradingStore.getState().fetchReviews();

    useAdminGradingStore.setState({ localNotes: "submit" });
    const detailRes = { status: 200, data: undefined };
    adminApi.fetchApplicationById.mockResolvedValue(detailRes);
    reviewApi.fetchReviewNotes.mockResolvedValue({
      status: 200,
      data: { notes: [] as ReviewNote[] },
    });
    reviewApi.submitReviewVote.mockResolvedValue({ success: true });

    await useAdminGradingStore.getState().submitVote("r1", "waitlist");

    const s = useAdminGradingStore.getState();
    expect(s.submitting).toBe(false);
    expect(s.reviews).toEqual([]);
    expect(s.localNotes).toBe("");
    expect(toast.success).toHaveBeenCalledWith("Vote submitted: waitlist");
  });
});
