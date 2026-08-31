import { createSchemaStore } from "../application/createSchemaStore";
import { fetchRSVPSchema, saveRSVPSchema } from "./api";

export const useRSVPSchemaStore = createSchemaStore({
  fetchSchema: fetchRSVPSchema,
  saveSchema: saveRSVPSchema,
  savedMessage: "RSVP schema saved",
});
