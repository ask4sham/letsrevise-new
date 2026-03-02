/**
 * Question bank audit API — same data as SPRINT_ORDER docs (single source of truth).
 */
import api from "../services/api";
import type { SpecKey } from "./taxonomy";

export type QuestionBankAuditRow = {
  subject: string;
  mainTopicTitle: string;
  subTopicTitle: string;
  topicSlug: string;
  topicKey: string;
  topicIndex: number;
  counts: {
    mcq: number;
    short: number;
    flashcards: number;
    examQuestions: number;
    pastPaperQuestions: number;
  };
  status: "EMPTY" | "GAP" | "OK";
  dod: "INCOMPLETE" | "DONE";
};

export type QuestionBankAuditResponse = {
  specKey: SpecKey;
  rows: QuestionBankAuditRow[];
  summary: { emptyCount: number; gapCount: number; okCount: number };
};

/** Audit runs several DB aggregations; allow up to 90s so Content Coverage page can load. */
const COVERAGE_REQUEST_TIMEOUT_MS = 90000;

export async function fetchQuestionBankAudit(specKey: SpecKey): Promise<QuestionBankAuditResponse> {
  const res = await api.get<QuestionBankAuditResponse>("/audit/question-bank", {
    params: { specKey },
    timeout: COVERAGE_REQUEST_TIMEOUT_MS,
  });
  return res.data;
}
