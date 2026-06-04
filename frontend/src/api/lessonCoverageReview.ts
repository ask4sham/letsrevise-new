/**
 * Teacher Coverage Review — live diagnostics (Phase 4).
 */
import api from "../services/api";

export type CoverageAppearance = {
  label: string;
  detail?: string;
};

export type CoverageReviewConcept = {
  id: string;
  name: string;
  taughtCount?: number;
  testedCount?: number;
  count?: number;
  appearances: CoverageAppearance[];
  isCentral?: boolean;
};

export type CoverageReviewWarning = {
  id: string;
  name: string;
  count: number;
  appearances: CoverageAppearance[];
  suggestedReplacement: string[];
  isCentral?: boolean;
};

export type BoundaryScopeConcept = {
  id: string;
  name: string;
  scope: "in_scope" | "forbidden" | "neighbouring";
};

export type LessonCoverageReview = {
  centralConceptId: string | null;
  centralConceptName: string | null;
  cognitiveSkillBalance: Record<string, number>;
  conceptsTaught: CoverageReviewConcept[];
  conceptsTested: CoverageReviewConcept[];
  overTested: CoverageReviewWarning[];
  underTested: CoverageReviewConcept[];
  hiddenSources: {
    flashcards: number;
    quizDrafts: number;
    practiceExamDrafts: number;
    bankFlashcards: number;
    bankQuizQuestions: number;
    bankExamQuestions: number;
  };
  dominanceWarnings: string[];
  boundaryProfileKey?: string | null;
  boundaryMode?: number;
  boundaryStatus?: string;
  inScopeConcepts?: BoundaryScopeConcept[];
  outOfScopeConcepts?: BoundaryScopeConcept[];
  scopeContaminationScore?: number;
  boundaryWarnings?: string[];
  generatedAt: string;
};

export async function fetchLessonCoverageReview(lessonId: string): Promise<LessonCoverageReview> {
  const res = await api.get<{ review: LessonCoverageReview }>(
    `/lessons/${encodeURIComponent(lessonId)}/coverage-review`
  );
  return res.data.review;
}
