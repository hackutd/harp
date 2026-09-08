import { buildDefaultValues, deriveSections } from "@/shared/lib/schema-utils";
import type { ApiResponse, Application, ApplicationSchemaField } from "@/types";

import type { UpdateApplicationPayload } from "./api";

export function draftResponses(
  values: Record<string, unknown>,
  schema: ApplicationSchemaField[],
): Record<string, unknown> {
  return Object.fromEntries(
    schema
      .filter((field) => field.id in values)
      .map((field) => [field.id, values[field.id]]),
  );
}

/** Add defaults without replacing existing answers, including obsolete choices. */
export function reconcileDraftValues(
  values: Record<string, unknown>,
  schema: ApplicationSchemaField[],
): Record<string, unknown> {
  const answers = Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== null && value !== undefined,
    ),
  );
  return { ...buildDefaultValues(schema), ...answers };
}

export function draftStepIds(schema: ApplicationSchemaField[]): string[] {
  return [...deriveSections(schema).map((section) => section.id), "review"];
}

export function reconcileDraftStep(
  index: number,
  previous: ApplicationSchemaField[],
  next: ApplicationSchemaField[],
): number {
  const nextIds = draftStepIds(next);
  const newIndex = nextIds.indexOf(draftStepIds(previous)[index]);
  return newIndex >= 0 ? newIndex : Math.min(index, nextIds.length - 1);
}

export interface DraftSnapshot {
  values: Record<string, unknown>;
  schema: ApplicationSchemaField[];
  revision: number;
}

export interface DraftSaveResult {
  response: ApiResponse<Application>;
  snapshot: DraftSnapshot;
  current: boolean;
}

/** Serialize writes and take each snapshot when its turn starts, not when queued. */
export function createDraftSaver({
  read,
  request,
  onStart,
  onSaved,
  onFailure,
  onFinish,
}: {
  read: () => DraftSnapshot;
  request: (
    payload: UpdateApplicationPayload,
  ) => Promise<ApiResponse<Application>>;
  onStart: () => void;
  onSaved: (application: Application) => void;
  onFailure: (
    response: ApiResponse<Application>,
    snapshot: DraftSnapshot,
  ) => Promise<void>;
  onFinish: (result: DraftSaveResult) => void;
}): () => Promise<DraftSaveResult> {
  let chain: Promise<unknown> = Promise.resolve();
  return () => {
    const run = async (): Promise<DraftSaveResult> => {
      const snapshot = structuredClone(read());
      onStart();
      const response = await request({
        responses: draftResponses(snapshot.values, snapshot.schema),
      });
      if (response.status === 200 && response.data) {
        onSaved(response.data);
      } else {
        await onFailure(response, snapshot);
      }
      const result = {
        response,
        snapshot,
        current: read().revision === snapshot.revision,
      };
      onFinish(result);
      return result;
    };
    const next = chain.then(run, run);
    chain = next.catch(() => undefined);
    return next;
  };
}

/**
 * Ids whose answer differs between the previous snapshot and the current
 * values, along with the snapshot to compare against next time. Answers are
 * compared by their JSON shape because react-hook-form hands back a fresh deep
 * clone on every update, so a multi_select array is never reference-equal to
 * itself. Ids missing from `previous` count as unchanged — the first sighting
 * only seeds the snapshot, so an answer the server flagged is not treated as
 * edited before the hacker has touched it.
 */
export function changedAnswers(
  previous: Record<string, string>,
  values: Record<string, unknown>,
): { snapshot: Record<string, string>; changed: string[] } {
  const snapshot: Record<string, string> = {};
  const changed: string[] = [];
  for (const [id, value] of Object.entries(values)) {
    snapshot[id] = JSON.stringify(value ?? null);
    if (id in previous && previous[id] !== snapshot[id]) changed.push(id);
  }
  return { snapshot, changed };
}

/**
 * Of the questions the server blamed, the ones whose answer has not changed
 * since that request went out. Reporting a failure involves a round trip of its
 * own, so a fix typed in the meantime would otherwise land back on screen as a
 * fresh complaint about an answer that is already correct.
 */
export function stillBlamed(
  blamed: string[],
  sent: Record<string, unknown>,
  current: Record<string, unknown>,
): string[] {
  return blamed.filter(
    (id) =>
      JSON.stringify(sent[id] ?? null) === JSON.stringify(current[id] ?? null),
  );
}
