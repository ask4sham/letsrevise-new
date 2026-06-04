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

export type BoundaryAuditFinding = {
  blockId: string;
  blockType: string;
  title?: string;
  location: string;
  primaryConceptId: string | null;
  primaryConceptName: string;
  boundaryStatus: "in_scope" | "neighbouring" | "forbidden" | "unknown";
  severity: "info" | "warning" | "blocker";
  reason: string;
  suggestedAction: string;
  suggestedReplacementFocus?: string;
};

export type BoundaryReplacementPlanItem = {
  originalConceptId: string;
  originalConceptName: string;
  violationType: string;
  suggestedReplacementConceptId: string;
  suggestedReplacementConceptName: string;
  suggestedActivityKind: string;
  cognitiveSkill: string;
  reason: string;
};

export type BoundaryInteractionReplacementPlanItem = {
  originalConceptId: string;
  originalActivityKind: string;
  replacementTemplateKey?: string;
  replacementConceptId: string;
  replacementActivityKind: string;
  replacementBlockType: string;
  title: string;
  instructions: string;
  cards?: string[];
  targets?: string[];
  diagramBrief?: string | null;
  checkpointPrompt?: string | null;
  examFocus?: string | null;
  reason: string;
};

export type ObjectiveBoundarySummary = {
  outOfScopeObjectiveCount: number;
  removedOutOfScopeItems: {
    field: string;
    text: string;
    primaryConceptId: string | null;
    violationType: string | null;
    reason: string | null;
  }[];
  replacementItems: {
    field: string;
    original: string;
    replacement: string;
    primaryConceptId: string | null;
    violationType: string | null;
  }[];
  warnings: string[];
  boundaryMode?: number;
  changed?: boolean;
};

export type LessonBoundaryReplacementPlan = {
  boundaryProfileKey?: string;
  boundaryMode?: number;
  rerouteActive?: boolean;
  reportOnly?: boolean;
  blockedConceptIds?: string[];
  preferredConceptIds?: string[];
  replacementCount?: number;
  replacementPlans?: BoundaryReplacementPlanItem[];
  interactionReplacementPlans?: BoundaryInteractionReplacementPlanItem[];
  interactionRerouteActive?: boolean;
  promptInstructions?: string[];
};

export type LessonBoundaryAudit = {
  boundaryProfileKey: string | null;
  boundaryMode: number;
  scopeContaminationScore: number;
  totalAuditedItems: number;
  inScopeItems: number;
  neighbourItems: number;
  forbiddenItems: number;
  blockFindings: BoundaryAuditFinding[];
  summary: {
    safeToPublish: boolean;
    warnings: string[];
    blockers: string[];
    contaminationLevel?: string;
    assessedCount?: number;
    repairRecommendations?: {
      blockId: string;
      location: string;
      primaryConceptId: string | null;
      suggestedReplacementFocus?: string;
      suggestedAction: string;
    }[];
  };
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
  boundaryAudit?: LessonBoundaryAudit;
  boundaryReplacementPlan?: LessonBoundaryReplacementPlan;
  objectiveBoundary?: ObjectiveBoundarySummary;
  generatedAt: string;
};

export async function fetchLessonCoverageReview(lessonId: string): Promise<LessonCoverageReview> {
  const res = await api.get<{ review: LessonCoverageReview }>(
    `/lessons/${encodeURIComponent(lessonId)}/coverage-review`
  );
  return res.data.review;
}
