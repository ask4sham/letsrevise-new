/**
 * Display-only data-table stimulus helpers (not fill-in TABLE parts).
 */

export type StimulusTableColumn = {
  heading: string;
  unit?: string;
};

export type StimulusTable = {
  title?: string;
  columns: StimulusTableColumn[];
  rows: string[][];
};

export function parseStimulusTable(raw: unknown): StimulusTable | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.columns) || !Array.isArray(data.rows)) return null;
  if (data.columns.length < 1 || data.rows.length < 1) return null;

  const columns: StimulusTableColumn[] = data.columns.map((c) => {
    if (!c || typeof c !== "object") return { heading: "", unit: "" };
    const col = c as Record<string, unknown>;
    return {
      heading: String(col.heading ?? "").trim(),
      unit: col.unit != null ? String(col.unit).trim() : "",
    };
  });

  const rows = data.rows
    .map((row) => {
      if (!Array.isArray(row)) return null;
      return row.map((cell) => String(cell ?? "").trim());
    })
    .filter(Boolean) as string[][];

  if (!rows.length) return null;
  return {
    title: data.title != null ? String(data.title).trim() : "",
    columns,
    rows,
  };
}

export function getStimulusTableFromMetadata(metadata: unknown): StimulusTable | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return parseStimulusTable((metadata as Record<string, unknown>).stimulusTable);
}

export function columnHeaderLabel(col: StimulusTableColumn): string {
  const heading = String(col.heading || "").trim() || "Column";
  const unit = String(col.unit || "").trim();
  if (!unit) return heading;
  if (heading.includes(unit) || /\([^)]+\)/.test(heading)) return heading;
  return `${heading} (${unit})`;
}
