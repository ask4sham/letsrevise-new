import type { TableCellData, TablePartData } from "../../components/lesson/examComposite/interactions/table/tableTypes";
import { parseTablePartData } from "../../components/lesson/examComposite/interactions/table/tableTypes";

export const BASE_COMPOSITE_PART_TYPES = ["short", "mcq"] as const;
export const TABLE_COMPOSITE_PART_TYPE = "table" as const;

/** Optional MCQ educational rationale stored under partData.explanation. */
export const MCQ_EXPLANATION_MAX_LENGTH = 1000;

export type BaseCompositePartType = (typeof BASE_COMPOSITE_PART_TYPES)[number];
export type CompositePartFormType = BaseCompositePartType | typeof TABLE_COMPOSITE_PART_TYPE;

export const COMPOSITE_PART_LABELS = "abcdefghijklmnopqrstuvwxyz".split("");

/** MCQ-only partData: approved shape is { explanation } only. */
export type McqPartDataForm = {
  explanation?: string;
};

export type CompositePartForm = {
  label: string;
  type: CompositePartFormType;
  marks: number;
  questionText: string;
  options: string[];
  correctIndex: number;
  markScheme: string;
  /** Table headers/rows, or MCQ { explanation }. */
  partData?: TablePartData | McqPartDataForm;
};

export function getMcqExplanationText(partData: CompositePartForm["partData"]): string {
  if (!partData || typeof partData !== "object") return "";
  if ("headers" in partData) return "";
  return typeof partData.explanation === "string" ? partData.explanation : "";
}

export function parseMcqExplanationFromApi(partData: unknown): string {
  if (!partData || typeof partData !== "object" || Array.isArray(partData)) return "";
  const expl = (partData as { explanation?: unknown }).explanation;
  return typeof expl === "string" ? expl : "";
}

export type ApiCompositePart = {
  label?: string;
  type?: string;
  marks?: number;
  questionText?: string;
  options?: string[];
  correctIndex?: number | null;
  markScheme?: string[];
  partData?: unknown;
};

export function getCompositePartTypeOptions(tablePartsEnabled: boolean): CompositePartFormType[] {
  return tablePartsEnabled
    ? [...BASE_COMPOSITE_PART_TYPES, TABLE_COMPOSITE_PART_TYPE]
    : [...BASE_COMPOSITE_PART_TYPES];
}

export function compositePartTypeSelectLabel(type: CompositePartFormType): string {
  if (type === "mcq") return "Multiple choice";
  if (type === "table") return "Table";
  return "Short answer";
}

export function makeDefaultTablePartData(): TablePartData {
  return {
    headers: ["Column 1", "Column 2"],
    rows: [
      {
        cells: [
          { value: "", blank: true, correctAnswer: "" },
          { value: "", blank: false },
        ],
      },
    ],
  };
}

export function makeEmptyCompositePart(index: number): CompositePartForm {
  return {
    label: COMPOSITE_PART_LABELS[index] ?? String(index + 1),
    type: "short",
    marks: 2,
    questionText: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    markScheme: "",
  };
}

export function resizeTablePartData(data: TablePartData, columnCount: number): TablePartData {
  const count = Math.max(1, columnCount);
  const headers = [...data.headers];
  while (headers.length < count) headers.push(`Column ${headers.length + 1}`);
  const nextHeaders = headers.slice(0, count);
  const rows = data.rows.map((row) => {
    const cells: TableCellData[] = [...row.cells];
    while (cells.length < count) cells.push({ value: "", blank: false });
    return { cells: cells.slice(0, count) };
  });
  return { headers: nextHeaders, rows: rows.length ? rows : [{ cells: nextHeaders.map(() => ({ value: "", blank: false })) }] };
}

export function mapApiPartToCompositePartForm(
  part: ApiCompositePart,
  index: number,
  tablePartsEnabled: boolean
): CompositePartForm {
  const rawType = String(part.type ?? "").toLowerCase();
  const type: CompositePartFormType =
    tablePartsEnabled && rawType === TABLE_COMPOSITE_PART_TYPE
      ? TABLE_COMPOSITE_PART_TYPE
      : rawType === "mcq"
        ? "mcq"
        : "short";
  const pOpts = Array.isArray(part.options) ? part.options.map((o) => String(o ?? "")) : [];
  const parsedTable = type === TABLE_COMPOSITE_PART_TYPE ? parseTablePartData(part.partData) : null;
  const mcqExplanation = type === "mcq" ? parseMcqExplanationFromApi(part.partData) : "";

  return {
    label: part.label || (COMPOSITE_PART_LABELS[index] ?? String(index + 1)),
    type,
    marks: typeof part.marks === "number" ? part.marks : 1,
    questionText: part.questionText || "",
    options: [...pOpts, "", "", "", ""].slice(0, Math.max(4, pOpts.length)),
    correctIndex: typeof part.correctIndex === "number" && part.correctIndex >= 0 ? part.correctIndex : 0,
    markScheme: Array.isArray(part.markScheme) ? part.markScheme.join("\n") : "",
    partData:
      type === TABLE_COMPOSITE_PART_TYPE
        ? parsedTable ?? makeDefaultTablePartData()
        : type === "mcq" && mcqExplanation
          ? { explanation: mcqExplanation }
          : undefined,
  };
}

export function serializeCompositePartForSave(part: CompositePartForm): Record<string, unknown> {
  const markScheme = part.markScheme
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const base = {
    label: part.label,
    type: part.type,
    marks: part.marks,
    questionText: part.questionText.trim(),
    markScheme,
  };

  if (part.type === "mcq") {
    const options = part.options.map((s) => s.trim()).filter(Boolean);
    const explanation = getMcqExplanationText(part.partData).trim();
    const out: Record<string, unknown> = {
      ...base,
      options,
      correctIndex: part.correctIndex,
    };
    if (explanation) {
      out.partData = { explanation };
    }
    return out;
  }

  if (part.type === TABLE_COMPOSITE_PART_TYPE) {
    return {
      ...base,
      options: [],
      correctIndex: null,
      partData: parseTablePartData(part.partData) ?? makeDefaultTablePartData(),
    };
  }

  return {
    ...base,
    options: [],
    correctIndex: null,
  };
}

export function buildCompositeSaveParts(parts: CompositePartForm[]): Record<string, unknown>[] {
  return parts.map((p) => serializeCompositePartForSave(p));
}

export function compositeSaveHasTablePart(parts: CompositePartForm[]): boolean {
  return parts.some((p) => p.type === TABLE_COMPOSITE_PART_TYPE);
}

export function validateCompositePartForm(part: CompositePartForm): string | null {
  if (!part.questionText.trim()) return `Part (${part.label}) needs question text.`;
  if (!(part.marks > 0)) return `Part (${part.label}) needs at least 1 mark.`;

  if (part.type === "mcq") {
    const opts = part.options.map((s) => s.trim()).filter(Boolean);
    if (opts.length < 2) return `Part (${part.label}) MCQ needs at least 2 options.`;
    if (part.correctIndex < 0 || part.correctIndex >= opts.length) {
      return `Part (${part.label}) MCQ needs a selected correct option.`;
    }
    const explanation = getMcqExplanationText(part.partData);
    if (explanation.length > MCQ_EXPLANATION_MAX_LENGTH) {
      return `Part (${part.label}) explanation must be at most ${MCQ_EXPLANATION_MAX_LENGTH} characters.`;
    }
  }

  if (part.type === TABLE_COMPOSITE_PART_TYPE) {
    const data = parseTablePartData(part.partData) ?? makeDefaultTablePartData();
    if (!data.headers.length || !data.rows.length) {
      return `Part (${part.label}) table needs headers and at least one row.`;
    }
    let blankCount = 0;
    for (let r = 0; r < data.rows.length; r += 1) {
      const row = data.rows[r];
      for (let c = 0; c < row.cells.length; c += 1) {
        const cell = row.cells[c];
        if (!cell.blank) continue;
        blankCount += 1;
        if (!String(cell.correctAnswer ?? "").trim()) {
          return `Part (${part.label}) blank cell at row ${r + 1}, column ${c + 1} needs a correct answer.`;
        }
      }
    }
    if (blankCount < 1) {
      return `Part (${part.label}) table needs at least one blank (editable) cell.`;
    }
  }

  return null;
}
