/**
 * PR-W2.3: Dev-only API for 1-click question bank seeding.
 * Requires ENABLE_DEV_TOOLS=1 on backend; teacher or admin.
 */
import api from "../services/api";

export type SeedResult = { topic: string; inserted: number; skipped: boolean };

export type SeedAqaBioResponse = {
  ok: boolean;
  scope?: string;
  results?: SeedResult[];
  msg?: string;
};

/**
 * Trigger AQA GCSE Biology seed by scope.
 * Scopes: cell-biology | cell-biology-batch-a | cell-biology-batch-b | cell-biology-batch-c |
 *         organisation | infection-and-response | bioenergetics | homeostasis-and-response |
 *         inheritance-variation-evolution | ecology | all
 */
export function seedAqaBio(scope: string): Promise<SeedAqaBioResponse> {
  return api
    .post<SeedAqaBioResponse>(`dev/seed/aqa-gcse-biology/${encodeURIComponent(scope)}`)
    .then((res) => res.data);
}
