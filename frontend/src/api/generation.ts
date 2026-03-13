/**
 * PR-014: Content generation API — starter pack.
 */
import api from "../services/api";
import type { SpecKey } from "./taxonomy";

export type StarterPackParams = {
  specKey: SpecKey | string;
  topicKey: string;
  statementCodes?: string[];
  tier?: string;
};

export type StarterPackResponse = {
  jobId: string;
  outputs: {
    lessonId: string;
    flashcardIdsCount: number;
    quizCount: number;
    examCount: number;
  };
  links: {
    editLesson: string;
    flashcardsBank: string;
    quizBank: string;
    examBank: string;
  };
};

export type GenerationJob = {
  _id: string;
  requestedBy: string;
  specKey: string;
  topicKey: string;
  statementCodes: string[];
  status: "queued" | "running" | "completed" | "failed";
  outputs?: {
    lessonId?: string;
    flashcardIds?: string[];
    quizQuestionIds?: string[];
    examQuestionIds?: string[];
  };
  createdAt: string;
};

export async function postGenerateStarterPack(params: StarterPackParams): Promise<StarterPackResponse> {
  const res = await api.post<StarterPackResponse>("/generate/starter-pack", {
    specKey: params.specKey,
    topicKey: params.topicKey,
    statementCodes: params.statementCodes ?? [],
    tier: params.tier,
  });
  return res.data;
}

// PR-031: Weak evidence fix
export type WeakEvidenceFixParams = {
  specKey: SpecKey | string;
  topicKey: string;
  allowExternal?: boolean;
  windowDays?: number;
  statementCodes?: string[];
  weakQuestions?: string[];
};

export type WeakEvidenceFixResponse = {
  jobId: string;
  lessonId: string;
  flashcards: string[];
  quiz: string[];
  exam: string[];
  inputsUsed: {
    missingStatementCodes: string[];
    weakQuestions: string[];
    allowExternal: boolean;
    windowDays: number;
  };
  links: {
    editLesson: string;
    flashcardsBank: string;
    quizBank: string;
    examBank: string;
  };
};

export async function postGenerateWeakEvidenceFix(params: WeakEvidenceFixParams): Promise<WeakEvidenceFixResponse> {
  const res = await api.post<WeakEvidenceFixResponse>("/generate/weak-evidence-fix", {
    specKey: params.specKey,
    topicKey: params.topicKey,
    allowExternal: params.allowExternal ?? false,
    windowDays: params.windowDays ?? 14,
    statementCodes: params.statementCodes,
    weakQuestions: params.weakQuestions,
  });
  return res.data;
}

// PR-032: Practice set (draft-only)
export type PracticeSetParams = {
  specKey: SpecKey | string;
  topicKey: string;
  counts?: {
    quizMcq?: number;
    quizShort?: number;
    exam?: number;
    flashcards?: number;
  };
  allowExternal?: boolean;
};

export type PracticeSetResponse = {
  jobId: string;
  outputs: {
    flashcardIdsCount: number;
    quizCount: number;
    examCount: number;
  };
  links: {
    flashcardsBank: string;
    quizBank: string;
    examBank: string;
  };
};

export async function postGeneratePracticeSet(params: PracticeSetParams): Promise<PracticeSetResponse> {
  const res = await api.post<PracticeSetResponse>("/generate/practice-set", {
    specKey: params.specKey,
    topicKey: params.topicKey,
    counts: params.counts,
    allowExternal: params.allowExternal ?? false,
  });
  return res.data;
}

export async function getGenerationJobs(params?: {
  specKey?: string;
  topicKey?: string;
  limit?: number;
}): Promise<{ jobs: GenerationJob[] }> {
  const res = await api.get<{ jobs: GenerationJob[] }>("/generate/jobs", {
    params: params ?? {},
  });
  return res.data;
}

// PR-014.1 / PR-014.1a: Publish gate
export type PublishGateIssue = {
  level: "block" | "warn";
  type: "lesson" | "quiz" | "flashcard" | "exam";
  entityId: string;
  message: string;
  fixPath?: string;
  fixLink?: string;
};

export type PublishGateCheckResponse = {
  ok: boolean;
  blocks: number;
  warns: number;
  issues: PublishGateIssue[];
  summaryByType: Record<string, { blocks: number; warns: number }>;
};

export async function getPublishGateCheck(params: {
  jobId: string;
  scope?: string;
  lessonId?: string;
  topicKey?: string;
  specKey?: string;
}): Promise<PublishGateCheckResponse> {
  const res = await api.get<PublishGateCheckResponse>("/publish-gate/check", {
    params: { jobId: params.jobId, ...(params.scope && { scope: params.scope }) },
  });
  return res.data;
}

export type PublishGatePublishResponse = {
  ok: boolean;
  published: { lesson: boolean; flashcards: number; quiz: number; exam: number };
  lessonId?: string | null;
  topicKey?: string;
};

/** PR-014.1b: Publish all job outputs. Body: { jobId } only. Requires blocks === 0. */
export async function postPublishGatePublish(body: { jobId: string }): Promise<PublishGatePublishResponse> {
  const res = await api.post<PublishGatePublishResponse>("/publish-gate/publish", body);
  return res.data;
}
