/**
 * V2.2 read-only MCQ rationale inventory API client.
 */
import api from "../services/api";

export type RationaleBucket = "missing" | "empty" | "generic" | "substantive" | "malformed";

export type McqRationaleInventorySummary = {
  countUnit: "mcq_parts";
  totalCompositeQuestions: number;
  totalCompositeMcqParts: number;
  missing: number;
  empty: number;
  generic: number;
  substantive: number;
  malformed: number;
  potentiallyEligible: number;
  published: number;
  draft: number;
};

export type McqRationaleInventoryItem = {
  questionId: string;
  partLabel: string;
  subject: string | null;
  examBoard: string | null;
  level: string | null;
  topic: string | null;
  topicKey: string | null;
  status: string | null;
  sharedStem: string;
  questionText: string;
  options: string[];
  correctOption: string | null;
  correctIndex: number | null;
  markScheme: string[];
  currentRationale: string | null;
  rationaleBucket: RationaleBucket;
  potentiallyEligibleForBackfill: boolean;
  updatedAt: string | null;
  ownerId: string | null;
  ownerName: string;
  structureReason?: string;
};

export type McqRationaleInventoryResponse = {
  page: number;
  pageSize: number;
  totalMatchingParts: number;
  totalPages: number;
  summary: McqRationaleInventorySummary;
  items: McqRationaleInventoryItem[];
  linkedLessonCount: {
    available: boolean;
    deferred?: boolean;
    reason?: string;
  };
  readOnly: true;
};

export type McqRationaleInventoryFilters = {
  subject?: string;
  examBoard?: string;
  level?: string;
  topic?: string;
  topicKey?: string;
  status?: string;
  teacherId?: string;
  rationaleBucket?: string;
  potentiallyEligibleForBackfill?: string;
  page?: number;
  pageSize?: number;
};

export async function fetchMcqRationaleInventory(
  filters: McqRationaleInventoryFilters = {}
): Promise<McqRationaleInventoryResponse> {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    params[k] = v as string | number;
  }
  const res = await api.get<McqRationaleInventoryResponse>("/admin/exam-question-rationale-inventory", {
    params,
  });
  return res.data;
}
