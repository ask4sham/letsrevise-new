/**
 * PR-PAST-PAPERS-UI-2: Past paper questions — GET mine, POST (single create), POST link.
 */
export type PastPaperQuestionItem = {
  _id: string;
  pastPaperId: string;
  specKey: string;
  topicKey: string;
  questionNumber?: string | null;
  marks?: number | null;
  question: string;
  markScheme: string[];
  assets?: Array<{ type?: string; mediaId?: string | null; url?: string | null; alt?: string | null }>;
  createdAt?: string;
  difficulty?: number | null;
  skill?: string | null;
  estimatedTimeSec?: number | null;
};

export type PastPaperQuestionFilters = {
  difficulty?: number;
  difficultyMin?: number;
  difficultyMax?: number;
  skill?: string;
};

export async function fetchPastPaperQuestions(
  pastPaperId: string,
  token: string,
  filters?: PastPaperQuestionFilters
): Promise<{ items: PastPaperQuestionItem[] }> {
  const url = new URL("/api/past-paper-questions/mine", window.location.origin);
  url.searchParams.set("pastPaperId", pastPaperId);
  if (filters?.difficulty != null) url.searchParams.set("difficulty", String(filters.difficulty));
  if (filters?.difficultyMin != null) url.searchParams.set("difficultyMin", String(filters.difficultyMin));
  if (filters?.difficultyMax != null) url.searchParams.set("difficultyMax", String(filters.difficultyMax));
  if (filters?.skill) url.searchParams.set("skill", filters.skill);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to load questions");
  return data as { items: PastPaperQuestionItem[] };
}

export type CreatePastPaperQuestionParams = {
  token: string;
  pastPaperId: string;
  topicKey: string;
  questionNumber?: string;
  marks?: number | null;
  question: string;
  markScheme: string;
  assets?: Array<{ type?: string; mediaId?: string | null; url?: string | null; alt?: string | null }>;
  difficulty?: number | null;
  skill?: string | null;
  estimatedTimeSec?: number | null;
};

export async function createPastPaperQuestion(params: CreatePastPaperQuestionParams): Promise<{
  item: PastPaperQuestionItem;
  deduped: boolean;
}> {
  const res = await fetch("/api/past-paper-questions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pastPaperId: params.pastPaperId,
      topicKey: params.topicKey,
      questionNumber: params.questionNumber || null,
      marks: params.marks ?? null,
      question: params.question,
      markScheme: params.markScheme,
      assets: params.assets || [],
      difficulty: params.difficulty ?? null,
      skill: params.skill ?? null,
      estimatedTimeSec: params.estimatedTimeSec ?? null,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to create question");
  return data as { item: PastPaperQuestionItem; deduped: boolean };
}

export type LinkQuestionItem = {
  topicKey: string;
  questionNumber?: string;
  marks?: number;
  question: string;
  markScheme?: string | string[];
};

export async function linkPastPaperQuestions(
  pastPaperId: string,
  specKey: string,
  items: LinkQuestionItem[],
  token: string
): Promise<{ linked: number; pastPaperId: string }> {
  const res = await fetch("/api/past-paper-questions/link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pastPaperId, specKey, items }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to link questions");
  return data as { linked: number; pastPaperId: string };
}
