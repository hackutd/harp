import { toast } from "sonner";
import { create, type StoreApi, type UseBoundStore } from "zustand";

import { errorAlert } from "@/shared/lib/api";
import { deriveSections, type SectionDef } from "@/shared/lib/schema-utils";
import type { ApiResponse, ApplicationSchemaField } from "@/types";

import {
  fetchSchemaContract,
  type SchemaContractKey,
  type SchemaFieldContract,
} from "./contract";

interface SchemaApiResponse {
  fields: ApplicationSchemaField[];
  /** Bindings the saved schema no longer declares, reported by the backend. */
  warnings?: string[];
}

export interface SchemaStoreConfig {
  fetchSchema: (
    signal?: AbortSignal,
  ) => Promise<ApiResponse<SchemaApiResponse>>;
  saveSchema: (
    fields: ApplicationSchemaField[],
  ) => Promise<ApiResponse<SchemaApiResponse>>;
  savedMessage: string;
  /** Which set of backend field bindings this schema carries, if any. */
  contractKey?: SchemaContractKey;
}

export interface SchemaEditorState {
  fields: ApplicationSchemaField[];
  sections: SectionDef[];
  savedFields: ApplicationSchemaField[];
  savedSections: SectionDef[];
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  /** Fields the backend reads, keyed by field id. */
  contracts: Record<string, SchemaFieldContract>;
  /** Bindings the last save left inactive, shown as a banner in the editor. */
  warnings: string[];

  fetchSchema: (signal?: AbortSignal) => Promise<void>;
  saveSchema: () => Promise<void>;
  discardChanges: () => void;
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

export type SchemaStore = UseBoundStore<StoreApi<SchemaEditorState>>;

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

/**
 * Factory for schema-editor stores. The editor UI (SchemaEditor, FieldCard,
 * dialogs) is shared between the application and RSVP schema pages; each page
 * instantiates its own store bound to its own API endpoints.
 */
export function createSchemaStore(config: SchemaStoreConfig): SchemaStore {
  return create<SchemaEditorState>((set, get) => ({
    fields: [],
    sections: [],
    savedFields: [],
    savedSections: [],
    loading: false,
    saving: false,
    dirty: false,
    contracts: {},
    warnings: [],

    fetchSchema: async (signal?: AbortSignal) => {
      // Keep unsaved work intact when the admin switches away from and back to
      // the Builder tab. They can explicitly discard it from the editor.
      if (get().dirty) return;
      set({ loading: true, warnings: [] });

      // The bindings are static per deploy, so a failure to load them only
      // costs the editor its badges — it must not block editing.
      if (config.contractKey && Object.keys(get().contracts).length === 0) {
        const contractRes = await fetchSchemaContract(signal);
        if (contractRes.status === 200 && contractRes.data) {
          const contracts = contractRes.data[config.contractKey] ?? [];
          set({
            contracts: Object.fromEntries(
              contracts.map((contract) => [contract.field_id, contract]),
            ),
          });
        }
      }

      const res = await config.fetchSchema(signal);
      if (signal?.aborted) return;
      if (res.status === 200 && res.data) {
        const fields = res.data.fields ?? [];
        const sections = buildSections(fields);
        set({
          fields,
          sections,
          savedFields: fields.map((field) => ({ ...field })),
          savedSections: sections.map((section) => ({ ...section })),
          loading: false,
          dirty: false,
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
      const res = await config.saveSchema(normalized);
      if (res.status === 200 && res.data) {
        const saved = res.data.fields;
        const savedSections = buildSections(saved);
        set({
          fields: saved,
          sections: savedSections,
          savedFields: saved.map((field) => ({ ...field })),
          savedSections: savedSections.map((section) => ({ ...section })),
          saving: false,
          dirty: false,
          warnings: res.data.warnings ?? [],
        });
        toast.success(config.savedMessage);
      } else {
        errorAlert(res);
        set({ saving: false });
      }
    },

    discardChanges: () => {
      const { savedFields, savedSections } = get();
      set({
        fields: savedFields.map((field) => ({ ...field })),
        sections: savedSections.map((section) => ({ ...section })),
        dirty: false,
      });
      toast.info("Unsaved schema changes discarded");
    },

    updateField: (fieldId, updates) => {
      set((state) => ({
        fields: state.fields.map((f) =>
          f.id === fieldId ? { ...f, ...updates } : f,
        ),
        dirty: true,
      }));
    },

    addField: (field) => {
      set((state) => ({ fields: [...state.fields, field], dirty: true }));
    },

    removeField: (fieldId) => {
      set((state) => {
        const newFields = state.fields.filter((f) => f.id !== fieldId);
        return {
          fields: newFields,
          dirty: true,
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
          dirty: true,
        };
      });
    },

    addSection: (label) => {
      set((state) => {
        const id = `section_${Date.now()}`;
        const newSection: SectionDef = { id, label };
        return { sections: [...state.sections, newSection], dirty: true };
      });
    },

    removeSection: (sectionId) => {
      set((state) => ({
        sections: state.sections.filter((s) => s.id !== sectionId),
        fields: state.fields.filter((f) => f.section !== sectionId),
        dirty: true,
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
        dirty: true,
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
        return { sections: newSections, dirty: true };
      });
    },
  }));
}
