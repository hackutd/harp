import { getRequest, putRequest } from "@/shared/lib/api";
import type { ApiResponse, ShortAnswerQuestion } from "@/types";

interface SAQuestionsResponse {
  questions: ShortAnswerQuestion[];
}

export async function fetchSAQuestions(
  signal?: AbortSignal,
): Promise<ApiResponse<SAQuestionsResponse>> {
  return getRequest<SAQuestionsResponse>(
    "/superadmin/settings/saquestions",
    "short answer questions",
    signal,
  );
}

export async function saveSAQuestions(
  questions: ShortAnswerQuestion[],
): Promise<ApiResponse<SAQuestionsResponse>> {
  return putRequest<SAQuestionsResponse>(
    "/superadmin/settings/saquestions",
    { questions },
    "short answer questions",
  );
}
