import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Review, ReviewNote } from "../types";
import { hasUnsavedChanges, useAdminGradingStore } from "./store";

const reviewApi = vi.hoisted(() => ({
  claimMoreReviews: vi.fn(),
  fetchCompletedReviews: vi.fn(),
  fetchPendingReviews: vi.fn(),
  fetchReviewNotes: vi.fn(),
  submitReviewVote: vi.fn(),
}));

const adminApi = vi.hoisted(() => ({
  fetchApplicationById: vi.fn(),
}));

vi.mock("../api", () => ({
  claimMoreReviews: reviewApi.claimMoreReviews,
  fetchCompletedReviews: reviewApi.fetchCompletedReviews,
  fetchPendingReviews: reviewApi.fetchPendingReviews,
  fetchReviewNotes: reviewApi.fetchReviewNotes,
  submitReviewVote: reviewApi.submitReviewVote,
}));

vi.mock("@/pages/admin/all-applicants/api", () => ({
  fetchApplicationById: adminApi.fetchApplicationById,
  fetchApplications: vi.fn(),
}));

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

function makeReview(id: string, overrides: Partial<Review> = {}): Review {
  return {
    id,
    admin_id: "a1",
    application_id: "app-" + id,
    vote: null,
    travel_vote: null,
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
    travel_status: "not_requested",
    ...overrides,
  };
}

beforeEach(() => {
  useAdminGradingStore.setState(useAdminGradingStore.getInitialState(), true);
  adminApi.fetchApplicationById.mockResolvedValue({
    status: 200,
    data: undefined,
  });
  reviewApi.fetchReviewNotes.mockResolvedValue({
    status: 200,
    data: { notes: [] as ReviewNote[] },
  });
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
    reviewApi.submitReviewVote.mockResolvedValue({ success: true });

    await useAdminGradingStore.getState().submitVote("r1", "waitlist");

    const s = useAdminGradingStore.getState();
    expect(s.submitting).toBe(false);
    expect(s.reviews).toEqual([]);
    expect(s.localNotes).toBe("");
    expect(toast.success).toHaveBeenCalledWith("Vote submitted: waitlist");
  });
});

describe("admin grading store: changing a completed vote", () => {
  async function loadCompleted(reviews: Review[]) {
    reviewApi.fetchCompletedReviews.mockResolvedValue({
      status: 200,
      data: { reviews },
    });
    await useAdminGradingStore
      .getState()
      .fetchReviews(undefined, undefined, "completed");
  }

  it("loads completed reviews and seeds drafts from the saved vote", async () => {
    await loadCompleted([
      makeReview("r1", {
        vote: "waitlist",
        notes: "maybe",
        reviewed_at: "2026-03-15T15:00:00Z",
      }),
    ]);

    const s = useAdminGradingStore.getState();
    expect(reviewApi.fetchPendingReviews).not.toHaveBeenCalled();
    expect(s.mode).toBe("completed");
    expect(s.localVote).toBe("waitlist");
    expect(s.localNotes).toBe("maybe");
    expect(hasUnsavedChanges(s)).toBe(false);
  });

  it("blocks navigation while drafts are unsaved and discards back to the saved vote", async () => {
    await loadCompleted([
      makeReview("r1", { vote: "accept" }),
      makeReview("r2", { vote: "reject" }),
    ]);

    useAdminGradingStore.getState().setLocalVote("reject");
    expect(hasUnsavedChanges(useAdminGradingStore.getState())).toBe(true);

    useAdminGradingStore.getState().navigateNext();
    expect(useAdminGradingStore.getState().currentIndex).toBe(0);

    useAdminGradingStore.getState().discardChanges();
    expect(useAdminGradingStore.getState().localVote).toBe("accept");

    useAdminGradingStore.getState().navigateNext();
    expect(useAdminGradingStore.getState().currentIndex).toBe(1);
  });

  it("keeps the review and merges the returned row on save", async () => {
    await loadCompleted([makeReview("r1", { vote: "accept", notes: "old" })]);
    useAdminGradingStore.getState().setLocalVote("reject");
    useAdminGradingStore.getState().setLocalNotes("changed my mind");
    reviewApi.submitReviewVote.mockResolvedValue({
      success: true,
      status: 200,
      review: {
        id: "r1",
        vote: "reject",
        travel_vote: null,
        notes: "changed my mind",
      },
    });

    await useAdminGradingStore.getState().updateVote("r1");

    expect(reviewApi.submitReviewVote).toHaveBeenCalledWith("r1", {
      vote: "reject",
      travel_vote: undefined,
      notes: "changed my mind",
    });
    const s = useAdminGradingStore.getState();
    expect(s.reviews).toHaveLength(1);
    expect(s.reviews[0].vote).toBe("reject");
    expect(s.reviews[0].first_name).toBe("Ada"); // applicant details survive
    expect(s.submitting).toBe(false);
    expect(hasUnsavedChanges(s)).toBe(false);
    expect(toast.success).toHaveBeenCalledWith("Vote updated: reject");
  });

  it("keeps the drafts and saved vote when the update fails", async () => {
    await loadCompleted([makeReview("r1", { vote: "accept" })]);
    useAdminGradingStore.getState().setLocalVote("reject");
    reviewApi.submitReviewVote.mockResolvedValue({
      success: false,
      status: 500,
      error: "nope",
    });

    await useAdminGradingStore.getState().updateVote("r1");

    const s = useAdminGradingStore.getState();
    expect(s.reviews[0].vote).toBe("accept");
    expect(s.localVote).toBe("reject");
    expect(s.submitting).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("nope");
  });
});
