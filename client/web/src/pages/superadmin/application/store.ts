import { toast } from "sonner";
import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";
import type { ApplicationSchemaField } from "@/types";

import { fetchApplicationSchema, saveApplicationSchema } from "./api";

interface ApplicationSchemaState {
  fields: ApplicationSchemaField[];
  loading: boolean;
  saving: boolean;

  fetchSchema: (signal?: AbortSignal) => Promise<void>;
  saveSchema: () => Promise<void>;
  updateField: (
    fieldId: string,
    updates: Partial<ApplicationSchemaField>,
  ) => void;
  addField: (field: ApplicationSchemaField) => void;
  removeField: (fieldId: string) => void;
  moveField: (fieldId: string, direction: "up" | "down") => void;
}

export const useApplicationSchemaStore = create<ApplicationSchemaState>(
  (set, get) => ({
    fields: [],
    loading: false,
    saving: false,

    fetchSchema: async (signal?: AbortSignal) => {
      set({ loading: true });
      const res = await fetchApplicationSchema(signal);
      if (signal?.aborted) return;
      if (res.status === 200 && res.data) {
        set({ fields: res.data.fields ?? [], loading: false });
      } else {
        errorAlert(res);
        set({ loading: false });
      }
    },

    saveSchema: async () => {
      const { fields } = get();

      const emptyLabel = fields.find((f) => !f.label.trim());
      if (emptyLabel) {
        toast.error("All fields must have a label before saving");
        return;
      }

      const missingOptions = fields.find(
        (f) =>
          (f.type === "select" || f.type === "multi_select") &&
          (!f.options || f.options.length === 0),
      );
      if (missingOptions) {
        toast.error(
          `"${missingOptions.label}" needs at least one option`,
        );
        return;
      }

      // Recalculate display_order per section (sequential, no gaps)
      const sectionCounters: Record<string, number> = {};
      const normalized = fields.map((f) => {
        const section = f.section;
        sectionCounters[section] = (sectionCounters[section] ?? 0) + 1;
        return { ...f, display_order: sectionCounters[section] };
      });

      set({ saving: true });
      const res = await saveApplicationSchema(normalized);
      if (res.status === 200 && res.data) {
        set({ fields: res.data.fields, saving: false });
        toast.success("Application schema saved");
      } else {
        errorAlert(res);
        set({ saving: false });
      }
    },

    updateField: (fieldId, updates) => {
      set((state) => ({
        fields: state.fields.map((f) =>
          f.id === fieldId ? { ...f, ...updates } : f,
        ),
      }));
    },

    addField: (field) => {
      set((state) => ({ fields: [...state.fields, field] }));
    },

    removeField: (fieldId) => {
      set((state) => ({
        fields: state.fields.filter((f) => f.id !== fieldId),
      }));
    },

    moveField: (fieldId, direction) => {
      set((state) => {
        const field = state.fields.find((f) => f.id === fieldId);
        if (!field) return state;

        // Get fields in this section sorted by display_order
        const sectionFields = state.fields
          .filter((f) => f.section === field.section)
          .sort((a, b) => a.display_order - b.display_order);

        const idx = sectionFields.findIndex((f) => f.id === fieldId);
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sectionFields.length) return state;

        const swapField = sectionFields[swapIdx];
        const tempOrder = field.display_order;

        return {
          fields: state.fields.map((f) => {
            if (f.id === fieldId)
              return { ...f, display_order: swapField.display_order };
            if (f.id === swapField.id)
              return { ...f, display_order: tempOrder };
            return f;
          }),
        };
      });
    },
  }),
);
