/**
 * PR-005: Enquiry (RAG) API client.
 */
import api from "../services/api";

export type PostEnquiryParams = {
  question: string;
  specKey: string;
  topicKey?: string;
  mode?: "lesson" | "revision" | "exam";
  limit?: number;
  includePractice?: boolean;
  /** PR-019: Threaded conversation */
  conversationId?: string;
  /** PR-020: Response mode (quick/explain/exam/revision) */
  responseMode?: "quick" | "explain" | "exam" | "revision";
  /** PR-021: Allow external search fallback when course content is thin (teacher/admin only) */
  allowExternal?: boolean;
};

export type EnquiryCitation =
  | {
      knowledgeDocumentId: string;
      sourceType: "specStatement";
      sourceId: string;
      quote?: string;
      reason?: string;
    }
  | {
      knowledgeDocumentId: string;
      sourceType: "lessonBlock";
      sourceId: string;
      quote?: string;
      reason?: string;
      deepLink?: {
        type: "lessonBlock";
        lessonId: string;
        pageIndex?: number;
        pageId?: string;
        blockIndex?: number;
        blockIndexStart?: number;
        blockIndexEnd?: number;
      };
    }
  | {
      knowledgeDocumentId: string;
      sourceType: "externalTrusted";
      sourceId: string;
      externalUrl: string; // required for this branch
      quote?: string;
      reason?: string;
    }
  | {
      knowledgeDocumentId: string;
      sourceType: "teacherNote";
      sourceId: string;
      quote?: string;
      reason?: string;
    }
  | {
      knowledgeDocumentId: string;
      sourceType: "lessonDiagram";
      sourceId: string;
      quote?: string;
      reason?: string;
      deepLink?: {
        type: "lesson";
        lessonId: string;
        pageIndex?: number;
        pageId?: string;
        blockIndex?: number;
        caption?: string;
        imageUrl?: string;
      };
      lessonId?: string;
      pageId?: string;
      blockIndex?: number;
      caption?: string;
      imageUrl?: string;
    };

export type EnquiryPracticeItem =
  | {
      type: "mcq" | "short" | "exam";
      question: string;
      options?: string[];
      answer: string;
      markScheme?: string;
    }
  | {
      type: "flashcard";
      front: string;
      back: string;
    };

export type EnquiryAnswer = {
  explanation: string;
  keyPoints: string[];
  citations: EnquiryCitation[];
  practice: EnquiryPracticeItem[];
  warnings: string[];
};

export type UsedSource = {
  knowledgeDocumentId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  /** PR-021: URL for external sources */
  url?: string;
  topicKey: string;
  score: number;
};

export type SuggestedTopic = { topicKey: string; title?: string | null };

/** PR-017: Confidence indicator. PR-021: external. PR-022: teacherNote. */
export type ConfidenceSignals = {
  topScore: number | null;
  sources: { spec: number; lesson: number; teacherNote?: number; external?: number; total: number };
  warnings: string[];
};

/** PR-016a: Next-step action from enquiry response */
export type SuggestedAction = {
  id: string;
  label: string;
  description?: string;
  href?: string;
  type: "link" | "intent";
  payload?: { action?: string };
};

export type PostEnquiryResponse = {
  enquiryLogId?: string | null;
  cached?: boolean;
  question: string;
  specKey: string;
  topicKey: string | null;
  usedSources: UsedSource[];
  answer: EnquiryAnswer;
  suggestedTopics?: SuggestedTopic[];
  suggestedActions?: SuggestedAction[];
  /** PR-017 */
  confidenceLevel?: "strong" | "moderate" | "weak";
  confidenceReason?: string;
  confidenceSignals?: ConfidenceSignals;
  /** PR-021: External search was used */
  externalUsed?: boolean;
  externalSources?: Array<{ url: string; title: string; domain: string }>;
  /** PR-035: External exam context was used (exam/past paper/mark scheme query) */
  externalExamContextUsed?: boolean;
  /** PR-037: AI Study Coach — coverage-aware learning suggestions (students only) */
  learningSuggestions?: LearningSuggestion[];
};

/** PR-037: Learning suggestion from coverage + weak evidence */
export type LearningSuggestion = {
  topicKey: string;
  status: "EMPTY" | "THIN" | "OK" | "STRONG" | "NO_SPEC";
  reason: string;
  priority: number;
  actions: Array<{ id: string; label: string; href: string }>;
};

export async function postEnquiry(params: PostEnquiryParams): Promise<PostEnquiryResponse> {
  const res = await api.post<PostEnquiryResponse>("/enquiry", {
    question: params.question.trim(),
    specKey: params.specKey.trim(),
    topicKey: params.topicKey?.trim() || undefined,
    mode: params.mode ?? "lesson",
    limit: params.limit ?? 8,
    includePractice: params.includePractice ?? true,
    conversationId: params.conversationId || undefined,
    responseMode: params.responseMode || undefined,
    allowExternal: params.allowExternal ?? undefined,
  });
  return res.data;
}

/**
 * PR-006: Submit feedback for an enquiry (thumbs up/down + optional comment).
 */
export async function postEnquiryFeedback(
  enquiryLogId: string,
  params: { rating: "up" | "down"; comment?: string }
): Promise<void> {
  await api.post(`/enquiry/${enquiryLogId}/feedback`, {
    rating: params.rating,
    comment: params.comment?.trim() || undefined,
  });
}

/**
 * PR-016b: Log which suggested action was clicked (optional analytics).
 */
export async function postEnquiryAction(enquiryLogId: string, actionId: string): Promise<void> {
  await api.post(`/enquiry/${enquiryLogId}/action`, { actionId });
}

/**
 * Derive specKey from topicKey (e.g. "aqa-gcse-biology:cell-structure" -> "aqa-gcse-biology").
 */
export function specKeyFromTopicKey(topicKey: string | null | undefined): string | null {
  if (!topicKey || typeof topicKey !== "string") return null;
  const t = topicKey.trim();
  const idx = t.indexOf(":");
  if (idx > 0) return t.slice(0, idx);
  return t || null;
}
