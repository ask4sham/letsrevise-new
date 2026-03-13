/**
 * PR-W4: Worksheet assignment + student attempt API.
 */
import api from "../services/api";

export type Assignment = {
  _id: string;
  worksheetId: string;
  ownerId: string;
  title?: string;
  classCode?: string;
  isActive: boolean;
  shareId: string;
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SharedAssignmentPayload = {
  assignment: { _id: string; title: string; dueAt?: string | null; worksheetId: string; isActive: boolean };
  worksheet: { _id: string; title: string };
  questions: Array<{
    _id: string;
    examQuestionId: string;
    type: string;
    question: string;
    options?: string[];
    marks: number;
  }>;
};

export type AttemptAnswer = {
  examQuestionId: string;
  answerIndex?: number | null;
  shortText?: string;
  awardedMarks?: number | null;
  teacherFeedback?: string;
  markedAt?: string | null;
};

export type Attempt = {
  _id: string;
  assignmentId: string;
  worksheetId: string;
  studentId?: string | null;
  studentName?: string;
  answers: AttemptAnswer[];
  score?: number | null;
  maxScore?: number | null;
  submittedAt?: string | null;
  status: "IN_PROGRESS" | "SUBMITTED" | "MARKED";
  createdAt: string;
  updatedAt: string;
  /** PR-W7: true when results are hidden from student until release */
  resultsLocked?: boolean;
  isReleased?: boolean;
  releasedAt?: string | null;
};

export type ReportSummary = {
  attemptsCount: number;
  submittedCount: number;
  avgScore: number;
  maxScore: number;
};

export type AttemptListItem = {
  _id: string;
  studentName: string;
  status: string;
  score: number;
  maxScore: number;
  submittedAt: string | null;
  updatedAt: string;
  createdAt: string;
  needsMarking?: boolean;
};

export type TeacherAttemptQuestion = {
  _id: string;
  type: string;
  question: string;
  options?: string[];
  marks: number;
  correctIndex?: number;
};

export type TeacherAttemptPayload = {
  attempt: Attempt;
  worksheet?: { _id: string; title: string; questionItems: unknown[] };
  questions: TeacherAttemptQuestion[];
};

/** Create assignment (worksheet must be PUBLISHED). Requires auth. */
export async function createAssignment(body: {
  worksheetId: string;
  title?: string;
  classCode?: string;
  dueAt?: string | null;
}): Promise<Assignment> {
  const { data } = await api.post<{ assignment: Assignment }>("/worksheet-assignments", body);
  return data.assignment;
}

/** List assignments for current user. Requires auth. */
export async function listAssignments(): Promise<Assignment[]> {
  const { data } = await api.get<{ assignments: Assignment[] }>("/worksheet-assignments");
  return data.assignments;
}

/** Get assignment by id. Requires auth (owner/admin). */
export async function getAssignment(id: string): Promise<Assignment> {
  const { data } = await api.get<{ assignment: Assignment }>(`/worksheet-assignments/${id}`);
  return data.assignment;
}

/** Close assignment (set isActive = false). Teacher/admin owner only. PR-W4.3 */
export async function closeAssignment(assignmentId: string): Promise<Assignment> {
  const { data } = await api.post<{ assignment: Assignment }>(`/worksheet-assignments/${assignmentId}/close`);
  return data.assignment;
}

/** Get shared assignment + worksheet + questions by shareId. No auth. */
export async function getSharedAssignment(shareId: string): Promise<SharedAssignmentPayload> {
  const { data } = await api.get<SharedAssignmentPayload>(`/worksheet-assignments/share/${encodeURIComponent(shareId)}`);
  return data;
}

/** Create attempt for shared assignment. No auth. Returns attemptId. */
export async function createAttempt(shareId: string, body?: { studentName?: string }): Promise<string> {
  const { data } = await api.post<{ attemptId: string }>(
    `/worksheet-assignments/share/${encodeURIComponent(shareId)}/attempts`,
    body || {}
  );
  return data.attemptId;
}

/** Get attempt by id. Allowed for anonymous or owner. */
export async function getAttempt(attemptId: string): Promise<Attempt> {
  const { data } = await api.get<{ attempt: Attempt }>(`/worksheet-attempts/${attemptId}`);
  return data.attempt;
}

/** Save in-progress answers. No auth for MVP. */
export async function saveAttempt(attemptId: string, answers: AttemptAnswer[]): Promise<void> {
  await api.post(`/worksheet-attempts/${attemptId}/save`, { answers });
}

/** Submit attempt (locks, scores MCQs). No auth for MVP. */
export async function submitAttempt(attemptId: string, answers: AttemptAnswer[]): Promise<{ attempt: Attempt }> {
  const { data } = await api.post<{ ok: boolean; attempt: Attempt }>(`/worksheet-attempts/${attemptId}/submit`, {
    answers,
  });
  return { attempt: data.attempt! };
}

/** Get report summary for assignment. Teacher/admin only. */
export async function getReportSummary(assignmentId: string): Promise<ReportSummary> {
  const { data } = await api.get<ReportSummary>(`/worksheet-reports/assignment/${assignmentId}/summary`);
  return data;
}

/** List attempts for assignment (teacher/admin, owner only). PR-W4.2 */
export async function getAssignmentAttempts(assignmentId: string): Promise<AttemptListItem[]> {
  const { data } = await api.get<{ attempts: AttemptListItem[] }>(
    `/worksheet-reports/assignment/${assignmentId}/attempts`
  );
  return data.attempts;
}

/** Get attempt + worksheet + questions for teacher view (owner/admin only). PR-W4.2 */
export async function getTeacherAttempt(attemptId: string): Promise<TeacherAttemptPayload> {
  const { data } = await api.get<TeacherAttemptPayload>(`/worksheet-attempts/${attemptId}/teacher`);
  return data;
}

/** Mark short-answer questions (teacher/admin owner only). PR-W5 */
export type MarkItem = { examQuestionId: string; awardedMarks: number; teacherFeedback?: string };

export async function markAttempt(attemptId: string, marks: MarkItem[]): Promise<Attempt> {
  const { data } = await api.post<{ attempt: Attempt }>(`/worksheet-attempts/${attemptId}/mark`, { marks });
  return data.attempt;
}

/** Release results to student (teacher/admin owner only). PR-W7 */
export async function releaseAttempt(attemptId: string): Promise<Attempt> {
  const { data } = await api.post<{ attempt: Attempt }>(`/worksheet-attempts/${attemptId}/release`);
  return data.attempt;
}

/** PR-W6: Needs marking queue item */
export type NeedsMarkingItem = {
  attemptId: string;
  assignmentId: string;
  worksheetId: string;
  worksheetTitle: string;
  assignmentTitle: string;
  studentName: string;
  submittedAt: string | null;
  updatedAt: string;
  unmarkedCount: number;
  totalShortCount: number;
};

/** Get attempts that need marking (teacher/admin; teacher sees own assignments only). PR-W6 */
export async function getNeedsMarking(limit?: number): Promise<NeedsMarkingItem[]> {
  const params = limit != null ? `?limit=${limit}` : "";
  const { data } = await api.get<{ items: NeedsMarkingItem[] }>(`/worksheet-reports/needs-marking${params}`);
  return data.items;
}
