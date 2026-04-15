import { toast } from "sonner";
import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";
import { deriveSections, type SectionDef } from "@/shared/lib/schema-utils";
import type { ApplicationSchemaField } from "@/types";

import { fetchApplicationSchema, saveApplicationSchema } from "./api";

interface ApplicationSchemaState {
  fields: ApplicationSchemaField[];
  sections: SectionDef[];
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
  addSection: (label: string) => void;
  removeSection: (sectionId: string) => void;
  renameSection: (sectionId: string, label: string) => void;
  moveSection: (sectionId: string, direction: "up" | "down") => void;
}

/** Derive sections from the current field list. */
function buildSections(fields: ApplicationSchemaField[]): SectionDef[] {
  return deriveSections(fields);
}

/**
 * Stamp every field with the correct section_label and section_order
 * based on the current sections array. Also recalculates display_order.
 */
function stampFields(
  fields: ApplicationSchemaField[],
  sections: SectionDef[],
): ApplicationSchemaField[] {
  const sectionMeta = new Map(
    sections.map((s, i) => [s.id, { label: s.label, order: i + 1 }]),
  );
  const sectionCounters: Record<string, number> = {};

  return fields.map((f) => {
    const meta = sectionMeta.get(f.section);
    sectionCounters[f.section] = (sectionCounters[f.section] ?? 0) + 1;
    return {
      ...f,
      section_label: meta?.label ?? f.section,
      section_order: meta?.order ?? 999,
      display_order: sectionCounters[f.section],
    };
  });
}

export const useApplicationSchemaStore = create<ApplicationSchemaState>(
  (set, get) => ({
    fields: [],
    sections: [],
    loading: false,
    saving: false,

    fetchSchema: async (signal?: AbortSignal) => {
      set({ loading: true });
      const res = await fetchApplicationSchema(signal);
      if (signal?.aborted) return;
      if (res.status === 200 && res.data) {
        const fields = res.data.fields ?? [];
        set({
          fields,
          sections: buildSections(fields),
          loading: false,
        });
      } else {
        errorAlert(res);
        set({ loading: false });
      }
    },

    saveSchema: async () => {
      const { fields, sections } = get();

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
        toast.error(`"${missingOptions.label}" needs at least one option`);
        return;
      }

      const normalized = stampFields(fields, sections);

      set({ saving: true });
      const res = await saveApplicationSchema(normalized);
      if (res.status === 200 && res.data) {
        const saved = res.data.fields;
        set({ fields: saved, sections: buildSections(saved), saving: false });
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
      set((state) => {
        const newFields = state.fields.filter((f) => f.id !== fieldId);
        return {
          fields: newFields,
          // Keep sections intact — empty sections are allowed during editing
        };
      });
    },

    moveField: (fieldId, direction) => {
      set((state) => {
        const field = state.fields.find((f) => f.id === fieldId);
        if (!field) return state;

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

    addSection: (label) => {
      set((state) => {
        const id = `section_${Date.now()}`;
        const newSection: SectionDef = { id, label };
        return { sections: [...state.sections, newSection] };
      });
    },

    removeSection: (sectionId) => {
      set((state) => ({
        sections: state.sections.filter((s) => s.id !== sectionId),
        fields: state.fields.filter((f) => f.section !== sectionId),
      }));
    },

    renameSection: (sectionId, label) => {
      set((state) => ({
        sections: state.sections.map((s) =>
          s.id === sectionId ? { ...s, label } : s,
        ),
        fields: state.fields.map((f) =>
          f.section === sectionId ? { ...f, section_label: label } : f,
        ),
      }));
    },

    moveSection: (sectionId, direction) => {
      set((state) => {
        const idx = state.sections.findIndex((s) => s.id === sectionId);
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= state.sections.length) return state;

        const newSections = [...state.sections];
        [newSections[idx], newSections[swapIdx]] = [
          newSections[swapIdx],
          newSections[idx],
        ];
        return { sections: newSections };
      });
    },
  }),
);
