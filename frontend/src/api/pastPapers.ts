/**
 * PR-PAST-PAPERS-API-1: PastPaper model + GET /api/past-papers/mine.
 */
import { getErrorMessageFromData } from "../utils/apiErrorMessage";

export type PastPaper = {
  _id: string;
  specKey: string;
  examBoard: string;
  level: string;
  year: string;
  series?: string | null;
  paperCode: string;
  tier?: string | null;
  title?: string | null;
  pdf?: { mediaId?: string | null; url?: string | null; mimeType?: string | null } | null;
  createdAt?: string;
};

export type FetchMyPastPapersParams = {
  token: string;
  specKey?: string;
  examBoard?: string;
  level?: string;
  year?: string;
  series?: string;
  tier?: string;
  paperCode?: string;
  q?: string;
  limit?: number;
  cursor?: string;
};

export async function fetchMyPastPapers(
  params: FetchMyPastPapersParams
): Promise<{ items: PastPaper[]; nextCursor: string | null }> {
  const url = new URL("/api/past-papers/mine", window.location.origin);

  if (params.specKey) url.searchParams.set("specKey", params.specKey);
  if (params.examBoard) url.searchParams.set("examBoard", params.examBoard);
  if (params.level) url.searchParams.set("level", params.level);
  if (params.year) url.searchParams.set("year", params.year);
  if (params.series) url.searchParams.set("series", params.series);
  if (params.tier) url.searchParams.set("tier", params.tier);
  if (params.paperCode) url.searchParams.set("paperCode", params.paperCode);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.limit != null) url.searchParams.set("limit", String(params.limit));
  if (params.cursor) url.searchParams.set("cursor", params.cursor);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${params.token}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(getErrorMessageFromData(data, "Failed to load past papers"));

  return data as { items: PastPaper[]; nextCursor: string | null };
}
