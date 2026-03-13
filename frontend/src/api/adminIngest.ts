/**
 * PR-ADMIN-INGEST-UI-1: Admin bulk import — preview (dryRun) and run import.
 * Uses existing POST /api/admin/bulk-import/:type endpoints.
 */

export type IngestType = "flashcards" | "exam-questions" | "past-papers" | "past-paper-questions";

export interface IngestReport {
  specKey: string;
  dryRun: boolean;
  total: number;
  valid: number;
  invalid: number;
  inserted?: number;
  updated?: number;
  skippedDuplicates: number;
  errors: Array<{ index: number; code?: string; message?: string }>;
  preview: Array<{ index: number; action: string; [k: string]: unknown }>;
}

const BASE = "/admin/bulk-import";

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getUrl(path: string): string {
  return path.startsWith("/") ? `/api${path}` : `/api/${path}`;
}

/** Preview: dryRun true. Returns report with errors and would_insert/skip_duplicate. */
export async function previewIngest(params: {
  type: IngestType;
  specKey: string;
  items: Record<string, unknown>[];
}): Promise<IngestReport> {
  const path = `${BASE}/${typeToPath(params.type)}`;
  const url = getUrl(path);
  const res = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      specKey: params.specKey,
      items: params.items,
      dryRun: true,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Preview failed");
  return data as IngestReport;
}

/** Run import: dryRun false. Returns report with inserted/skipped counts. */
export async function runIngest(params: {
  type: IngestType;
  specKey: string;
  items: Record<string, unknown>[];
}): Promise<IngestReport> {
  const path = `${BASE}/${typeToPath(params.type)}`;
  const url = getUrl(path);
  const res = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      specKey: params.specKey,
      items: params.items,
      dryRun: false,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Import failed");
  return data as IngestReport;
}

function typeToPath(type: IngestType): string {
  const map: Record<IngestType, string> = {
    flashcards: "flashcards",
    "exam-questions": "exam-questions",
    "past-papers": "past-papers",
    "past-paper-questions": "past-paper-questions",
  };
  return map[type] || type;
}
