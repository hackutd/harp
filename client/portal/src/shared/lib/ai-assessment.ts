import type { AIAssessment, AIVerdict } from "@/types";

export const AI_CLASS_LABELS: Record<AIVerdict, string> = {
  human: "Human",
  ai: "AI",
  ai_edited: "AI edited",
  humanized: "Humanized",
};

export const AI_CLASS_KEYS = ["human", "ai", "ai_edited", "humanized"] as const;

export const EMPTY_AI_ASSESSMENT: AIAssessment = {
  ai_score: null,
  verdict: null,
  classes: { human: null, ai: null, ai_edited: null, humanized: null },
};

export function formatAIScore(score: number | null | undefined): string {
  return score == null ? "Not set" : `${Number((score * 100).toFixed(1))}%`;
}
