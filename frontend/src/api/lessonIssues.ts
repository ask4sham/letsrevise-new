/**
 * Lesson issue reports API — submit and manage content issue reports.
 */
import api from "../services/api";

export interface LessonIssueReport {
  id: string;
  lessonId: string;
  lessonTitle: string;
  lessonTopicKey?: string | null;
  lessonTopic?: string | null;
  lessonSubTopic?: string | null;
  pageId?: string | null;
  pageTitle?: string | null;
  pageOrder?: number | null;
  blockId?: string | null;
  reportType: string;
  reportTypeLabel: string;
  description: string;
  suggestedFix?: string;
  reportedByUserId: string;
  reportedByName: string;
  userRole: string;
  status: "open" | "reviewed" | "resolved";
  createdAt: string;
}

/** Deterministic priority for triage (display-only). No AI, no workflow blocking. */
export const REPORT_PRIORITY: Record<string, "high" | "medium" | "low"> = {
  incorrect_information: "high",
  question_incorrect: "high",
  image_problem: "medium",
  other: "medium",
  typo_spelling: "low",
};

export interface ReportStats {
  openCount: number;
  lessonsAffected: number;
  topicsAffected: number;
  resolvedThisWeek: number;
}

export async function getReportStats(): Promise<ReportStats> {
  const { data } = await api.get<ReportStats>("/lesson-issues/stats");
  return data;
}

export interface SubmitReportPayload {
  lessonId: string;
  pageId?: string;
  blockId?: string;
  reportType: string;
  description: string;
  suggestedFix?: string;
}

export async function submitReport(payload: SubmitReportPayload): Promise<{ ok: boolean; id: string }> {
  const { data } = await api.post("/lesson-issues", payload);
  return data;
}

export async function listReports(params?: {
  status?: string;
  lessonId?: string;
  limit?: number;
}): Promise<{ reports: LessonIssueReport[] }> {
  const { data } = await api.get("/lesson-issues", { params });
  return data;
}

export async function updateReportStatus(id: string, status: "open" | "reviewed" | "resolved"): Promise<void> {
  await api.patch(`/lesson-issues/${id}`, { status });
}

export async function deleteReport(id: string): Promise<void> {
  await api.delete(`/lesson-issues/${id}`);
}
