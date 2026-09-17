export interface WalkIn {
  id: string;
  user_id: string;
  email: string;
  queued_at: string;
  position: number;
}

export interface WalkInsResponse {
  pending: number;
  total: number;
  queue: WalkIn[];
}

export interface PromoteResponse {
  promoted_count: number;
  promoted: { id: string; email: string }[];
}
