/**
 * Phase 1: CSV import API for Flashcards and Exam Questions.
 */

import { getErrorMessageFromData } from "../utils/apiErrorMessage";

export interface CsvImportResult {
  dryRun: boolean;
  summary: {
    parsedRows: number;
    validRows: number;
    importedRows: number;
    skippedRows: number;
    duplicateRows: number;
    invalidRows: number;
  };
  errors: Array<{
    rowNumber: number;
    reason: string;
    row: Record<string, string> | null;
  }>;
  sampleImported?: Array<{ front?: string; back?: string; question?: string; topicKey?: string }>;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getUrl(path: string): string {
  return path.startsWith("/") ? `/api${path}` : `/api/${path}`;
}

/** Import flashcards from CSV file. */
export async function importFlashcardsCsv(params: {
  file: File;
  dryRun?: boolean;
  defaultSpecKey?: string;
  defaultTopicKey?: string;
}): Promise<CsvImportResult> {
  const form = new FormData();
  form.append("file", params.file);
  form.append("dryRun", String(!!params.dryRun));
  if (params.defaultSpecKey) form.append("defaultSpecKey", params.defaultSpecKey);
  if (params.defaultTopicKey) form.append("defaultTopicKey", params.defaultTopicKey);

  const res = await fetch(getUrl("/import/flashcards/csv"), {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Import failed");
  return data as CsvImportResult;
}

/** Import exam questions from CSV file. */
export async function importExamQuestionsCsv(params: {
  file: File;
  dryRun?: boolean;
  defaultSpecKey?: string;
  defaultTopicKey?: string;
}): Promise<CsvImportResult> {
  const form = new FormData();
  form.append("file", params.file);
  form.append("dryRun", String(!!params.dryRun));
  if (params.defaultSpecKey) form.append("defaultSpecKey", params.defaultSpecKey);
  if (params.defaultTopicKey) form.append("defaultTopicKey", params.defaultTopicKey);

  const res = await fetch(getUrl("/import/exam-questions/csv"), {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(getErrorMessageFromData(data, "Import failed"));
  return data as CsvImportResult;
}

/** Download flashcards CSV template. */
export async function downloadFlashcardsTemplate(): Promise<void> {
  const res = await fetch(getUrl("/import/templates/flashcards-csv"), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to download template");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "flashcards-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** Download exam questions CSV template. */
export async function downloadExamQuestionsTemplate(): Promise<void> {
  const res = await fetch(getUrl("/import/templates/exam-questions-csv"), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to download template");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "exam-questions-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}
