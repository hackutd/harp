export interface Sponsor {
  id: string;
  name: string;
  tier: string;
  logo_data: string;
  logo_content_type: string;
  website_url: string;
  description: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface SponsorPayload {
  name: string;
  tier: string;
  website_url: string;
  description: string;
  display_order: number;
}

export interface SponsorListResponse {
  sponsors: Sponsor[];
}
