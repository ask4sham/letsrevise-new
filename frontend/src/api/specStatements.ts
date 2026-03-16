/**
 * SpecStatements API — list, ingest spec documents.
 */
import api from "../services/api";

export type SpecStatement = {
  _id: string;
  specKey: string;
  examBoard: string;
  level: string;
  topicKey: string;
  statementCode: string;
  statementText: string;
  statementType?: "core" | "required_practical" | "maths_skill" | "exam_skill" | "other";
  sourceDocumentName?: string | null;
  sourcePageNumber?: number | null;
  sourceSectionHeading?: string | null;
  mainTopicKey?: string | null;
};

export type IngestionSummary = {
  parsedStatements: number;
  mappedStatements: number;
  unmappedStatements: number;
  duplicateStatements: number;
  saved: number;
};

export type IngestionResult = {
  specKey: string;
  sourceDocumentName: string;
  dryRun: boolean;
  summary: IngestionSummary;
  mapped: Array<{
    statementText: string;
    topicKey: string;
    mainTopicKey?: string;
    statementType?: string;
    sourcePageNumber?: number;
    sourceSectionHeading?: string;
  }>;
  unmapped: Array<{
    statementText: string;
    sourcePageNumber?: number;
    sourceSectionHeading?: string;
    reason: string;
  }>;
};

export async function fetchSpecStatements(specKey: string): Promise<SpecStatement[]> {
  const res = await api.get<{ items: SpecStatement[] }>(`/spec-statements/${encodeURIComponent(specKey)}`);
  return res.data.items || [];
}

export async function ingestSpecDocument(params: {
  file: File;
  specKey: string;
  subject?: string;
  dryRun?: boolean;
}): Promise<IngestionResult> {
  const form = new FormData();
  form.append("file", params.file);
  form.append("specKey", params.specKey);
  if (params.subject) form.append("subject", params.subject);
  form.append("dryRun", String(params.dryRun ?? true));

  const res = await api.post<IngestionResult>("/spec-statements/ingest", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
