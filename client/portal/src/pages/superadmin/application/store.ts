import { fetchApplicationSchema, saveApplicationSchema } from "./api";
import { createSchemaStore } from "./createSchemaStore";

export const useApplicationSchemaStore = createSchemaStore({
  fetchSchema: fetchApplicationSchema,
  saveSchema: saveApplicationSchema,
  savedMessage: "Application schema saved",
  contractKey: "application_schema",
});
