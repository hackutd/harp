export type {
  NotesListResponse,
  Review,
  ReviewNote,
  ReviewVote,
} from "../assigned/types";

export interface CompletedReviewsResponse {
  reviews: import("../assigned/types").Review[];
}
