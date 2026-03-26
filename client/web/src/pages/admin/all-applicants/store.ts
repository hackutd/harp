import { createApplicationsStore } from "./createStore";

export type { ApplicationsState } from "./createStore";

export const useApplicationsStore = createApplicationsStore({
  defaultStatus: null,
});
