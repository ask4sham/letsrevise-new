/** PR-W2.1: Exact UI data contracts for worksheets (match backend payloads). */

export type WorksheetStatus = "DRAFT" | "PUBLISHED";

export type WorksheetQuestionItem = {
  examQuestionId: string;
  marksOverride?: number;
  notes?: string;
};

export type Worksheet = {
  _id: string;
  ownerId: string;
  title: string;
  subject?: string;
  examBoard?: string;
  level?: string;
  topicKey?: string | null;
  status: WorksheetStatus;
  questionItems: WorksheetQuestionItem[];
  createdAt: string;
  updatedAt: string;
};

export type WorksheetCreateRequest = Partial<
  Pick<Worksheet, "title" | "subject" | "examBoard" | "level" | "topicKey">
> & {
  questionItems?: WorksheetQuestionItem[];
};

export type WorksheetUpdateRequest = Partial<
  Pick<Worksheet, "title" | "subject" | "examBoard" | "level" | "topicKey">
> & {
  /** status is intentionally excluded (server rejects it) */
  questionItems?: WorksheetQuestionItem[];
};
