export interface TrackPrize {
  place: string;
  prize: string;
}

export interface Track {
  id: string;
  title: string;
  sponsor_name: string;
  description: string;
  prizes: TrackPrize[];
  logo_data: string;
  logo_content_type: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface TrackPayload {
  title: string;
  sponsor_name: string;
  description: string;
  prizes: TrackPrize[];
  display_order: number;
}

export interface TrackListResponse {
  tracks: Track[];
}
