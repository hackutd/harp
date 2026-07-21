export interface FAQ {
  id: string;
  question: string;
  answer: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface FAQListResponse {
  faqs: FAQ[];
}
