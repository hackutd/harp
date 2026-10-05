import { beforeEach, describe, expect, it, vi } from "vitest";

import { useReviewsStore } from "./store";
import type { Review, ReviewerStats } from "./types";

const reviewsApi = vi.hoisted(() => ({
  claimMoreReviews: vi.fn(),
  fetchCompletedReviews: vi.fn(),
  fetchPendingReviews: vi.fn(),
  fetchReviewLeaderboard: vi.fn(),
  submitReviewVote: vi.fn(),
}));

vi.mock("./api", () => ({
  claimMoreReviews: reviewsApi.claimMoreReviews,
  fetchCompletedReviews: reviewsApi.fetchCompletedReviews,
  fetchPendingReviews: reviewsApi.fetchPendingReviews,
  fetchReviewLeaderboard: reviewsApi.fetchReviewLeaderboard,
  submitReviewVote: reviewsApi.submitReviewVote,
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
    hackathons_attended: 2,
    travel_status: "not_requested",
    ...overrides,
  };
}

function reviewResponse(reviews: Review[]) {
  return { status: 200, data: { reviews } };
}

beforeEach(() => {
  useReviewsStore.setState(useReviewsStore.getInitialState(), true);
});

describe("tab selection", () => {
  it("defaults to the assigned tab and switches on setTab", () => {
    expect(useReviewsStore.getState().tab).toBe("assigned");
    useReviewsStore.getState().setTab("completed");
    expect(useReviewsStore.getState().tab).toBe("completed");
    useReviewsStore.getState().setTab("assigned");
    expect(useReviewsStore.getState().tab).toBe("assigned");
  });
});

describe("fetchReviews fetches per tab", () => {
  it("calls fetchPendingReviews when on the assigned tab", async () => {
    reviewsApi.fetchPendingReviews.mockResolvedValue(
      reviewResponse([makeReview("r1")]),
    );
    reviewsApi.fetchCompletedReviews.mockResolvedValue(reviewResponse([]));

    const store = useReviewsStore.getState();
    store.setTab("assigned");
    await useReviewsStore.getState().fetchReviews();

    expect(reviewsApi.fetchPendingReviews).toHaveBeenCalledTimes(1);
    expect(reviewsApi.fetchCompletedReviews).not.toHaveBeenCalled();
    expect(useReviewsStore.getState().reviews.map((r) => r.id)).toEqual(["r1"]);
  });

  it("fetches completed reviews when on the completed tab", async () => {
    reviewsApi.fetchPendingReviews.mockResolvedValue(reviewResponse([]));
    reviewsApi.fetchCompletedReviews.mockResolvedValue(
      reviewResponse([makeReview("r2")]),
    );

    useReviewsStore.getState().setTab("completed");
    await useReviewsStore.getState().fetchReviews();

    expect(reviewsApi.fetchCompletedReviews).toHaveBeenCalledTimes(1);
    expect(reviewsApi.fetchPendingReviews).not.toHaveBeenCalled();
    expect(useReviewsStore.getState().reviews.map((r) => r.id)).toEqual(["r2"]);
  });

  it("toggles loading during the fetch and clears on completion", async () => {
    let resolveFetch: () => void;
    reviewsApi.fetchPendingReviews.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = () => resolve(reviewResponse([makeReview("r9")]));
      }),
    );

    const p = useReviewsStore.getState().fetchReviews();
    expect(useReviewsStore.getState().loading).toBe(true);
    resolveFetch!();
    await p;
    expect(useReviewsStore.getState().loading).toBe(false);
  });
});

describe("submitVote", () => {
  it("removes a successfully voted review from the pending list", async () => {
    const keep = makeReview("keep");
    const voted = makeReview("drop");
    useReviewsStore.setState({ reviews: [keep, voted], tab: "assigned" });

    reviewsApi.submitReviewVote.mockResolvedValue({ success: true });

    const result = await useReviewsStore
      .getState()
      .submitVote("drop", { vote: "accept" });

    expect(result).toEqual({ success: true });
    expect(useReviewsStore.getState().reviews.map((r) => r.id)).toEqual([
      "keep",
    ]);
    expect(useReviewsStore.getState().submitting).toBe(false);
  });

  it("keeps the review and reports failure when the vote fails", async () => {
    useReviewsStore.setState({
      reviews: [makeReview("stay")],
      tab: "assigned",
    });

    reviewsApi.submitReviewVote.mockResolvedValue({
      success: false,
      error: "nope",
    });

    const result = await useReviewsStore
      .getState()
      .submitVote("stay", { vote: "reject" });

    expect(result).toEqual({ success: false, error: "nope" });
    expect(useReviewsStore.getState().reviews.map((r) => r.id)).toEqual([
      "stay",
    ]);
    expect(useReviewsStore.getState().submitting).toBe(false);
  });
});

describe("fetchReviews error and staleness handling", () => {
  it("clears the list and surfaces the error on a failed fetch", async () => {
    useReviewsStore.setState({ reviews: [makeReview("old")] });
    reviewsApi.fetchPendingReviews.mockResolvedValue({
      status: 500,
      error: "boom",
    });

    await useReviewsStore.getState().fetchReviews();

    const s = useReviewsStore.getState();
    expect(s.reviews).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.error).toBe("boom");
  });

  it("drops a response that lands after the tab changed", async () => {
    let resolvePending!: (v: unknown) => void;
    reviewsApi.fetchPendingReviews.mockReturnValue(
      new Promise((resolve) => (resolvePending = resolve)),
    );

    const inFlight = useReviewsStore.getState().fetchReviews();
    useReviewsStore.getState().setTab("completed");
    resolvePending(reviewResponse([makeReview("stale")]));
    await inFlight;

    const s = useReviewsStore.getState();
    expect(s.tab).toBe("completed");
    expect(s.reviews).toEqual([]);
    expect(s.loading).toBe(false);
  });

  it("loads the leaderboard on the leaderboard tab", async () => {
    const reviewer = { admin_id: "a1", rank: 1 } as ReviewerStats;
    reviewsApi.fetchReviewLeaderboard.mockResolvedValue({
      status: 200,
      data: { reviewers: [reviewer] },
    });

    useReviewsStore.getState().setTab("leaderboard");
    await useReviewsStore.getState().fetchReviews();

    expect(reviewsApi.fetchPendingReviews).not.toHaveBeenCalled();
    expect(useReviewsStore.getState().leaderboard).toEqual([reviewer]);
    expect(useReviewsStore.getState().loading).toBe(false);
  });
});

describe("updateVote", () => {
  it("keeps the review and merges the returned row", async () => {
    useReviewsStore.setState({
      tab: "completed",
      reviews: [makeReview("r1", { vote: "accept", notes: "old" })],
    });
    reviewsApi.submitReviewVote.mockResolvedValue({
      success: true,
      status: 200,
      review: { id: "r1", vote: "reject", notes: "changed my mind" },
    });

    const result = await useReviewsStore
      .getState()
      .updateVote("r1", { vote: "reject" });

    expect(result).toEqual({ success: true, error: undefined });
    const [review] = useReviewsStore.getState().reviews;
    expect(review.vote).toBe("reject");
    expect(review.notes).toBe("changed my mind");
    expect(review.first_name).toBe("Ada"); // applicant details survive
    expect(useReviewsStore.getState().submitting).toBe(false);
  });

  it("leaves the review untouched when the update fails", async () => {
    useReviewsStore.setState({
      tab: "completed",
      reviews: [makeReview("r1", { vote: "accept" })],
    });
    reviewsApi.submitReviewVote.mockResolvedValue({
      success: false,
      status: 500,
      error: "nope",
    });

    const result = await useReviewsStore
      .getState()
      .updateVote("r1", { vote: "reject" });

    expect(result).toEqual({ success: false, error: "nope" });
    expect(useReviewsStore.getState().reviews[0].vote).toBe("accept");
    expect(useReviewsStore.getState().submitting).toBe(false);
  });
});

describe("claimMore", () => {
  it("replaces the assigned queue and reports how many were claimed", async () => {
    reviewsApi.claimMoreReviews.mockResolvedValue({
      success: true,
      claimed: 2,
      reviews: [makeReview("c1"), makeReview("c2")],
    });

    await useReviewsStore.getState().claimMore();

    const s = useReviewsStore.getState();
    expect(s.reviews.map((r) => r.id)).toEqual(["c1", "c2"]);
    expect(s.claiming).toBe(false);
    expect(toast.success).toHaveBeenCalledWith("Picked up 2 reviews");
  });

  it("keeps a claimed queue from being overwritten by an older fetch", async () => {
    let resolvePending!: (v: unknown) => void;
    reviewsApi.fetchPendingReviews.mockReturnValue(
      new Promise((resolve) => (resolvePending = resolve)),
    );
    reviewsApi.claimMoreReviews.mockResolvedValue({
      success: true,
      claimed: 1,
      reviews: [makeReview("fresh")],
    });

    const inFlight = useReviewsStore.getState().fetchReviews();
    await useReviewsStore.getState().claimMore();
    resolvePending(reviewResponse([makeReview("stale")]));
    await inFlight;

    expect(useReviewsStore.getState().reviews.map((r) => r.id)).toEqual([
      "fresh",
    ]);
  });

  it("tells the admin when nothing was available", async () => {
    reviewsApi.claimMoreReviews.mockResolvedValue({
      success: true,
      claimed: 0,
      reviews: [],
    });

    await useReviewsStore.getState().claimMore();

    expect(toast.info).toHaveBeenCalled();
  });

  it("does nothing outside the assigned tab", async () => {
    useReviewsStore.getState().setTab("completed");
    await useReviewsStore.getState().claimMore();
    expect(reviewsApi.claimMoreReviews).not.toHaveBeenCalled();
  });

  it("toasts the error and keeps the queue on failure", async () => {
    useReviewsStore.setState({ reviews: [makeReview("keep")] });
    reviewsApi.claimMoreReviews.mockResolvedValue({
      success: false,
      claimed: 0,
      reviews: [],
      error: "limit reached",
    });

    await useReviewsStore.getState().claimMore();

    expect(toast.error).toHaveBeenCalledWith("limit reached");
    expect(useReviewsStore.getState().reviews.map((r) => r.id)).toEqual([
      "keep",
    ]);
    expect(useReviewsStore.getState().claiming).toBe(false);
  });
});
