import { createApplicationsStore } from "@/pages/admin/all-applicants/createStore";

export const useReviewApplicationsStore = createApplicationsStore({
  defaultStatus: "submitted",
  defaultSortBy: "accept_votes",
});
