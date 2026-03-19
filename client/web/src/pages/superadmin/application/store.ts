import { toast } from "sonner";
import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";
import type { ShortAnswerQuestion } from "@/types";

import { fetchSAQuestions, saveSAQuestions } from "./api";

interface ApplicationSettingsState {
  questions: ShortAnswerQuestion[];
  loading: boolean;
  saving: boolean;

  fetchQuestions: (signal?: AbortSignal) => Promise<void>;
  saveQuestions: () => Promise<void>;
  updateQuestion: (
    index: number,
    field: keyof ShortAnswerQuestion,
    value: string | boolean | number,
  ) => void;
  addQuestion: () => void;
  removeQuestion: (index: number) => void;
}

export const useApplicationSettingsStore = create<ApplicationSettingsState>(
  (set, get) => ({
    questions: [],
    loading: false,
    saving: false,

    fetchQuestions: async (signal?: AbortSignal) => {
      set({ loading: true });
      const res = await fetchSAQuestions(signal);
      if (signal?.aborted) return;
      if (res.status === 200 && res.data) {
        set({ questions: res.data.questions ?? [], loading: false });
      } else {
        errorAlert(res);
        set({ loading: false });
      }
    },

    saveQuestions: async () => {
      const { questions } = get();
      const emptyQuestion = questions.find((q) => !q.question.trim());
      if (emptyQuestion) {
        toast.error("All questions must have text before saving");
        return;
      }

      set({ saving: true });
      const payload = questions.map((q, i) => ({
        ...q,
        display_order: i + 1,
      }));
      const res = await saveSAQuestions(payload);
      if (res.status === 200 && res.data) {
        toast.success("Questions saved");
      } else {
        errorAlert(res);
      }
      set({ saving: false });
    },

    updateQuestion: (index, field, value) => {
      set((state) => ({
        questions: state.questions.map((q, i) =>
          i === index ? { ...q, [field]: value } : q,
        ),
      }));
    },

    addQuestion: () => {
      set((state) => ({
        questions: [
          ...state.questions,
          {
            id: `saq_${Date.now()}`,
            question: "",
            required: false,
            display_order: state.questions.length + 1,
          },
        ],
      }));
    },

    removeQuestion: (index) => {
      set((state) => ({
        questions: state.questions.filter((_, i) => i !== index),
      }));
    },
  }),
);
