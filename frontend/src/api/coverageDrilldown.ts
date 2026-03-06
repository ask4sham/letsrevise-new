/**
 * PR-013: Coverage drill-down API — missing spec, lessons, weak questions per topic.
 */
import api from "../services/api";
import type { SpecKey } from "./taxonomy";

export type DrilldownMissingStatement = {
  _id?: string;
  statementCode: string;
  statementText: string;
  tier?: string | null;
  tags?: string[];
};

export type DrilldownSpecStatements = {
  total: number;
  indexed: number;
  missing: DrilldownMissingStatement[];
};

export type DrilldownLesson = {
  lessonId: string;
  title: string;
  knowledgeDocs: number;
  lastUpdated: string | null;
  links: { student: string; edit: string };
};

export type DrilldownWeakQuestion = {
  question: string;
  enquiries: number;
};

export type CoverageDrilldownResponse = {
  specKey: string;
  topicKey: string;
  computedAt: string;
  specStatements: DrilldownSpecStatements;
  lessons: DrilldownLesson[];
  weakQuestions: DrilldownWeakQuestion[];
};

export async function getCoverageDrilldown(params: {
  specKey: SpecKey | string;
  topicKey: string;
  windowDays?: number;
}): Promise<CoverageDrilldownResponse> {
  const res = await api.get<CoverageDrilldownResponse>("/coverage/drilldown", {
    params: {
      specKey: params.specKey,
      topicKey: params.topicKey,
      windowDays: params.windowDays ?? 14,
    },
  });
  return res.data;
}
