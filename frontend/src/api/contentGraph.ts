/**
 * Content Graph API — topic/lesson graph, coverage, rebuild.
 * Teacher/admin only.
 */
import api from "../services/api";

/** TopicCoverageRow: per-topic coverage from spec-coverage API. */
export type TopicCoverageRow = {
  lessonCount: number;
  flashcardCount: number;
  quizCount: number;
  examQuestionCount: number;
  issueCount?: number;
  coverageScore: number;
  status: "weak" | "partial" | "strong";
  weakAreas: string[];
  unit?: string;
  unitKey?: string;
  specKey?: string;
  topicKey?: string;
};

export type TopicCoverage = TopicCoverageRow;

export type SpecCoverageResponse = {
  specKey: string;
  topics: TopicCoverageRow[];
  totalTopics: number;
};

export type LessonGraphResponse = {
  lessonNode: { _id: string } | null;
  topicNodes: Array<{ _id: string; title?: string; topicKey?: string }>;
  lesson: { _id: string; title?: string; topicKey?: string; specKey?: string };
};

/** Get full spec coverage (all topics with counts and scores). GET /api/content-graph/spec-coverage/:specKey */
export async function fetchSpecCoverage(specKey: string): Promise<SpecCoverageResponse> {
  const res = await api.get<SpecCoverageResponse>(`/content-graph/spec-coverage/${encodeURIComponent(specKey)}`);
  return res.data;
}

/** Get single topic coverage. GET /api/content-graph/coverage/:specKey/:topicKey */
export async function fetchTopicCoverage(
  specKey: string,
  topicKey: string
): Promise<TopicCoverage> {
  const res = await api.get<TopicCoverage>(
    `/content-graph/coverage/${encodeURIComponent(specKey)}/${encodeURIComponent(topicKey)}`
  );
  return res.data;
}

/** Get lesson graph: lesson node + linked topics. GET /api/content-graph/lesson/:lessonId */
export async function fetchLessonGraph(lessonId: string): Promise<LessonGraphResponse> {
  const res = await api.get<LessonGraphResponse>(`/content-graph/lesson/${encodeURIComponent(lessonId)}`);
  return res.data;
}

/** Rebuild graph for a lesson. POST /api/content-graph/rebuild/lesson/:lessonId */
export async function rebuildLessonGraph(lessonId: string): Promise<{ ok: boolean; lessonNode?: string }> {
  const res = await api.post<{ ok: boolean; lessonNode?: string }>(`/content-graph/rebuild/lesson/${lessonId}`);
  return res.data;
}

/** Rebuild graph for a topic. POST /api/content-graph/rebuild/topic body: { specKey, topicKey } */
export async function rebuildTopicGraph(specKey: string, topicKey: string): Promise<{
  ok: boolean;
  topicNode?: string;
  lessonCount: number;
  flashcardCount: number;
  quizCount: number;
  examCount: number;
}> {
  const res = await api.post("/content-graph/rebuild/topic", { specKey, topicKey });
  return res.data;
}

/** Rebuild graph for all topics in a spec. POST /api/content-graph/rebuild/spec/:specKey */
export async function rebuildSpecGraph(specKey: string): Promise<{
  ok: boolean;
  specKey: string;
  topicsRebuilt: number;
  lessonLinksCreated: number;
  flashcardLinksCreated: number;
}> {
  const res = await api.post(`/content-graph/rebuild/spec/${encodeURIComponent(specKey)}`);
  return res.data;
}

/** Topic gap analysis (Curriculum Gap Detection) */
export type TopicGap = {
  specKey: string;
  topicKey: string;
  topicTitle: string;
  unit?: string;
  unitKey?: string;
  counts: { lessons: number; flashcards: number; quizzes: number; examQuestions: number; openIssues: number };
  coverageScore: number;
  coverageStatus: "weak" | "partial" | "strong";
  weakAreas: string[];
  gapFlags: {
    missingLesson: boolean;
    lowFlashcards: boolean;
    lowQuizzes: boolean;
    lowExamQuestions: boolean;
    highIssueRate: boolean;
    unresolvedMappings: boolean;
  };
  priorityScore: number;
  recommendations: string[];
  suggestedActions: Array<{ type: string; label: string; reason: string }>;
  summaryParagraph?: string;
};

export type SpecGapsResponse = {
  specKey: string;
  summary: {
    totalTopics: number;
    weakTopics: number;
    partialTopics: number;
    strongTopics: number;
    highestPriorityCount: number;
  };
  gaps: TopicGap[];
};

/** Get spec-level gap analysis. GET /api/content-graph/gaps/:specKey */
export async function fetchSpecGaps(specKey: string): Promise<SpecGapsResponse> {
  const res = await api.get<SpecGapsResponse>(`/content-graph/gaps/${encodeURIComponent(specKey)}`);
  return res.data;
}

/** Get single topic gap analysis. GET /api/content-graph/gaps/:specKey/:topicKey */
export async function fetchTopicGap(specKey: string, topicKey: string): Promise<TopicGap> {
  const res = await api.get<TopicGap>(
    `/content-graph/gaps/${encodeURIComponent(specKey)}/${encodeURIComponent(topicKey)}`
  );
  return res.data;
}

/** Topic Evidence — learning evidence per topic */
export type TopicEvidence = {
  specKey: string;
  topicKey: string;
  topicTitle: string;
  evidenceCounts: {
    lessonIssues: number;
    teacherRevisions: number;
    autopilotRuns: number;
    autopilotApprovals: number;
    autopilotRejections: number;
  };
  evidenceSignals: {
    hasOpenIssues: boolean;
    hasHighIssueVolume: boolean;
    hasTeacherRevisionActivity: boolean;
    hasAutopilotHistory: boolean;
    hasLowApprovalRate: boolean;
  };
  derivedMetrics: {
    approvalRate: number | null;
    issueRateLevel: "low" | "medium" | "high";
    evidenceHealth: "strong" | "mixed" | "weak" | "unknown";
  };
  blockers: string[];
  recommendations: string[];
  summary: string;
};

export type SpecEvidenceResponse = {
  specKey: string;
  summary: {
    totalTopics: number;
    strongTopics: number;
    mixedTopics: number;
    weakTopics: number;
    unknownTopics: number;
  };
  topics: TopicEvidence[];
};

/** Get spec-level evidence. GET /api/content-graph/evidence/:specKey */
export async function fetchSpecEvidence(specKey: string): Promise<SpecEvidenceResponse> {
  const res = await api.get<SpecEvidenceResponse>(`/content-graph/evidence/${encodeURIComponent(specKey)}`);
  return res.data;
}

/** Get single topic evidence. GET /api/content-graph/evidence/:specKey/:topicKey */
export async function fetchTopicEvidence(specKey: string, topicKey: string): Promise<TopicEvidence> {
  const res = await api.get<TopicEvidence>(
    `/content-graph/evidence/${encodeURIComponent(specKey)}/${encodeURIComponent(topicKey)}`
  );
  return res.data;
}

/** Student Learning Evidence — aggregated learning outcomes per topic */
export type TopicLearningEvidence = {
  specKey: string;
  topicKey: string;
  quizStats: { attempts: number; correct: number; accuracy: number | null };
  flashcardStats: { reviews: number; averageDifficulty: number | null };
  examStats: { attempts: number; correct: number; accuracy: number | null };
  lessonStats: { completions: number; averageTimeSpent: number | null };
  derivedMetrics: { masteryScore: number | null; difficultyLevel: string };
};

export type SpecLearningEvidenceResponse = {
  specKey: string;
  topics: TopicLearningEvidence[];
};

/** Get spec-level learning evidence. GET /api/content-graph/learning-evidence/:specKey */
export async function fetchSpecLearningEvidence(specKey: string): Promise<SpecLearningEvidenceResponse> {
  const res = await api.get<SpecLearningEvidenceResponse>(
    `/content-graph/learning-evidence/${encodeURIComponent(specKey)}`
  );
  return res.data;
}

/** Get single topic learning evidence. GET /api/content-graph/learning-evidence/:specKey/:topicKey */
export async function fetchTopicLearningEvidence(
  specKey: string,
  topicKey: string
): Promise<TopicLearningEvidence> {
  const res = await api.get<TopicLearningEvidence>(
    `/content-graph/learning-evidence/${encodeURIComponent(specKey)}/${encodeURIComponent(topicKey)}`
  );
  return res.data;
}

/** Topic Command Center — unified operational view per topic */
export type TopicRecommendedAction = {
  action: string;
  label: string;
  reason: string;
};

export type TopicCommandCenter = {
  specKey: string;
  topicKey: string;
  topicTitle: string;
  taxonomy: {
    subject: string;
    spec: string;
    mainTopic: string;
    section: string | null;
    topic: string;
  };
  curriculum: {
    specStatementsCount: number;
    specStatements: Array<{ statementCode: string; statementText: string; tier?: string }>;
  };
  draftLibrary?: {
    flashcards: number;
    examQuestions: number;
    lastGeneratedAt: string | null;
  };
  coverage: {
    lessons: number;
    flashcards: number;
    quizzes: number;
    examQuestions: number;
    coverageScore: number;
  };
  gapAnalysis: {
    priorityScore: number;
    gapStatus: string;
  };
  readiness: {
    ready: boolean;
    blockers: string[];
    availableActions: string[];
  };
  evidenceHealth: {
    evidenceHealth: string;
    openIssues: number;
    teacherRevisions: number;
    approvalRate: number | null;
  };
  evidenceReview: {
    gateStatus: string;
    reasons: string[];
    priorityScore: number;
  };
  learningEvidence: {
    masteryScore: number | null;
    difficultyLevel: string;
    quizAccuracy: number | null;
    examAccuracy: number | null;
    flashcardDifficulty: number | null;
    lessonCompletions: number;
  };
  autopilot: {
    runs: number;
    lastRunDate: string | null;
    generatedFlashcards: number;
    generatedQuizzes: number;
    generatedExamQuestions: number;
    avgCoverageLift: number | null;
  };
  promptPackPerformance: Array<{
    promptPackId: string;
    promptPackVersion: string;
    approvalRate: number | null;
    runs: number;
    avgCoverageLift: number | null;
  }>;
  recommendedActions: TopicRecommendedAction[];
  safeMode?: {
    enabled: boolean;
    evidenceSample: { autopilotRuns: number; reviewedItems: number; quizAttempts: number };
    thresholds: { autopilotRuns: number; reviewedItems: number; quizAttempts: number };
  };
};

/** Get Topic Command Center. GET /api/content-graph/topic-command/:specKey/:topicKey */
export async function fetchTopicCommandCenter(
  specKey: string,
  topicKey: string
): Promise<TopicCommandCenter> {
  const res = await api.get<TopicCommandCenter>(
    `/content-graph/topic-command/${encodeURIComponent(specKey)}/${encodeURIComponent(topicKey)}`
  );
  return res.data;
}

/** Evidence Review Worklist — blocked/review_required topics */
export type EvidenceReviewRecommendedAction = {
  type: "review_content" | "inspect_rejections" | "fix_topic_mapping" | "resolve_open_issues" | "improve_prompt_pack" | "rebuild_graph";
  label: string;
  reason: string;
};

export type EvidenceReviewItem = {
  specKey: string;
  topicKey: string;
  topicTitle: string;
  gateStatus: "review_required" | "block";
  evidenceHealth: "weak" | "mixed" | "unknown" | "strong";
  priorityScore: number;
  reasons: string[];
  evidenceSummary: {
    openIssues: number;
    teacherRevisions: number;
    approvalRate: number | null;
    autopilotRuns: number;
    autopilotRejections: number;
  };
  recommendedActions: EvidenceReviewRecommendedAction[];
  summary: string;
};

export type EvidenceReviewResponse = {
  specKey: string;
  summary: {
    totalItems: number;
    blockedItems: number;
    reviewRequiredItems: number;
  };
  items: EvidenceReviewItem[];
};

/** Get evidence review worklist. GET /api/content-graph/evidence-review/:specKey */
export async function fetchEvidenceReviewWorklist(specKey: string): Promise<EvidenceReviewResponse> {
  const res = await api.get<EvidenceReviewResponse>(
    `/content-graph/evidence-review/${encodeURIComponent(specKey)}`
  );
  return res.data;
}

/** Get single evidence review item. GET /api/content-graph/evidence-review/:specKey/:topicKey */
export async function fetchEvidenceReviewItem(specKey: string, topicKey: string): Promise<EvidenceReviewItem | null> {
  try {
    const res = await api.get<EvidenceReviewItem>(
      `/content-graph/evidence-review/${encodeURIComponent(specKey)}/${encodeURIComponent(topicKey)}`
    );
    return res.data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

/** Autopilot Gate — evidence-aware gating decision */
export type AutopilotGate = {
  specKey: string;
  topicKey: string;
  gateStatus: "allow" | "limited" | "review_required" | "block";
  reasons: string[];
  allowedActions: string[];
  blockedActions: string[];
  summary: string;
};

/** Curriculum Autopilot — topic-level */
export type AutopilotTopicResult = {
  specKey: string;
  topicKey: string;
  topicTitle: string;
  dryRun: boolean;
  gapSummary: { counts?: Record<string, number>; coverageScore?: number; coverageStatus?: string; gapFlags?: Record<string, boolean>; priorityScore?: number } | null;
  plannedActions: string[];
  executedActions: Array<{
    type: string;
    status: "generated" | "skipped" | "failed" | "planned";
    createdCount?: number;
    reason?: string;
    ids?: string[];
  }>;
  graphRebuilt: boolean;
  updatedCoverage: { lessonCount?: number; flashcardCount?: number; quizCount?: number; examQuestionCount?: number; coverageScore?: number; status?: string; weakAreas?: string[] } | null;
  requiresReview: boolean;
  gateStatus?: "allow" | "limited" | "review_required" | "block";
  gateReasons?: string[];
  allowedActions?: string[];
  blockedActions?: string[];
  gateSummary?: string;
  error?: string;
};

/** Prompt pack for autopilot selection */
export type AutopilotPromptPack = {
  promptPackId: string;
  promptPackVersion: string;
  label: string;
  generatorMode?: string;
  isDefault?: boolean;
  isActive?: boolean;
};

/** Get available prompt packs. GET /api/content-graph/autopilot/prompt-packs */
export async function fetchAutopilotPromptPacks(): Promise<{ promptPacks: AutopilotPromptPack[] }> {
  const res = await api.get<{ promptPacks: AutopilotPromptPack[] }>("/content-graph/autopilot/prompt-packs");
  return res.data;
}

/** Autopilot Experiment */
export type AutopilotExperiment = {
  _id: string;
  experimentId: string;
  label: string;
  description?: string;
  specKey?: string | null;
  topicKey?: string | null;
  promptPacks: Array<{ promptPackId: string; promptPackVersion: string; weight?: number }>;
  assignmentMode: "round_robin" | "weighted_random";
  status: "active" | "paused" | "archived";
  createdAt?: string;
  updatedAt?: string;
};

export type ExperimentPerformancePack = {
  promptPackId: string;
  promptPackVersion: string;
  runs: number;
  liveRuns: number;
  generatedItems: number;
  approvedItems: number;
  rejectedItems: number;
  approvalRate: number | null;
  avgCoverageLift: number | null;
};

export type ExperimentPerformance = {
  experimentId: string;
  label: string;
  description?: string;
  status: string;
  promptPacks: ExperimentPerformancePack[];
};

/** GET /api/content-graph/autopilot/experiments */
export async function fetchAutopilotExperiments(status?: string): Promise<{ experiments: AutopilotExperiment[] }> {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await api.get<{ experiments: AutopilotExperiment[] }>(`/content-graph/autopilot/experiments${params}`);
  return res.data;
}

/** POST /api/content-graph/autopilot/experiments */
export async function createAutopilotExperiment(payload: {
  experimentId: string;
  label: string;
  description?: string;
  specKey?: string;
  topicKey?: string;
  promptPacks: Array<{ promptPackId: string; promptPackVersion: string; weight?: number }>;
  assignmentMode?: "round_robin" | "weighted_random";
}): Promise<AutopilotExperiment> {
  const res = await api.post<AutopilotExperiment>("/content-graph/autopilot/experiments", payload);
  return res.data;
}

/** PATCH /api/content-graph/autopilot/experiments/:id */
export async function updateAutopilotExperiment(
  id: string,
  payload: { status?: "active" | "paused" | "archived"; label?: string; description?: string }
): Promise<AutopilotExperiment> {
  const res = await api.patch<AutopilotExperiment>(`/content-graph/autopilot/experiments/${encodeURIComponent(id)}`, payload);
  return res.data;
}

/** GET /api/content-graph/autopilot/experiments/:id/results */
export async function fetchExperimentResults(id: string): Promise<ExperimentPerformance> {
  const res = await api.get<ExperimentPerformance>(`/content-graph/autopilot/experiments/${encodeURIComponent(id)}/results`);
  return res.data;
}

/** Get autopilot gate for a topic. GET /api/content-graph/autopilot/gate/:specKey/:topicKey */
export async function fetchAutopilotGate(specKey: string, topicKey: string): Promise<AutopilotGate> {
  const res = await api.get<AutopilotGate>(
    `/content-graph/autopilot/gate/${encodeURIComponent(specKey)}/${encodeURIComponent(topicKey)}`
  );
  return res.data;
}

/** Run autopilot for one topic. POST /api/content-graph/autopilot/topic */
export async function runTopicAutopilot(params: {
  specKey: string;
  topicKey: string;
  dryRun?: boolean;
  actions?: string[];
  promptPackId?: string;
  promptPackVersion?: string;
}): Promise<AutopilotTopicResult> {
  const res = await api.post<AutopilotTopicResult>("/content-graph/autopilot/topic", params);
  return res.data;
}

/** Curriculum Autopilot — spec-level */
export type AutopilotSpecResult = {
  specKey: string;
  dryRun: boolean;
  totalProcessed: number;
  results: AutopilotTopicResult[];
  summary: { generated: number; skipped: number; failed: number };
};

/** Run autopilot for a spec. POST /api/content-graph/autopilot/spec */
export async function runSpecAutopilot(params: {
  specKey: string;
  dryRun?: boolean;
  limit?: number;
  minPriorityScore?: number;
  promptPackId?: string;
  promptPackVersion?: string;
}): Promise<AutopilotSpecResult> {
  const res = await api.post<AutopilotSpecResult>("/content-graph/autopilot/spec", params);
  return res.data;
}

/** Draft Question Library — bulk generation per SpecStatement (copyright-safe: SpecStatements only) */

export type DraftLibraryTopicResult = {
  topicKey?: string;
  specKey?: string;
  dryRun: boolean;
  skipped?: boolean;
  reason?: string;
  statementsUsed: number;
  flashcardsGenerated: number;
  examQuestionsGenerated: number;
  duplicatesSkipped: number;
  errors?: Array<{ statementCode: string; message: string }>;
};

export type DraftLibrarySpecResult = {
  specKey: string;
  dryRun: boolean;
  topicsProcessed: number;
  flashcardsGenerated: number;
  examQuestionsGenerated: number;
  duplicatesSkipped: number;
  skippedTopics: Array<{ topicKey: string; reason: string }>;
  results?: DraftLibraryTopicResult[];
  error?: string;
};

/** Generate draft library for a topic. POST /api/content-graph/draft-library/topic */
export async function generateDraftLibraryForTopic(params: {
  specKey: string;
  topicKey: string;
  dryRun?: boolean;
  promptPackId?: string;
  promptPackVersion?: string;
  limitFlashcards?: number;
  limitExamQuestions?: number;
}): Promise<DraftLibraryTopicResult> {
  const res = await api.post<DraftLibraryTopicResult>("/content-graph/draft-library/topic", params);
  return res.data;
}

/** Generate draft library for a spec. POST /api/content-graph/draft-library/spec */
export async function generateDraftLibraryForSpec(params: {
  specKey: string;
  topicKeys?: string[];
  limitPerTopic?: number;
  dryRun?: boolean;
  promptPackId?: string;
  promptPackVersion?: string;
  limitFlashcards?: number;
  limitExamQuestions?: number;
}): Promise<DraftLibrarySpecResult> {
  const res = await api.post<DraftLibrarySpecResult>("/content-graph/draft-library/spec", params);
  return res.data;
}

/** Preview planned autopilot actions for a spec. GET /api/content-graph/autopilot/spec/:specKey/preview */
export async function previewSpecAutopilot(
  specKey: string,
  limit?: number,
  minPriorityScore?: number
): Promise<{ specKey: string; previews: Array<{ topicKey: string; topicTitle: string; plannedActions: string[]; requiresReview: boolean; counts?: Record<string, number>; priorityScore?: number }> }> {
  const params = new URLSearchParams();
  if (limit != null) params.set("limit", String(limit));
  if (minPriorityScore != null) params.set("minPriorityScore", String(minPriorityScore));
  const qs = params.toString();
  const res = await api.get(`/content-graph/autopilot/spec/${encodeURIComponent(specKey)}/preview${qs ? `?${qs}` : ""}`);
  return res.data;
}

/** Autopilot Readiness Diagnostics */
export type TopicReadiness = {
  specKey: string;
  topicKey: string;
  topicTitle: string;
  ready: boolean;
  requiresReview: boolean;
  counts: { lessons?: number; flashcards?: number; quizzes?: number; examQuestions?: number; openIssues?: number };
  readinessFlags: {
    hasSpecStatements: boolean;
    lowIssues: boolean;
    hasTopicNode: boolean;
    canGenerateFlashcards: boolean;
    canGenerateQuiz: boolean;
    canGenerateExamQuestions: boolean;
  };
  blockers: string[];
  recommendedActions: string[];
  autopilotActionsAvailable: string[];
  summary: string;
};

export type SpecReadinessResponse = {
  specKey: string;
  summary: { totalTopics: number; readyTopics: number; blockedTopics: number; requiresReviewTopics: number };
  topics: TopicReadiness[];
};

/** Get spec-level autopilot readiness. GET /api/content-graph/autopilot/readiness/:specKey */
export async function fetchSpecAutopilotReadiness(specKey: string): Promise<SpecReadinessResponse> {
  const res = await api.get<SpecReadinessResponse>(`/content-graph/autopilot/readiness/${encodeURIComponent(specKey)}`);
  return res.data;
}

/** Get single topic autopilot readiness. GET /api/content-graph/autopilot/readiness/:specKey/:topicKey */
export async function fetchTopicAutopilotReadiness(
  specKey: string,
  topicKey: string
): Promise<TopicReadiness> {
  const res = await api.get<TopicReadiness>(
    `/content-graph/autopilot/readiness/${encodeURIComponent(specKey)}/${encodeURIComponent(topicKey)}`
  );
  return res.data;
}

/** Autopilot Approval Queue */
export type AutopilotDraftItem = {
  itemType: "flashcard" | "quizQuestion" | "examQuestion";
  itemId: string;
  specKey: string;
  topicKey: string;
  topicTitle: string;
  titlePreview: string;
  contentPreview: string;
  status: string;
  generatedBy: string;
  createdAt: string;
  readinessSummary?: unknown;
  gapSummary?: unknown;
};

export type AutopilotDraftsFilters = {
  specKey?: string;
  topicKey?: string;
  itemType?: string;
  status?: string;
};

export type AutopilotDraftsResponse = {
  summary: {
    totalDrafts: number;
    flashcards: number;
    quizQuestions: number;
    examQuestions: number;
  };
  items: AutopilotDraftItem[];
};

/** Get autopilot drafts. GET /api/content-graph/autopilot/drafts */
export async function fetchAutopilotDrafts(
  filters?: AutopilotDraftsFilters
): Promise<AutopilotDraftsResponse> {
  const params = new URLSearchParams();
  if (filters?.specKey) params.set("specKey", filters.specKey);
  if (filters?.topicKey) params.set("topicKey", filters.topicKey);
  if (filters?.itemType) params.set("itemType", filters.itemType);
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString();
  const res = await api.get<AutopilotDraftsResponse>(`/content-graph/autopilot/drafts${qs ? `?${qs}` : ""}`);
  return res.data;
}

/** Approve one item. POST /api/content-graph/autopilot/approve */
export async function approveAutopilotItem(payload: {
  itemType: string;
  itemId: string;
}): Promise<{ ok: boolean; item: AutopilotDraftItem }> {
  const res = await api.post<{ ok: boolean; item: AutopilotDraftItem }>(
    "/content-graph/autopilot/approve",
    payload
  );
  return res.data;
}

/** Reject one item. POST /api/content-graph/autopilot/reject */
export async function rejectAutopilotItem(payload: {
  itemType: string;
  itemId: string;
  reason?: string;
}): Promise<{ ok: boolean; item: AutopilotDraftItem }> {
  const res = await api.post<{ ok: boolean; item: AutopilotDraftItem }>(
    "/content-graph/autopilot/reject",
    payload
  );
  return res.data;
}

/** Bulk approve. POST /api/content-graph/autopilot/approve-bulk */
export async function bulkApproveAutopilotItems(payload: {
  items: Array<{ itemType: string; itemId: string }>;
}): Promise<{ ok: boolean; approved: Array<{ itemType: string; itemId: string }>; failed: Array<{ itemType: string; itemId: string; reason: string }> }> {
  const res = await api.post("/content-graph/autopilot/approve-bulk", payload);
  return res.data;
}

/** Bulk reject. POST /api/content-graph/autopilot/reject-bulk */
export async function bulkRejectAutopilotItems(payload: {
  items: Array<{ itemType: string; itemId: string }>;
  reason?: string;
}): Promise<{ ok: boolean; rejected: Array<{ itemType: string; itemId: string }>; failed: Array<{ itemType: string; itemId: string; reason: string }> }> {
  const res = await api.post("/content-graph/autopilot/reject-bulk", payload);
  return res.data;
}

/** Autopilot Run History */
export type AutopilotRunExecutedAction = {
  type: string;
  status: "generated" | "skipped" | "failed" | "planned";
  createdCount?: number;
  reason?: string;
};

export type CoverageSnapshot = {
  score?: number;
  status?: string;
  counts?: {
    lessons?: number;
    flashcards?: number;
    quizzes?: number;
    examQuestions?: number;
    openIssues?: number;
  };
};

export type AutopilotRunTopicResult = {
  topicKey: string;
  topicTitle?: string;
  requiresReview?: boolean;
  plannedActions?: string[];
  executedActions?: AutopilotRunExecutedAction[];
  updatedCoverage?: { score?: number; status?: string };
  coverageBefore?: CoverageSnapshot;
  coverageAfter?: CoverageSnapshot;
  coverageLift?: number;
};

export type AutopilotRunSummary = {
  _id: string;
  runType: "topic" | "spec";
  specKey: string;
  topicKey?: string | null;
  dryRun: boolean;
  triggeredByUserId?: string | null;
  triggeredByRole?: string | null;
  status: "completed" | "partial" | "failed";
  minPriorityScore?: number | null;
  limit?: number | null;
  requestedActions?: string[];
  plannedTopicCount?: number | null;
  executedTopicCount?: number | null;
  skippedTopicCount?: number | null;
  failedTopicCount?: number | null;
  summary?: {
    generatedFlashcards?: number;
    generatedQuizzes?: number;
    generatedExamQuestions?: number;
    skippedActions?: number;
    failedActions?: number;
  };
  errorMessage?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type AutopilotRunDetail = AutopilotRunSummary & {
  topicResults?: AutopilotRunTopicResult[];
};

export type AutopilotRunsFilters = {
  specKey?: string;
  topicKey?: string;
  runType?: string;
  dryRun?: boolean;
  status?: string;
  limit?: number;
};

export type AutopilotRunsResponse = {
  items: AutopilotRunSummary[];
};

/** Get autopilot runs. GET /api/content-graph/autopilot/runs */
export async function fetchAutopilotRuns(
  filters?: AutopilotRunsFilters
): Promise<AutopilotRunsResponse> {
  const params = new URLSearchParams();
  if (filters?.specKey) params.set("specKey", filters.specKey);
  if (filters?.topicKey) params.set("topicKey", filters.topicKey);
  if (filters?.runType) params.set("runType", filters.runType);
  if (filters?.dryRun !== undefined) params.set("dryRun", String(filters.dryRun));
  if (filters?.status) params.set("status", filters.status);
  if (filters?.limit != null) params.set("limit", String(filters.limit));
  const qs = params.toString();
  const res = await api.get<AutopilotRunsResponse>(`/content-graph/autopilot/runs${qs ? `?${qs}` : ""}`);
  return res.data;
}

/** Get single run by id. GET /api/content-graph/autopilot/runs/:id */
export async function fetchAutopilotRunById(id: string): Promise<AutopilotRunDetail> {
  const res = await api.get<AutopilotRunDetail>(`/content-graph/autopilot/runs/${encodeURIComponent(id)}`);
  return res.data;
}

/** Autopilot Outcomes */
export type AutopilotOutcomeTotals = {
  runs: number;
  dryRuns: number;
  liveRuns: number;
  completedRuns: number;
  partialRuns: number;
  failedRuns: number;
  generatedFlashcards: number;
  generatedQuizzes: number;
  generatedExamQuestions: number;
  approvedItems: number;
  rejectedItems: number;
};

export type RepeatedFailureItem = {
  specKey: string;
  topicKey: string;
  topicTitle?: string;
  failCount: number;
  skipCount: number;
  latestReason?: string | null;
};

export type CoverageLiftItem = {
  specKey: string;
  topicKey: string;
  topicTitle?: string;
  latestCoverageScore: number | null;
  latestCoverageStatus?: string;
  liftType: "true" | "estimated";
  trueCoverageLift?: number;
  estimatedCoverageLift?: number;
};

export type AutopilotOutcomeSummary = {
  totals: AutopilotOutcomeTotals;
  repeatedFailures: RepeatedFailureItem[];
  topCoverageLiftTopics: CoverageLiftItem[];
};

export type AutopilotOutcomesFilters = {
  specKey?: string;
  topicKey?: string;
  days?: number;
  limit?: number;
};

/** Get autopilot outcomes. GET /api/content-graph/autopilot/outcomes */
export async function fetchAutopilotOutcomes(
  filters?: AutopilotOutcomesFilters
): Promise<AutopilotOutcomeSummary> {
  const params = new URLSearchParams();
  if (filters?.specKey) params.set("specKey", filters.specKey);
  if (filters?.topicKey) params.set("topicKey", filters.topicKey);
  if (filters?.days != null) params.set("days", String(filters.days));
  if (filters?.limit != null) params.set("limit", String(filters.limit));
  const qs = params.toString();
  const res = await api.get<AutopilotOutcomeSummary>(`/content-graph/autopilot/outcomes${qs ? `?${qs}` : ""}`);
  return res.data;
}

/** Get outcomes by spec. GET /api/content-graph/autopilot/outcomes/spec/:specKey */
export async function fetchAutopilotOutcomesBySpec(
  specKey: string,
  filters?: AutopilotOutcomesFilters
): Promise<AutopilotOutcomeSummary> {
  const params = new URLSearchParams();
  if (filters?.days != null) params.set("days", String(filters.days));
  if (filters?.limit != null) params.set("limit", String(filters.limit));
  const qs = params.toString();
  const res = await api.get<AutopilotOutcomeSummary>(
    `/content-graph/autopilot/outcomes/spec/${encodeURIComponent(specKey)}${qs ? `?${qs}` : ""}`
  );
  return res.data;
}

/** Get outcomes by topic. GET /api/content-graph/autopilot/outcomes/spec/:specKey/topic/:topicKey */
export async function fetchAutopilotOutcomesByTopic(
  specKey: string,
  topicKey: string,
  filters?: AutopilotOutcomesFilters
): Promise<AutopilotOutcomeSummary> {
  const params = new URLSearchParams();
  if (filters?.days != null) params.set("days", String(filters.days));
  if (filters?.limit != null) params.set("limit", String(filters.limit));
  const qs = params.toString();
  const res = await api.get<AutopilotOutcomeSummary>(
    `/content-graph/autopilot/outcomes/spec/${encodeURIComponent(specKey)}/topic/${encodeURIComponent(topicKey)}${qs ? `?${qs}` : ""}`
  );
  return res.data;
}

/** Autopilot Feedback (Prompt Quality) */
export type AutopilotFeedbackTotals = {
  reviewedItems: number;
  approvedItems: number;
  rejectedItems: number;
  approvalRate: number;
};

export type AutopilotFeedbackByType = {
  approved: number;
  rejected: number;
  reviewed: number;
  approvalRate: number;
};

export type AutopilotFeedbackSummary = {
  totals: AutopilotFeedbackTotals;
  byType: {
    flashcard: AutopilotFeedbackByType;
    quizQuestion: AutopilotFeedbackByType;
    examQuestion: AutopilotFeedbackByType;
  };
  rejectionPatterns: Array<{ reason: string; count: number }>;
  weakTopics: Array<{
    specKey: string;
    topicKey: string;
    reviewedItems: number;
    approvalRate: number;
    approved?: number;
    rejected?: number;
  }>;
};

export type AutopilotFeedbackFilters = {
  specKey?: string;
  topicKey?: string;
  days?: number;
  limit?: number;
};

/** Get autopilot feedback. GET /api/content-graph/autopilot/feedback */
export async function fetchAutopilotFeedback(
  filters?: AutopilotFeedbackFilters
): Promise<AutopilotFeedbackSummary> {
  const params = new URLSearchParams();
  if (filters?.specKey) params.set("specKey", filters.specKey);
  if (filters?.topicKey) params.set("topicKey", filters.topicKey);
  if (filters?.days != null) params.set("days", String(filters.days));
  if (filters?.limit != null) params.set("limit", String(filters.limit));
  const qs = params.toString();
  const res = await api.get<AutopilotFeedbackSummary>(`/content-graph/autopilot/feedback${qs ? `?${qs}` : ""}`);
  return res.data;
}

/** Get feedback by spec. GET /api/content-graph/autopilot/feedback/spec/:specKey */
export async function fetchAutopilotFeedbackBySpec(
  specKey: string,
  filters?: AutopilotFeedbackFilters
): Promise<AutopilotFeedbackSummary> {
  const params = new URLSearchParams();
  if (filters?.days != null) params.set("days", String(filters.days));
  if (filters?.limit != null) params.set("limit", String(filters.limit));
  const qs = params.toString();
  const res = await api.get<AutopilotFeedbackSummary>(
    `/content-graph/autopilot/feedback/spec/${encodeURIComponent(specKey)}${qs ? `?${qs}` : ""}`
  );
  return res.data;
}

/** Get feedback by topic. GET /api/content-graph/autopilot/feedback/spec/:specKey/topic/:topicKey */
export async function fetchAutopilotFeedbackByTopic(
  specKey: string,
  topicKey: string,
  filters?: AutopilotFeedbackFilters
): Promise<AutopilotFeedbackSummary> {
  const params = new URLSearchParams();
  if (filters?.days != null) params.set("days", String(filters.days));
  const qs = params.toString();
  const res = await api.get<AutopilotFeedbackSummary>(
    `/content-graph/autopilot/feedback/spec/${encodeURIComponent(specKey)}/topic/${encodeURIComponent(topicKey)}${qs ? `?${qs}` : ""}`
  );
  return res.data;
}

/** Prompt pack feedback/outcomes */
export type PromptPackFeedbackItem = {
  promptPackId: string;
  promptPackVersion: string;
  reviewedItems: number;
  approvedItems: number;
  rejectedItems: number;
  approvalRate: number;
};

export type PromptPackOutcomesItem = {
  promptPackId: string;
  promptPackVersion: string;
  runs: number;
  liveRuns: number;
  generatedFlashcards: number;
  generatedQuizzes: number;
  generatedExamQuestions: number;
  avgCoverageLift: number | null;
};

/** Get feedback by prompt pack. GET /api/content-graph/autopilot/feedback/prompt-packs */
export async function fetchAutopilotFeedbackByPromptPack(
  filters?: AutopilotFeedbackFilters
): Promise<{ promptPacks: PromptPackFeedbackItem[] }> {
  const params = new URLSearchParams();
  if (filters?.specKey) params.set("specKey", filters.specKey);
  if (filters?.topicKey) params.set("topicKey", filters.topicKey);
  if (filters?.days != null) params.set("days", String(filters.days));
  if (filters?.limit != null) params.set("limit", String(filters.limit));
  const qs = params.toString();
  const res = await api.get<{ promptPacks: PromptPackFeedbackItem[] }>(
    `/content-graph/autopilot/feedback/prompt-packs${qs ? `?${qs}` : ""}`
  );
  return res.data;
}

/** Get outcomes by prompt pack. GET /api/content-graph/autopilot/outcomes/prompt-packs */
export async function fetchAutopilotOutcomesByPromptPack(
  filters?: AutopilotOutcomesFilters
): Promise<{ promptPacks: PromptPackOutcomesItem[] }> {
  const params = new URLSearchParams();
  if (filters?.specKey) params.set("specKey", filters.specKey);
  if (filters?.topicKey) params.set("topicKey", filters.topicKey);
  if (filters?.days != null) params.set("days", String(filters.days));
  if (filters?.limit != null) params.set("limit", String(filters.limit));
  const qs = params.toString();
  const res = await api.get<{ promptPacks: PromptPackOutcomesItem[] }>(
    `/content-graph/autopilot/outcomes/prompt-packs${qs ? `?${qs}` : ""}`
  );
  return res.data;
}
