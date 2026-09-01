import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ReviewsState, useReviewsStore } from "./store";
import type { Review } from "./types";

const reviewsApi = vi.hoisted(() => ({
  fetchPendingReviews: vi.fn(),
  fetchCompletedReviews: vi.fn(),
  submitReviewVote: vi.fn(),
}));

vi.mock("./api", () => ({
  fetchPendingReviews: reviewsApi.fetchPendingReviews,
  fetchCompletedReviews: reviewsApi.fetchCompletedReviews,
  submitReviewVote: reviewsApi.submitReviewVote,
}));

function makeReview(id: string, overrides: Partial<Review> = {}): Review {
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
    hackathons_attended: 2,
    ...overrides,
  };
}

function reviewResponse(reviews: Review[]) {
  return { status: 200, data: { reviews } };
}

beforeEach(() => {
  // Reset the singleton store to its initial state and clear API mocks.
  useReviewsStore.setState({
    tab: "assigned",
    reviews: [],
    loading: false,
    submitting: false,
  } as Pick<ReviewsState, "tab" | "reviews" | "loading" | "submitting">);
  vi.clearAllMocks();
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
    useReviewsStore.setState({
      reviews: [keep, voted],
      tab: "assigned",
    } as Pick<ReviewsState, "reviews" | "tab">);

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
