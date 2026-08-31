import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicationListItem } from "@/pages/admin/all-applicants/types";

import { useGradingStore } from "./store";

const adminApi = vi.hoisted(() => ({
  fetchApplications: vi.fn(),
  fetchApplicationById: vi.fn(),
}));

const reviewsApi = vi.hoisted(() => ({
  fetchReviewNotes: vi.fn(),
}));

const gradingApi = vi.hoisted(() => ({
  setApplicationStatus: vi.fn(),
}));

vi.mock("@/pages/admin/all-applicants/api", () => ({
  fetchApplications: adminApi.fetchApplications,
  fetchApplicationById: adminApi.fetchApplicationById,
}));

vi.mock("@/pages/admin/reviews/api", () => ({
  fetchReviewNotes: reviewsApi.fetchReviewNotes,
}));

vi.mock("./api", () => ({
  setApplicationStatus: gradingApi.setApplicationStatus,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function app(id: string): ApplicationListItem {
  return {
    id,
    user_id: "u" + id,
    email: `${id}@example.com`,
    status: "submitted",
    first_name: "Ada",
    last_name: "L",
    phone: null,
    age: 20,
    country_of_residence: "US",
    gender: null,
    university: "UTD",
    major: "CS",
    level_of_study: null,
    hackathons_attended: 0,
    submitted_at: "2026-03-14T15:00:00Z",
    created_at: "2026-03-14T15:00:00Z",
    updated_at: "2026-03-14T15:00:00Z",
    ai_percent: null,
    accept_votes: 0,
    reject_votes: 0,
    waitlist_votes: 0,
    reviews_assigned: 0,
    reviews_completed: 0,
    has_resume: false,
    points: 0,
  };
}

function listResponse(applications: ApplicationListItem[]) {
  return {
    status: 200,
    data: {
      applications,
      next_cursor: null,
      prev_cursor: null,
      has_more: false,
    },
  };
}

beforeEach(() => {
  useGradingStore.getState().reset();
  vi.clearAllMocks();
});

describe("grading store: stale-response guarding on loadDetail", () => {
  it("ignores a stale detail response after rapid navigation", async () => {
    adminApi.fetchApplications.mockResolvedValueOnce(
      listResponse([app("1"), app("2")]),
    );
    await useGradingStore.getState().fetchApplications();

    let resolveFirst!: (v: { status: number; data?: unknown }) => void;
    adminApi.fetchApplicationById
      .mockReturnValueOnce(new Promise((res) => (resolveFirst = res)))
      .mockResolvedValue({ status: 200, data: app("2") });
    reviewsApi.fetchReviewNotes.mockResolvedValue({
      status: 200,
      data: { notes: [] },
    });

    const first = useGradingStore.getState().loadDetail("1");
    const second = useGradingStore.getState().loadDetail("2");
    resolveFirst({ status: 200, data: app("1") });
    await Promise.all([first, second]);

    expect(useGradingStore.getState().detail?.id).toBe("2");
  });

  it("still sets detail in order with correct loading flags", async () => {
    adminApi.fetchApplications.mockResolvedValueOnce(listResponse([app("1")]));
    await useGradingStore.getState().fetchApplications();

    adminApi.fetchApplicationById.mockResolvedValue({
      status: 200,
      data: app("1"),
    });
    reviewsApi.fetchReviewNotes.mockResolvedValue({
      status: 200,
      data: { notes: [] },
    });
    await useGradingStore.getState().loadDetail("1");
    expect(useGradingStore.getState().detail?.id).toBe("1");
    expect(useGradingStore.getState().detailLoading).toBe(false);
    expect(useGradingStore.getState().notesLoading).toBe(false);
  });
});

describe("grading store: navigation is bounded at first and last", () => {
  beforeEach(async () => {
    adminApi.fetchApplications.mockResolvedValueOnce(
      listResponse([app("1"), app("2"), app("3")]),
    );
    await useGradingStore.getState().fetchApplications();
    useGradingStore.getState().loadDetail("1");
    adminApi.fetchApplicationById.mockResolvedValue({
      status: 200,
      data: undefined,
    });
    reviewsApi.fetchReviewNotes.mockResolvedValue({
      status: 200,
      data: { notes: [] },
    });
  });

  it("stops at the first review when navigating prev", () => {
    useGradingStore.getState().navigatePrev();
    expect(useGradingStore.getState().currentIndex).toBe(0);
  });

  it("advances forward within bounds", () => {
    useGradingStore.getState().navigateNext();
    expect(useGradingStore.getState().currentIndex).toBe(1);
  });

  it("moves backward within bounds", () => {
    useGradingStore.setState({ currentIndex: 2 });
    useGradingStore.getState().navigatePrev();
    expect(useGradingStore.getState().currentIndex).toBe(1);
    useGradingStore.getState().navigatePrev();
    expect(useGradingStore.getState().currentIndex).toBe(0);
  });

  it("bounded at last index: navigateNext on final keeps currentIndex", () => {
    useGradingStore.setState({ currentIndex: 2 });
    useGradingStore.getState().navigateNext();
    expect(useGradingStore.getState().currentIndex).toBe(2);
  });
});

describe("grading store: gradeApplication", () => {
  it("marks grading, updates status, and auto-advances", async () => {
    adminApi.fetchApplications.mockResolvedValueOnce(
      listResponse([app("1"), app("2")]),
    );
    await useGradingStore.getState().fetchApplications();
    adminApi.fetchApplicationById.mockResolvedValue({
      status: 200,
      data: undefined,
    });
    reviewsApi.fetchReviewNotes.mockResolvedValue({
      status: 200,
      data: { notes: [] },
    });

    gradingApi.setApplicationStatus.mockResolvedValue({ status: 200 });
    await useGradingStore.getState().gradeApplication("1", "accepted");

    expect(useGradingStore.getState().applications[0].status).toBe("accepted");
    expect(useGradingStore.getState().grading).toBe(false);
    expect(useGradingStore.getState().currentIndex).toBe(1);
    expect(toast.success).toHaveBeenCalledWith("Application accepted");
  });

  it("keeps state and clears grading when the update fails", async () => {
    adminApi.fetchApplications.mockResolvedValueOnce(listResponse([app("1")]));
    await useGradingStore.getState().fetchApplications();
    adminApi.fetchApplicationById.mockResolvedValue({
      status: 200,
      data: undefined,
    });
    reviewsApi.fetchReviewNotes.mockResolvedValue({
      status: 200,
      data: { notes: [] },
    });

    gradingApi.setApplicationStatus.mockResolvedValue({ status: 500 });
    const before = useGradingStore.getState().applications[0].status;
    await useGradingStore.getState().gradeApplication("1", "rejected");

    expect(useGradingStore.getState().grading).toBe(false);
    expect(useGradingStore.getState().applications[0].status).toBe(before);
    expect(toast.error).toHaveBeenCalled();
  });
});
