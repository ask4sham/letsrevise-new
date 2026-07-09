/**
 * Phase 1 Table interaction — partData contract only.
 * Headers, rows, blank (editable) cells, correct answers. Nothing else.
 */

export type TableCellData = {
  /** Prefill / label text (shown when not blank). */
  value?: string;
  /** Student must type into this cell. */
  blank?: boolean;
  /** Expected answer for blank cells (teacher side). */
  correctAnswer?: string;
};

export type TablePartData = {
  headers: string[];
  rows: Array<{ cells: TableCellData[] }>;
};

export type TableStudentAnswers = Record<string, string>;

export function tableCellKey(rowIndex: number, colIndex: number): string {
  return `${rowIndex}:${colIndex}`;
}

export function parseTablePartData(raw: unknown): TablePartData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.headers) || !Array.isArray(data.rows)) return null;
  const headers = data.headers.map((h) => String(h ?? "").trim());
  if (headers.length < 1) return null;

  const rows = data.rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const cellsRaw = (row as { cells?: unknown }).cells;
      if (!Array.isArray(cellsRaw)) return null;
      const cells: TableCellData[] = cellsRaw.map((cell) => {
        if (!cell || typeof cell !== "object") {
          return { value: String(cell ?? "") };
        }
        const c = cell as TableCellData;
        return {
          value: c.value != null ? String(c.value) : "",
          blank: Boolean(c.blank),
          correctAnswer: c.correctAnswer != null ? String(c.correctAnswer) : undefined,
        };
      });
      return { cells };
    })
    .filter(Boolean) as Array<{ cells: TableCellData[] }>;

  if (rows.length < 1) return null;
  return { headers, rows };
}

export function parseTableStudentAnswers(raw: string | undefined | null): TableStudentAnswers {
  if (!raw || !String(raw).trim()) return {};
  try {
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: TableStudentAnswers = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      out[key] = String(value ?? "");
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeTableStudentAnswers(answers: TableStudentAnswers): string {
  return JSON.stringify(answers);
}

export function listBlankCells(data: TablePartData): Array<{ row: number; col: number; correctAnswer: string }> {
  const blanks: Array<{ row: number; col: number; correctAnswer: string }> = [];
  data.rows.forEach((row, rowIndex) => {
    row.cells.forEach((cell, colIndex) => {
      if (!cell.blank) return;
      blanks.push({
        row: rowIndex,
        col: colIndex,
        correctAnswer: String(cell.correctAnswer ?? "").trim(),
      });
    });
  });
  return blanks;
}
