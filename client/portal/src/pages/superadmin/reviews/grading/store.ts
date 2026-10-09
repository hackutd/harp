import { toast } from "sonner";
import { create } from "zustand";

import {
  fetchApplicationById,
  fetchApplications as apiFetchApplications,
} from "@/pages/admin/all-applicants/api";
import type {
  ApplicationListItem,
  ApplicationSortBy,
  ApplicationStatus,
  FetchParams,
} from "@/pages/admin/all-applicants/types";
import { fetchReviewNotes } from "@/pages/admin/reviews/api";
import type { ReviewNote } from "@/pages/admin/reviews/types";
import { uploadResumeToSignedURL } from "@/pages/hacker/apply/api";
import type { Application, ApplicationStatus as AnyStatus } from "@/types";

import {
  deleteApplicationResume,
  requestApplicationResumeUploadURL,
  resetApplicationRSVP,
  resetApplicationTravelRSVP,
  setApplicationStatus,
  setApplicationTravelStatus,
  updateApplicationAsAdmin,
} from "./api";
import { syncListItem } from "./utils";

const STATUS_TOASTS: Record<AnyStatus, string> = {
  draft: "Application reopened — the hacker can edit and resubmit it",
  submitted: "Application moved back to submitted",
  accepted: "Application accepted",
  rejected: "Application rejected",
  waitlisted: "Application waitlisted",
};

interface FilterParams {
  /** null is every status (the reviews page's All tab). */
  status?: ApplicationStatus | null;
  sort_by?: ApplicationSortBy;
  search?: string;
}

interface GradingState {
  applications: ApplicationListItem[];
  loading: boolean;
  currentIndex: number;
  detail: Application | null;
  detailLoading: boolean;
  notes: ReviewNote[];
  notesLoading: boolean;
  grading: boolean;
  /** An edit to the application's answers or resume is in flight. */
  saving: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  filterParams: FilterParams;
  fetchApplications: (params?: FetchParams) => Promise<void>;
  loadDetail: (applicationId: string) => Promise<void>;
  navigateNext: () => void;
  navigatePrev: () => void;
  gradeApplication: (applicationId: string, status: AnyStatus) => Promise<void>;
  gradeTravel: (
    applicationId: string,
    travelStatus: "approved" | "rejected" | "pending",
    approvedAmountCents?: number,
  ) => Promise<void>;
  resetRSVP: (applicationId: string) => Promise<void>;
  resetTravelRSVP: (applicationId: string) => Promise<void>;
  saveResponses: (
    applicationId: string,
    responses: Record<string, unknown>,
  ) => Promise<boolean>;
  replaceResume: (applicationId: string, file: File) => Promise<boolean>;
  removeResume: (applicationId: string) => Promise<boolean>;
  reset: () => void;
}

const initialState = {
  applications: [] as ApplicationListItem[],
  loading: false,
  currentIndex: 0,
  detail: null as Application | null,
  detailLoading: false,
  notes: [] as ReviewNote[],
  notesLoading: false,
  grading: false,
  saving: false,
  nextCursor: null as string | null,
  prevCursor: null as string | null,
  filterParams: {} as FilterParams,
};

let loadDetailSeq = 0;

/** Puts an edited application into the open detail and its queue row. */
function applyEdited(application: Application) {
  const { applications, detail } = useGradingStore.getState();
  useGradingStore.setState({
    applications: applications.map((app) =>
      app.id === application.id ? syncListItem(app, application) : app,
    ),
    detail: detail?.id === application.id ? application : detail,
  });
}

/**
 * Status and RSVP endpoints return the bare application; keep the schema and
 * points the detail was loaded with so the answers stay rendered (and
 * editable) after the change.
 */
function keepEmbedded(detail: Application, updated: Application): Application {
  return {
    ...updated,
    application_schema: updated.application_schema ?? detail.application_schema,
    points: updated.points ?? detail.points,
  };
}

export const useGradingStore = create<GradingState>((set, get) => ({
  ...initialState,

  fetchApplications: async (params?: FetchParams) => {
    set({ loading: true });

    const state = get();
    const mergedParams: FetchParams = {
      status:
        state.filterParams.status === undefined
          ? "submitted"
          : state.filterParams.status,
      sort_by: state.filterParams.sort_by ?? "accept_votes",
      search: state.filterParams.search || undefined,
      ...params,
    };

    const res = await apiFetchApplications(mergedParams);

    if (res.status === 200 && res.data) {
      set({
        applications: res.data.applications,
        nextCursor: res.data.next_cursor,
        prevCursor: res.data.prev_cursor,
        loading: false,
        filterParams: {
          status: mergedParams.status ?? null,
          sort_by: mergedParams.sort_by,
          search: mergedParams.search,
        },
      });
    } else {
      set({
        applications: [],
        nextCursor: null,
        prevCursor: null,
        loading: false,
      });
    }
  },

  loadDetail: async (applicationId: string) => {
    const requestId = ++loadDetailSeq;
    set({
      detailLoading: true,
      notesLoading: true,
      detail: null,
      notes: [],
    });

    const [detailRes, notesRes] = await Promise.all([
      fetchApplicationById(applicationId),
      fetchReviewNotes(applicationId),
    ]);

    // Guard against stale responses from rapid navigation
    if (loadDetailSeq !== requestId) return;

    if (detailRes.status === 200 && detailRes.data) {
      set({ detail: detailRes.data, detailLoading: false });
    } else {
      set({ detail: null, detailLoading: false });
    }

    if (notesRes.status === 200 && notesRes.data) {
      set({ notes: notesRes.data.notes ?? [], notesLoading: false });
    } else {
      set({ notes: [], notesLoading: false });
    }
  },

  navigateNext: () => {
    const { applications, currentIndex, nextCursor } = get();
    if (currentIndex < applications.length - 1) {
      const newIndex = currentIndex + 1;
      set({ currentIndex: newIndex });
      get().loadDetail(applications[newIndex].id);
    } else if (nextCursor) {
      get()
        .fetchApplications({ cursor: nextCursor })
        .then(() => {
          const newApps = get().applications;
          if (newApps.length > 0) {
            set({ currentIndex: 0 });
            get().loadDetail(newApps[0].id);
          }
        })
        .catch(() => {});
    }
  },

  navigatePrev: () => {
    const { applications, currentIndex, prevCursor } = get();
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      set({ currentIndex: newIndex });
      get().loadDetail(applications[newIndex].id);
    } else if (prevCursor) {
      get()
        .fetchApplications({ cursor: prevCursor, direction: "backward" })
        .then(() => {
          const newApps = get().applications;
          if (newApps.length > 0) {
            const lastIndex = newApps.length - 1;
            set({ currentIndex: lastIndex });
            get().loadDetail(newApps[lastIndex].id);
          }
        })
        .catch(() => {});
    }
  },

  gradeApplication: async (applicationId: string, status: AnyStatus) => {
    set({ grading: true });

    const res = await setApplicationStatus(applicationId, status);

    if (res.status === 200) {
      const { applications, detail } = get();
      const updated = applications.map((app) =>
        app.id === applicationId ? { ...app, status } : app,
      );
      set({
        applications: updated,
        grading: false,
        detail:
          detail?.id === applicationId && res.data
            ? keepEmbedded(detail, res.data.application)
            : detail,
      });

      toast.success(STATUS_TOASTS[status]);
    } else {
      set({ grading: false });
      toast.error(res.error ?? "Failed to update application status");
    }
  },

  // Travel decisions are independent of the application status, so no
  // auto-advance — the super admin usually still grades the application.
  gradeTravel: async (
    applicationId: string,
    travelStatus: "approved" | "rejected" | "pending",
    approvedAmountCents?: number,
  ) => {
    set({ grading: true });

    const res = await setApplicationTravelStatus(
      applicationId,
      travelStatus,
      approvedAmountCents,
    );

    if (res.status === 200) {
      const { applications } = get();
      const updated = applications.map((app) =>
        app.id === applicationId
          ? {
              ...app,
              travel_status: travelStatus,
              travel_approved_amount_cents:
                travelStatus === "approved"
                  ? (approvedAmountCents ?? null)
                  : null,
            }
          : app,
      );
      set({ applications: updated, grading: false });

      toast.success(`Travel reimbursement ${travelStatus}`);
    } else {
      set({ grading: false });
      toast.error(res.error ?? "Failed to update travel status");
    }
  },

  // Repair hatches for the one-shot hacker RSVPs. Both refresh the loaded
  // detail from the response so the travel RSVP panel stops showing answers
  // that were just discarded.
  resetRSVP: async (applicationId: string) => {
    set({ grading: true });

    const res = await resetApplicationRSVP(applicationId);

    if (res.status === 200) {
      const { applications, detail } = get();
      const updated = applications.map((app) =>
        app.id === applicationId
          ? {
              ...app,
              rsvp_status: "pending" as const,
              travel_rsvp_status: "pending" as const,
            }
          : app,
      );
      set({
        applications: updated,
        grading: false,
        detail:
          detail?.id === applicationId && res.data
            ? keepEmbedded(detail, res.data.application)
            : detail,
      });

      toast.success("RSVP reset — the hacker can claim their spot again");
    } else {
      set({ grading: false });
      toast.error(res.error ?? "Failed to reset RSVP");
    }
  },

  resetTravelRSVP: async (applicationId: string) => {
    set({ grading: true });

    const res = await resetApplicationTravelRSVP(applicationId);

    if (res.status === 200) {
      const { applications, detail } = get();
      const updated = applications.map((app) =>
        app.id === applicationId
          ? { ...app, travel_rsvp_status: "pending" as const }
          : app,
      );
      set({
        applications: updated,
        grading: false,
        detail:
          detail?.id === applicationId && res.data
            ? keepEmbedded(detail, res.data.application)
            : detail,
      });

      toast.success("Travel form reset — the hacker can fill it in again");
    } else {
      set({ grading: false });
      toast.error(res.error ?? "Failed to reset travel form");
    }
  },

  saveResponses: async (applicationId, responses) => {
    set({ saving: true });

    const res = await updateApplicationAsAdmin(applicationId, { responses });

    set({ saving: false });
    if (res.status === 200 && res.data) {
      applyEdited(res.data);
      toast.success("Application updated");
      return true;
    }
    toast.error(res.error ?? "Failed to update application");
    return false;
  },

  // Same three steps as the hacker's own upload: sign, PUT to GCS, then
  // point the application at the new file (the backend deletes the old one).
  replaceResume: async (applicationId, file) => {
    set({ saving: true });

    const urlRes = await requestApplicationResumeUploadURL(applicationId);
    if (urlRes.status !== 200 || !urlRes.data) {
      set({ saving: false });
      toast.error(urlRes.error ?? "Failed to start resume upload");
      return false;
    }

    const uploadRes = await uploadResumeToSignedURL(
      urlRes.data.upload_url,
      file,
    );
    if (uploadRes.status < 200 || uploadRes.status >= 300) {
      set({ saving: false });
      toast.error(uploadRes.error ?? "Failed to upload resume");
      return false;
    }

    const res = await updateApplicationAsAdmin(applicationId, {
      resume_path: urlRes.data.resume_path,
    });

    set({ saving: false });
    if (res.status === 200 && res.data) {
      applyEdited(res.data);
      toast.success("Resume replaced");
      return true;
    }
    toast.error(res.error ?? "Failed to save resume");
    return false;
  },

  removeResume: async (applicationId) => {
    set({ saving: true });

    const res = await deleteApplicationResume(applicationId);

    set({ saving: false });
    if (res.status === 200 && res.data) {
      applyEdited(res.data);
      toast.success("Resume removed");
      return true;
    }
    toast.error(res.error ?? "Failed to remove resume");
    return false;
  },

  reset: () => {
    loadDetailSeq = 0;
    set(initialState);
  },
}));
