/**
 * PR-010: AI Coverage API — teacher/admin only.
 * Coverage metrics per topicKey: spec statements, knowledge docs, weak-evidence enquiries.
 */
import api from "../services/api";
import type { SpecKey } from "./taxonomy";

export type SummariesByMode = {
  overview?: number;
  lessonPlan?: number;
  revisionSheet?: number;
  examFocus?: number;
};

export type CoverageRow = {
  topicKey: string;
  specStatementsTotal: number;
  knowledgeDocsSpec: number;
  knowledgeDocsLesson: number;
  knowledgeDocsTotal: number;
  score: number;
  status: "NO_SPEC" | "EMPTY" | "THIN" | "OK" | "STRONG";
  enquiriesTotal: number;
  enquiriesWeakEvidence: number;
  weakRate: number;
  topWeakQuestions?: Array<{ question: string; count: number }>;
  /** PR-028 */
  summariesTotal?: number;
  weakSummariesTotal?: number;
  summariesByMode?: SummariesByMode;
  demandScore?: number;
};

export type CoverageResponse = {
  specKey: string;
  windowDays: number;
  rows: CoverageRow[];
};

export type CoverageSnapshotsResponse = {
  specKey: string;
  computedAt?: string;
  windowDays?: number;
  rows: CoverageRow[];
  hint?: string;
};

export type CoverageTopicsResponse = {
  specKey: string;
  computedAt?: string;
  topicKeys: Array<{
    topicKey: string;
    status: string;
    score: number;
    enquiriesTotal: number;
    enquiriesWeakEvidence: number;
    weakRate: number;
  }>;
  summary?: Record<string, number>;
  hint?: string;
};

const COVERAGE_TIMEOUT_MS = 20000;

export async function getCoverage(params: {
  specKey: SpecKey | string;
  windowDays?: number;
}): Promise<CoverageResponse> {
  const res = await api.get<CoverageResponse>("/coverage", {
    params: { specKey: params.specKey, windowDays: params.windowDays ?? 14 },
    timeout: COVERAGE_TIMEOUT_MS,
  });
  return res.data;
}

export async function getCoverageSnapshots(params: { specKey: SpecKey | string }): Promise<CoverageSnapshotsResponse> {
  const res = await api.get<CoverageSnapshotsResponse>("/coverage/snapshots", {
    params: { specKey: params.specKey, latest: "true" },
    timeout: COVERAGE_TIMEOUT_MS,
  });
  return res.data;
}

export async function getCoverageTopics(params: {
  specKey: SpecKey | string;
  status?: string;
}): Promise<CoverageTopicsResponse> {
  const res = await api.get<CoverageTopicsResponse>("/coverage/topics", {
    params: { specKey: params.specKey, status: params.status },
    timeout: COVERAGE_TIMEOUT_MS,
  });
  return res.data;
}
