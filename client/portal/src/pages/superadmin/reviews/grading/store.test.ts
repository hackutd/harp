import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicationListItem } from "@/pages/admin/all-applicants/types";
import type { Application, ApplicationSchemaField } from "@/types";

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
  updateApplicationAsAdmin: vi.fn(),
  requestApplicationResumeUploadURL: vi.fn(),
  deleteApplicationResume: vi.fn(),
}));

const hackerApi = vi.hoisted(() => ({
  uploadResumeToSignedURL: vi.fn(),
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
  updateApplicationAsAdmin: gradingApi.updateApplicationAsAdmin,
  requestApplicationResumeUploadURL:
    gradingApi.requestApplicationResumeUploadURL,
  deleteApplicationResume: gradingApi.deleteApplicationResume,
}));

vi.mock("@/pages/hacker/apply/api", () => ({
  uploadResumeToSignedURL: hackerApi.uploadResumeToSignedURL,
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
    travel_status: "not_requested",
    travel_yes_votes: 0,
    travel_no_votes: 0,
    travel_approved_amount_cents: null,
    rsvp_status: "pending",
    travel_rsvp_status: "pending",
    rsvp_submitted_at: null,
    travel_rsvp_submitted_at: null,
    receipt_count: 0,
    estimated_travel_cost_cents: null,
    checked_in_at: null,
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
  useGradingStore.setState(useGradingStore.getInitialState(), true);
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
    // Navigation loads the next detail, so the detail endpoints must answer.
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
  it("marks grading, updates status, and stays on the graded application", async () => {
    adminApi.fetchApplications.mockResolvedValueOnce(
      listResponse([app("1"), app("2")]),
    );
    await useGradingStore.getState().fetchApplications();

    gradingApi.setApplicationStatus.mockResolvedValue({ status: 200 });
    await useGradingStore.getState().gradeApplication("1", "accepted");

    expect(useGradingStore.getState().applications[0].status).toBe("accepted");
    expect(useGradingStore.getState().grading).toBe(false);
    expect(useGradingStore.getState().currentIndex).toBe(0);
    expect(toast.success).toHaveBeenCalledWith("Application accepted");
  });

  it("keeps state and clears grading when the update fails", async () => {
    adminApi.fetchApplications.mockResolvedValueOnce(listResponse([app("1")]));
    await useGradingStore.getState().fetchApplications();

    gradingApi.setApplicationStatus.mockResolvedValue({ status: 500 });
    const before = useGradingStore.getState().applications[0].status;
    await useGradingStore.getState().gradeApplication("1", "rejected");

    expect(useGradingStore.getState().grading).toBe(false);
    expect(useGradingStore.getState().applications[0].status).toBe(before);
    expect(toast.error).toHaveBeenCalled();
  });
});

const SCHEMA: ApplicationSchemaField[] = [
  {
    id: "first_name",
    type: "text",
    label: "First name",
    required: true,
    section: "personal",
    display_order: 1,
  },
];

function detail(id: string, overrides: Partial<Application> = {}): Application {
  return {
    id,
    user_id: "u" + id,
    status: "submitted",
    responses: { first_name: "Ada" },
    application_schema: SCHEMA,
    points: 5,
    meal_group: null,
    resume_path: null,
    ai_percent: null,
    accept_votes: 0,
    reject_votes: 0,
    waitlist_votes: 0,
    reviews_assigned: 0,
    reviews_completed: 0,
    submitted_at: "2026-03-14T15:00:00Z",
    created_at: "2026-03-14T15:00:00Z",
    updated_at: "2026-03-14T15:00:00Z",
    rsvp_status: "pending",
    rsvp_responses: {},
    rsvp_submitted_at: null,
    travel_status: "not_requested",
    travel_yes_votes: 0,
    travel_no_votes: 0,
    travel_approved_amount_cents: null,
    travel_rsvp_status: "pending",
    travel_rsvp_responses: {},
    travel_rsvp_submitted_at: null,
    travel_receipt_paths: [],
    ...overrides,
  };
}

/** One queued application with its detail open. */
function openApplication() {
  useGradingStore.setState({
    applications: [app("1"), app("2")],
    currentIndex: 0,
    detail: detail("1"),
  });
}

describe("grading store: status overrides", () => {
  it("reopens an application as a draft", async () => {
    openApplication();
    gradingApi.setApplicationStatus.mockResolvedValue({
      status: 200,
      data: { application: detail("1", { status: "draft" }) },
    });

    await useGradingStore.getState().gradeApplication("1", "draft");

    expect(gradingApi.setApplicationStatus).toHaveBeenCalledWith("1", "draft");
    expect(useGradingStore.getState().applications[0].status).toBe("draft");
    expect(toast.success).toHaveBeenCalledWith(
      "Application reopened — the hacker can edit and resubmit it",
    );
  });

  it("keeps the loaded schema and points when the response has none", async () => {
    openApplication();
    const bare = detail("1", { status: "accepted" });
    delete bare.application_schema;
    delete bare.points;
    gradingApi.setApplicationStatus.mockResolvedValue({
      status: 200,
      data: { application: bare },
    });

    await useGradingStore.getState().gradeApplication("1", "accepted");

    const d = useGradingStore.getState().detail;
    expect(d?.status).toBe("accepted");
    expect(d?.application_schema).toEqual(SCHEMA);
    expect(d?.points).toBe(5);
  });
});

describe("grading store: saveResponses", () => {
  it("sends the patch and applies the saved application", async () => {
    openApplication();
    gradingApi.updateApplicationAsAdmin.mockResolvedValue({
      status: 200,
      data: detail("1", { responses: { first_name: "Grace" } }),
    });

    const p = useGradingStore
      .getState()
      .saveResponses("1", { first_name: "Grace" });
    expect(useGradingStore.getState().saving).toBe(true);
    const ok = await p;

    expect(ok).toBe(true);
    expect(gradingApi.updateApplicationAsAdmin).toHaveBeenCalledWith("1", {
      responses: { first_name: "Grace" },
    });
    const s = useGradingStore.getState();
    expect(s.saving).toBe(false);
    expect(s.detail?.responses).toEqual({ first_name: "Grace" });
    expect(s.applications[0].first_name).toBe("Grace");
    expect(s.applications[1].first_name).toBe("Ada");
  });

  it("leaves the detail alone when the save fails", async () => {
    openApplication();
    gradingApi.updateApplicationAsAdmin.mockResolvedValue({
      status: 400,
      error: "age must be a number",
    });

    const ok = await useGradingStore
      .getState()
      .saveResponses("1", { age: "x" });

    expect(ok).toBe(false);
    expect(useGradingStore.getState().saving).toBe(false);
    expect(useGradingStore.getState().detail?.responses).toEqual({
      first_name: "Ada",
    });
    expect(toast.error).toHaveBeenCalledWith("age must be a number");
  });

  it("does not overwrite a different application's open detail", async () => {
    openApplication();
    useGradingStore.setState({ detail: detail("2") });
    gradingApi.updateApplicationAsAdmin.mockResolvedValue({
      status: 200,
      data: detail("1", { responses: { first_name: "Grace" } }),
    });

    await useGradingStore
      .getState()
      .saveResponses("1", { first_name: "Grace" });

    expect(useGradingStore.getState().detail?.id).toBe("2");
    expect(useGradingStore.getState().applications[0].first_name).toBe("Grace");
  });
});

describe("grading store: resume", () => {
  const file = new File(["%PDF"], "resume.pdf", { type: "application/pdf" });
  const path = "hackathons/x/resumes/u1/0123456789abcdef0123456789abcdef.pdf";

  it("signs, uploads, then saves the new resume path", async () => {
    openApplication();
    gradingApi.requestApplicationResumeUploadURL.mockResolvedValue({
      status: 200,
      data: { upload_url: "https://upload.example", resume_path: path },
    });
    hackerApi.uploadResumeToSignedURL.mockResolvedValue({ status: 200 });
    gradingApi.updateApplicationAsAdmin.mockResolvedValue({
      status: 200,
      data: detail("1", { resume_path: path }),
    });

    const ok = await useGradingStore.getState().replaceResume("1", file);

    expect(ok).toBe(true);
    expect(hackerApi.uploadResumeToSignedURL).toHaveBeenCalledWith(
      "https://upload.example",
      file,
    );
    expect(gradingApi.updateApplicationAsAdmin).toHaveBeenCalledWith("1", {
      resume_path: path,
    });
    expect(useGradingStore.getState().applications[0].has_resume).toBe(true);
    expect(useGradingStore.getState().saving).toBe(false);
  });

  it("does not save a path when the upload fails", async () => {
    openApplication();
    gradingApi.requestApplicationResumeUploadURL.mockResolvedValue({
      status: 200,
      data: { upload_url: "https://upload.example", resume_path: path },
    });
    hackerApi.uploadResumeToSignedURL.mockResolvedValue({
      status: 403,
      error: "too large",
    });

    const ok = await useGradingStore.getState().replaceResume("1", file);

    expect(ok).toBe(false);
    expect(gradingApi.updateApplicationAsAdmin).not.toHaveBeenCalled();
    expect(useGradingStore.getState().saving).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("too large");
  });

  it("does not upload when signing fails", async () => {
    openApplication();
    gradingApi.requestApplicationResumeUploadURL.mockResolvedValue({
      status: 503,
      error: "resume uploads are not configured",
    });

    const ok = await useGradingStore.getState().replaceResume("1", file);

    expect(ok).toBe(false);
    expect(hackerApi.uploadResumeToSignedURL).not.toHaveBeenCalled();
    expect(useGradingStore.getState().saving).toBe(false);
  });

  it("removes the resume", async () => {
    openApplication();
    useGradingStore.setState({
      applications: [{ ...app("1"), has_resume: true }, app("2")],
      detail: detail("1", { resume_path: path }),
    });
    gradingApi.deleteApplicationResume.mockResolvedValue({
      status: 200,
      data: detail("1"),
    });

    const ok = await useGradingStore.getState().removeResume("1");

    expect(ok).toBe(true);
    expect(useGradingStore.getState().detail?.resume_path).toBeNull();
    expect(useGradingStore.getState().applications[0].has_resume).toBe(false);
  });
});
