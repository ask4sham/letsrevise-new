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

export type ConceptPriorityTierRow = {
  id: string;
  name: string;
  taughtCount: number;
  testedCount: number;
  total: number;
};

export type InteractionAuthoritySummary = {
  enabled: boolean;
  profileKey?: string;
  boundaryMode?: number;
  authorizedUsed?: string[];
  blockedRisks?: { blockTitle?: string; blockedKey: string; snippet?: string }[];
  unauthorisedDetected?: string[];
  suggestedReplacements?: {
    blocked: string;
    replaceWith: string;
    replaceTitle: string;
  }[];
  enforce?: boolean;
};

export type GcseReasoningCoverageSummary = {
  enabled: boolean;
  reasoningScorePct: number;
  structureBlocks: number;
  adaptationBlocks: number;
  functionBlocks: number;
  consequenceBlocks: number;
  examBlocks: number;
  fullChainsFound?: number;
  examChainsFound?: number;
  conceptReasoning?: {
    conceptId: string;
    name: string;
    mentionCount: number;
    steps: Record<string, boolean>;
    stepsComplete: number;
    complete: boolean;
  }[];
  gaps?: {
    conceptId: string;
    name: string;
    missingSteps: string[];
    steps: Record<string, boolean>;
    recommendations: string[];
  }[];
  recommendations?: string[];
  warnings?: string[];
};

export type PedagogyCoverageSummary = {
  enabled: boolean;
  pedagogyScorePct: number;
  structureBlocks: number;
  adaptationBlocks: number;
  functionBlocks: number;
  examBlocks: number;
  requiredInteractionsPresent?: Record<string, boolean>;
  tier1ConceptCoverage?: {
    conceptId: string;
    name: string;
    mentionCount: number;
    phasesComplete: number;
    complete: boolean;
  }[];
  gaps: string[];
  warnings: string[];
  hasStructureFunctionTable?: boolean;
  hasMandatoryExam?: boolean;
};

export type ConceptPriorityDistribution = {
  enabled: boolean;
  taxonomyKey?: string;
  tiers: {
    tier: number;
    label: string;
    concepts: ConceptPriorityTierRow[];
    allConcepts?: ConceptPriorityTierRow[];
  }[];
  underrepresented: {
    conceptId: string;
    name: string;
    total: number;
    message: string;
  }[];
  warnings: string[];
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

export type TeacherFirstOpeningCoverageSummary = {
  enabled?: boolean;
  taxonomyKey?: string | null;
  openingScorePct?: number;
  definitionAppearsEarly?: boolean;
  whyItMattersAppearsEarly?: boolean;
  coreModelAppearsEarly?: boolean;
  examVocabularyPresent?: boolean;
  examVocabularyMatched?: string[];
  examVocabularyTotal?: number;
  scenarioBeforeDefinition?: boolean;
  scenarioBeforeCoreKnowledge?: boolean;
  keyExamplesAppearsEarly?: boolean;
  openingTooScenarioHeavy?: boolean;
  definitionDelayed?: boolean;
  coreModelDelayed?: boolean;
  examVocabularyMissing?: boolean;
  flags?: string[];
  warnings?: string[];
};

export type TeachingQualityDimensionScore = {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  signals?: string[];
};

export type TeachingQualityReviewSummary = {
  enabled: boolean;
  totalScore: number;
  maxTotalScore: number;
  scoreLabel: string;
  scorePct: number;
  strengths: string[];
  weaknesses: string[];
  missing: string[];
  present: string[];
  dimensions?: Record<string, TeachingQualityDimensionScore>;
  coreTeachingIndex?: number;
};

export type ConceptCompressionCoverageSummary = {
  enabled: boolean;
  taxonomyKey?: string;
  compressionScorePct: number;
  definitionPresent: boolean;
  whyItMattersPresent: boolean;
  coreModelPresent: boolean;
  examAnchorsCovered: number;
  examAnchorsTotal: number;
  examAnchorsMatched: string[];
  examAnchorsMissing: string[];
  earlyBlockCount?: number;
  gaps?: string[];
  warnings?: string[];
  expectedCompression?: {
    definition: string;
    whyItMatters: string;
    coreModel: string;
    examAnchors: string[];
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
  conceptPriorityDistribution?: ConceptPriorityDistribution;
  pedagogyCoverage?: PedagogyCoverageSummary;
  reasoningCoverage?: GcseReasoningCoverageSummary;
  interactionAuthority?: InteractionAuthoritySummary;
  conceptCompressionCoverage?: ConceptCompressionCoverageSummary;
  teacherFirstOpeningCoverage?: TeacherFirstOpeningCoverageSummary;
  teachingQualityReview?: TeachingQualityReviewSummary;
  generatedAt: string;
};

export async function fetchLessonCoverageReview(lessonId: string): Promise<LessonCoverageReview> {
  const res = await api.get<{ review: LessonCoverageReview }>(
    `/lessons/${encodeURIComponent(lessonId)}/coverage-review`
  );
  return res.data.review;
}
