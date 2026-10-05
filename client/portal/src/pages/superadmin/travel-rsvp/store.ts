import { createSchemaStore } from "../application/createSchemaStore";
import { fetchTravelRSVPSchema, saveTravelRSVPSchema } from "./api";

export const useTravelRSVPSchemaStore = createSchemaStore({
  fetchSchema: fetchTravelRSVPSchema,
  saveSchema: saveTravelRSVPSchema,
  savedMessage: "Travel RSVP schema saved",
  contractKey: "travel_rsvp_schema",
});
