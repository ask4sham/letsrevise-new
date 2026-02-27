/**
 * PR-PRACTICE-LOOP-1 Frontend: Practice set generation (student-safe).
 */
import api from "../services/api";

export const CONTENT_TYPES = [
  "quiz_mcq",
  "quiz_short",
  "exam_question",
  "past_paper_question",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export type PracticeSetItem = {
  contentType: ContentType;
  contentId: string;
  topicKey: string;
  prompt: string;
  choices?: string[];
  metadata?: {
    difficulty?: number | null;
    skill?: string | null;
    estimatedTimeSec?: number | null;
  };
};

export type GeneratePracticeSetPayload = {
  teacherId: string;
  specKey: string;
  topicKeys: string[];
  limit?: number;
  include?: ContentType[];
  difficulty?: number[];
  skill?: string[];
};

export type GeneratePracticeSetResponse = {
  practiceSetId: string;
  items: PracticeSetItem[];
};

export async function generatePracticeSet(
  payload: GeneratePracticeSetPayload
): Promise<GeneratePracticeSetResponse> {
  const body = {
    teacherId: payload.teacherId,
    specKey: payload.specKey,
    topicKeys: payload.topicKeys,
    limit: payload.limit ?? 10,
    include: payload.include ?? [...CONTENT_TYPES],
    difficulty: payload.difficulty,
    skill: payload.skill,
  };
  const res = await api.post<GeneratePracticeSetResponse>(
    "/practice-sets/generate",
    body
  );
  return res.data;
}
