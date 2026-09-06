import api from "../services/api";

export type SemanticJudgement = "SATISFIED" | "NOT_EVIDENCED" | "CONTRADICTED";

export type SemanticMarkPointResult = {
  index: number;
  markPoint: string;
  judgement: SemanticJudgement;
  awarded: number;
  studentEvidence: string;
  reason: string;
};

export type SemanticMarkShortSuccess = {
  status: "ok";
  score: number;
  maxMarks: number;
  isCorrect: boolean;
  points: SemanticMarkPointResult[];
  feedback: {
    awarded: string[];
    missing: string[];
    contradicted: string[];
  };
  rubricFingerprint?: string;
  markingEngine?: string;
};

export type SemanticMarkShortUnavailable = {
  status: "unavailable";
  code: string;
  message: string;
};

export type SemanticMarkShortError = {
  status: "error";
  code: string;
  message: string;
};

export type SemanticMarkShortResponse =
  | SemanticMarkShortSuccess
  | SemanticMarkShortUnavailable
  | SemanticMarkShortError;

export async function markShortPracticeAnswer(params: {
  lessonId: string;
  questionId: string;
  studentAnswer: string;
  attachmentRefId?: string;
}): Promise<SemanticMarkShortResponse> {
  const res = await api.post<SemanticMarkShortResponse>(
    `/lessons/${params.lessonId}/practice/mark-short`,
    {
      questionId: params.questionId,
      studentAnswer: params.studentAnswer,
      ...(params.attachmentRefId ? { attachmentRefId: params.attachmentRefId } : {}),
    }
  );
  return res.data;
}
