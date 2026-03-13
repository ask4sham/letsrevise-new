/**
 * PR-PP1: Topic Past Paper Bank API (teacher/admin only).
 */
import api from "../services/api";

export type TopicPastPaper = {
  _id: string;
  ownerId: string;
  topicKey: string;
  title: string;
  status: "draft" | "published";
  sourceType: "url" | "file";
  url?: string;
  file?: {
    fileId: string;
    originalName: string;
    mimeType?: string;
    size?: number;
    sha256?: string;
  };
  year?: number;
  paper?: string;
  session?: string;
  tier?: string;
  type?: string;
  examBoard?: string;
  qualification?: string;
  subject?: string;
  tags?: string[];
  fingerprint?: string;
  officialSource?: boolean;
  officialHost?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ListParams = {
  topicKey: string;
  specKey?: string;
  status?: "draft" | "published" | "all";
  mineOnly?: boolean;
  year?: number | string;
  series?: string;
  tier?: string;
  paper?: string;
};

export async function listTopicPastPapers(params: ListParams): Promise<TopicPastPaper[]> {
  const q = new URLSearchParams();
  q.set("topicKey", params.topicKey);
  if (params.specKey) q.set("specKey", params.specKey);
  if (params.status) q.set("status", params.status);
  if (params.mineOnly) q.set("mineOnly", "1");
  if (params.year != null && params.year !== "") q.set("year", String(params.year));
  if (params.series) q.set("series", params.series);
  if (params.tier) q.set("tier", params.tier);
  if (params.paper) q.set("paper", params.paper);
  const res = await api.get<{ items: TopicPastPaper[] }>(`/topic-past-papers?${q.toString()}`);
  return res.data?.items ?? [];
}

export type BulkPreviewSummary = {
  totalParsed: number;
  validCount: number;
  invalidCount: number;
  duplicatesInPayload: number;
  duplicatesInDb: number;
  wouldCreate: number;
};

export type BulkPreviewResponse = {
  ok: boolean;
  topicKey: string;
  summary: BulkPreviewSummary;
  invalid: Array<{ index: number; reason: string; raw: string }>;
  duplicates: {
    inPayload: Array<{ title?: string; url?: string }>;
    inDb: Array<{ title?: string; url?: string }>;
  };
  previewItems: Array<{
    title: string;
    url: string;
    officialSource?: boolean;
    officialHost?: string;
    year?: number;
    paper?: string;
    session?: string;
    tier?: string;
    type?: string;
    examBoard?: string;
    qualification?: string;
    subject?: string;
    tags?: string[];
    fingerprint?: string;
  }>;
};

export async function previewBulkImportTopicPastPapers(params: {
  topicKey: string;
  specKey?: string;
  format: "json" | "csv";
  text: string;
  dedupeMode?: "skip" | "error" | "allow";
  csvOptions?: { delimiter?: "," | "\t" | ";" };
}): Promise<BulkPreviewResponse> {
  const res = await api.post<BulkPreviewResponse>("/topic-past-papers/bulk/preview", {
    topicKey: params.topicKey,
    specKey: params.specKey,
    format: params.format,
    text: params.text,
    dedupeMode: params.dedupeMode ?? "skip",
    csvOptions: params.csvOptions,
  });
  return res.data!;
}

export type BulkImportItem = {
  title: string;
  url: string;
  year?: number;
  paper?: string;
  session?: string;
  tier?: string;
  type?: string;
  examBoard?: string;
  qualification?: string;
  subject?: string;
  tags?: string[];
};

export async function bulkImportTopicPastPapers(body: {
  topicKey: string;
  specKey?: string;
  items: BulkImportItem[];
  dedupeMode?: "skip" | "error" | "allow";
}): Promise<{
  ok: boolean;
  createdCount: number;
  createdIds: string[];
  skipped: { duplicatesInPayload: number; duplicatesInDb: number; invalid: number };
}> {
  const res = await api.post<{
    ok: boolean;
    createdCount: number;
    createdIds: string[];
    skipped: { duplicatesInPayload: number; duplicatesInDb: number; invalid: number };
  }>("/topic-past-papers/bulk", {
    topicKey: body.topicKey,
    specKey: body.specKey,
    items: body.items,
    dedupeMode: body.dedupeMode ?? "skip",
  });
  return res.data!;
}

export type UploadMetadata = {
  title?: string;
  year?: number;
  paper?: string;
  session?: string;
  tier?: string;
  type?: string;
  examBoard?: string;
  qualification?: string;
  subject?: string;
  tags?: string[];
  dedupeMode?: "skip" | "error" | "allow";
};

export async function uploadTopicPastPapers(params: {
  topicKey: string;
  specKey?: string;
  files: File[];
  metadata?: UploadMetadata;
  /** PR-PAST-PAPERS-UI-1: Must be true after user confirms rights in modal */
  confirmCopyright?: boolean;
}): Promise<{
  ok: boolean;
  createdCount: number;
  createdIds: string[];
  skipped: { duplicatesInPayload: number; duplicatesInDb: number; invalid: number };
  uploaded: { totalFiles: number; acceptedFiles: number; rejectedFiles: number };
  rejected: Array<{ name: string; reason: string }>;
}> {
  const form = new FormData();
  form.append("topicKey", params.topicKey);
  if (params.specKey) form.append("specKey", params.specKey);
  if (params.metadata) {
    form.append("metadata", JSON.stringify(params.metadata));
  }
  form.append("confirmCopyright", params.confirmCopyright === true ? "true" : "false");
  params.files.forEach((f) => form.append("files", f));

  const token = localStorage.getItem("token");
  const apiBase = (process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_URL || "").trim().replace(/\/+$/, "");
  const fullUrl = apiBase ? `${apiBase}/api/topic-past-papers/upload` : "/api/topic-past-papers/upload";

  const res = await fetch(fullUrl, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Upload failed");
  }
  return data;
}

export async function downloadTopicPastPaperFile(fileId: string, filename?: string): Promise<void> {
  const res = await api.get<Blob>(`/topic-past-papers/file/${fileId}`, {
    responseType: "blob",
  });
  const blob = res.data;
  if (!blob) throw new Error("No file received");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "past-paper.pdf";
  a.click();
  URL.revokeObjectURL(url);
}

/** PR-PAST-PAPERS-UI-1: Open uploaded PDF in new tab (copyright-safe "view" instead of "download"). */
export async function viewTopicPastPaperFile(fileId: string): Promise<void> {
  const res = await api.get<Blob>(`/topic-past-papers/file/${fileId}`, {
    responseType: "blob",
  });
  const blob = res.data;
  if (!blob) throw new Error("No file received");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function publishTopicPastPaper(id: string): Promise<TopicPastPaper> {
  const res = await api.post<{ pastPaper: TopicPastPaper }>(`/topic-past-papers/${id}/publish`, {});
  return res.data!.pastPaper;
}

export async function unpublishTopicPastPaper(id: string): Promise<TopicPastPaper> {
  const res = await api.post<{ pastPaper: TopicPastPaper }>(`/topic-past-papers/${id}/unpublish`, {});
  return res.data!.pastPaper;
}

export type BulkPublishResult = { ok: boolean; matchedCount: number; updatedCount: number };

export async function bulkPublishTopicPastPapers(ids: string[]): Promise<BulkPublishResult> {
  const res = await api.post<BulkPublishResult>("/topic-past-papers/bulk/publish", { ids });
  return res.data!;
}

export async function bulkUnpublishTopicPastPapers(ids: string[]): Promise<BulkPublishResult> {
  const res = await api.post<BulkPublishResult>("/topic-past-papers/bulk/unpublish", { ids });
  return res.data!;
}

export async function deleteTopicPastPaper(id: string): Promise<void> {
  await api.delete(`/topic-past-papers/${id}`);
}

/** PR-PP2: Generate past papers from topic bank into lesson (published-only, replace). */
export async function generatePastPapersFromTopic(
  lessonId: string,
  topicKey?: string | null
): Promise<{
  ok: boolean;
  addedCount: number;
  pastPapersCount: number;
  lesson: any;
}> {
  const res = await api.post<{
    ok: boolean;
    addedCount: number;
    pastPapersCount: number;
    lesson: any;
  }>(`/lessons/${lessonId}/generate/past-papers-from-topic`, { topicKey: topicKey ?? undefined });
  return res.data!;
}
