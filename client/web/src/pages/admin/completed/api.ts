import { getRequest } from '@/shared/lib/api';
import type { ApiResponse } from '@/types';

import type { CompletedReviewsResponse } from './types';

export async function fetchCompletedReviews(): Promise<ApiResponse<CompletedReviewsResponse>> {
  return getRequest<CompletedReviewsResponse>('/v1/admin/reviews/completed', 'completed reviews');
}
