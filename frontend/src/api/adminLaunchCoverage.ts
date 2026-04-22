import api from "../services/api";
import type { SpecKey } from "./taxonomy";

export type LaunchCoverageRow = {
  specKey: string;
  topicKey: string;
  topicLabel: string;
  publishedLessonCount: number;
  publishedQuizCount: number;
  publishedExamCount: number;
  publishedFlashcardCount: number;
  status: "ready" | "partial" | "missing";
  missingSummary: string | null;
};

export async function fetchAdminTopicLaunchCoverage(specKey: SpecKey): Promise<LaunchCoverageRow[]> {
  const res = await api.get<LaunchCoverageRow[]>("/admin/coverage/topic-summary", {
    params: { specKey },
  });
  return res.data ?? [];
}
