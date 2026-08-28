export type { HackerLink, HackerLinkListResponse } from "@/types";

export interface HackerLinkPayload {
  label: string;
  url: string;
  icon: string;
  display_order: number;
}
