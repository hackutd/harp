export interface Referral {
  id: string;
  name: string;
  code: string;
  visit_count: number;
  signup_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReferralSignup {
  user_id: string;
  email: string;
  created_at: string;
}

export interface ReferralListResponse {
  referrals: Referral[];
}

export interface ReferralSignupsResponse {
  signups: ReferralSignup[];
}

/** Omit code (or send "") to have the server generate a random one. */
export interface CreateReferralPayload {
  name: string;
  code?: string;
}

export interface UpdateReferralPayload {
  name: string;
  code: string;
}
