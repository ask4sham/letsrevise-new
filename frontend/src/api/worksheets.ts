// frontend/src/api/worksheets.ts — PR-W1 + PR-W2.1: thin wrappers + locked contracts
import api from "../services/api";
import type {
  Worksheet,
  WorksheetCreateRequest,
  WorksheetUpdateRequest,
} from "../types/worksheets";

export type { Worksheet, WorksheetQuestionItem } from "../types/worksheets";
export type { WorksheetCreateRequest, WorksheetUpdateRequest };

/** Create empty worksheet. Returns worksheet (201). */
export async function createWorksheet(
  payload: WorksheetCreateRequest = {}
): Promise<Worksheet> {
  const { data } = await api.post<{ worksheet: Worksheet }>("/worksheets", payload);
  return data.worksheet;
}

/** Get worksheet by id. Returns worksheet (200). 403 if not owner; 404 if not found. */
export async function getWorksheet(id: string): Promise<Worksheet> {
  const { data } = await api.get<{ worksheet: Worksheet }>(`/worksheets/${id}`);
  return data.worksheet;
}

/** List worksheets for current user. Returns worksheets array (200). */
export async function listWorksheets(): Promise<Worksheet[]> {
  const { data } = await api.get<{ worksheets: Worksheet[] }>("/worksheets");
  return data.worksheets;
}

/** Update worksheet (title, metadata, questionItems). Status not writable here. Returns worksheet (200). */
export async function updateWorksheet(
  id: string,
  payload: WorksheetUpdateRequest
): Promise<Worksheet> {
  const { data } = await api.put<{ worksheet: Worksheet }>(
    `/worksheets/${id}`,
    payload
  );
  return data.worksheet;
}

/** Set status to PUBLISHED. Returns worksheet (200). */
export async function publishWorksheet(id: string): Promise<Worksheet> {
  const { data } = await api.post<{ worksheet: Worksheet }>(
    `/worksheets/${id}/publish`
  );
  return data.worksheet;
}
