/**
 * PR-PAST-PAPERS-UI-3: Exam question bank — list mine, attach from bank.
 */

export type ExamQuestion = {
  _id: string;
  specKey?: string;
  topicKey: string;
  question: string;
  marks?: number | null;
  markScheme?: string[];
  type?: string;
  difficulty?: number | null;
  skill?: string | null;
  estimatedTimeSec?: number | null;
};

export type ExamQuestionFilters = {
  difficulty?: number;
  difficultyMin?: number;
  difficultyMax?: number;
  skill?: string;
  estimatedTimeMaxSec?: number;
};

export async function fetchMyExamQuestions(params: {
  token: string;
  specKey: string;
  topicKey?: string;
  q?: string;
  limit?: number;
  difficulty?: number;
  difficultyMin?: number;
  difficultyMax?: number;
  skill?: string;
  estimatedTimeMaxSec?: number;
}): Promise<{ items: ExamQuestion[] }> {
  const url = new URL("/api/exam-questions/mine", window.location.origin);
  url.searchParams.set("specKey", params.specKey);
  if (params.topicKey) url.searchParams.set("topicKey", params.topicKey);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.difficulty != null) url.searchParams.set("difficulty", String(params.difficulty));
  if (params.difficultyMin != null) url.searchParams.set("difficultyMin", String(params.difficultyMin));
  if (params.difficultyMax != null) url.searchParams.set("difficultyMax", String(params.difficultyMax));
  if (params.skill) url.searchParams.set("skill", params.skill);
  if (params.estimatedTimeMaxSec != null) url.searchParams.set("estimatedTimeMaxSec", String(params.estimatedTimeMaxSec));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${params.token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to load exam questions");
  return data as { items: ExamQuestion[] };
}

export async function attachFromBank(params: {
  token: string;
  pastPaperId: string;
  examQuestionIds: string[];
  overrides?: Array<{ examQuestionId: string; questionNumber?: string; marks?: number }>;
}): Promise<{
  total: number;
  inserted: number;
  skippedDuplicates: number;
  invalid: number;
  errors: Array<{ examQuestionId: string; code: string; message?: string }>;
  preview: Array<{ examQuestionId: string; action: string }>;
}> {
  const res = await fetch("/api/past-paper-questions/attach-from-bank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pastPaperId: params.pastPaperId,
      examQuestionIds: params.examQuestionIds,
      overrides: params.overrides || [],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Attach failed");
  return data;
}
