import { getRequest } from '@/shared/lib/api';
import type { ApiResponse } from '@/types';

import type { CompletedReviewsResponse } from './types';

export async function fetchCompletedReviews(signal?: AbortSignal): Promise<ApiResponse<CompletedReviewsResponse>> {
  return getRequest<CompletedReviewsResponse>('/admin/reviews/completed', 'completed reviews', signal);
}
