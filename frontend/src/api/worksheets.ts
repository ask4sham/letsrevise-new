// frontend/src/api/worksheets.ts — PR-W1: thin wrappers for worksheet CRUD
import api from "../services/api";

export interface WorksheetItem {
  examQuestionId: string;
  marksOverride?: number;
  notes?: string;
}

export interface Worksheet {
  _id: string;
  ownerId: string;
  title: string;
  subject: string;
  examBoard: string;
  level: string;
  topicKey: string | null;
  status: "DRAFT" | "PUBLISHED";
  questionItems: WorksheetItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorksheetPayload {
  title?: string;
  subject?: string;
  examBoard?: string;
  level?: string;
  topicKey?: string;
}

export interface UpdateWorksheetPayload {
  title?: string;
  subject?: string;
  examBoard?: string;
  level?: string;
  topicKey?: string;
  questionItems?: WorksheetItem[];
}

/** Create empty worksheet. Returns worksheet (201). */
export async function createWorksheet(payload: CreateWorksheetPayload = {}) {
  const { data } = await api.post<{ worksheet: Worksheet }>("/worksheets", payload);
  return data.worksheet;
}

/** Get worksheet by id. Returns worksheet (200). 403 if not owner; 404 if not found. */
export async function getWorksheet(id: string) {
  const { data } = await api.get<{ worksheet: Worksheet }>(`/worksheets/${id}`);
  return data.worksheet;
}

/** List worksheets for current user. Returns worksheets array (200). */
export async function listWorksheets() {
  const { data } = await api.get<{ worksheets: Worksheet[] }>("/worksheets");
  return data.worksheets;
}

/** Update worksheet (title, metadata, questionItems). Status not writable here. Returns worksheet (200). */
export async function updateWorksheet(id: string, payload: UpdateWorksheetPayload) {
  const { data } = await api.put<{ worksheet: Worksheet }>(`/worksheets/${id}`, payload);
  return data.worksheet;
}

/** Set status to PUBLISHED. Returns worksheet (200). */
export async function publishWorksheet(id: string) {
  const { data } = await api.post<{ worksheet: Worksheet }>(`/worksheets/${id}/publish`);
  return data.worksheet;
}
