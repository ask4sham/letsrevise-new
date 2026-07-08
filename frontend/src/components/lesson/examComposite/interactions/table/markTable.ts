import type { AnswerFeedbackStatus } from "../../AnswerFeedbackPanel";
import { deriveShortAnswerFeedbackStatus } from "../../../../../utils/gradeShortAnswer";
import {
  listBlankCells,
  parseTablePartData,
  parseTableStudentAnswers,
  tableCellKey,
  type TablePartData,
  type TableStudentAnswers,
} from "./tableTypes";

export type TableGradeResult = {
  status: AnswerFeedbackStatus;
  marksAwarded: number;
  maxMarks: number;
  correctKeys: string[];
  incorrectKeys: string[];
  missingKeys: string[];
  yourAnswerLines: string[];
  correctAnswerLines: string[];
};

function normalizeCellAnswer(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function gradeTablePart(args: {
  partData: unknown;
  studentAnswerJson: string | undefined;
  marks: number;
}): TableGradeResult | null {
  const data = parseTablePartData(args.partData);
  if (!data) return null;
  const blanks = listBlankCells(data);
  if (blanks.length < 1) return null;

  const answers = parseTableStudentAnswers(args.studentAnswerJson);
  const maxMarks = Math.max(1, args.marks || 1);
  const correctKeys: string[] = [];
  const incorrectKeys: string[] = [];
  const missingKeys: string[] = [];
  const yourAnswerLines: string[] = [];
  const correctAnswerLines: string[] = [];

  for (const blank of blanks) {
    const key = tableCellKey(blank.row, blank.col);
    const given = String(answers[key] ?? "").trim();
    const expected = blank.correctAnswer;
    const header = data.headers[blank.col] || `Column ${blank.col + 1}`;
    const rowLabel = data.rows[blank.row]?.cells?.find((c) => !c.blank)?.value || `Row ${blank.row + 1}`;

    if (!given) {
      missingKeys.push(key);
      correctAnswerLines.push(`${rowLabel} / ${header}: ${expected || "(no answer set)"}`);
      continue;
    }

    yourAnswerLines.push(`${rowLabel} / ${header}: ${given}`);
    correctAnswerLines.push(`${rowLabel} / ${header}: ${expected || "(no answer set)"}`);

    if (expected && normalizeCellAnswer(given) === normalizeCellAnswer(expected)) {
      correctKeys.push(key);
    } else {
      incorrectKeys.push(key);
    }
  }

  const scored = correctKeys.length;
  const marksAwarded =
    blanks.length === 0 ? 0 : Math.round((scored / blanks.length) * maxMarks * 100) / 100;

  return {
    status: deriveShortAnswerFeedbackStatus(marksAwarded, maxMarks),
    marksAwarded,
    maxMarks,
    correctKeys,
    incorrectKeys,
    missingKeys,
    yourAnswerLines,
    correctAnswerLines,
  };
}

export function tableHasStudentInput(studentAnswerJson: string | undefined): boolean {
  const answers = parseTableStudentAnswers(studentAnswerJson);
  return Object.values(answers).some((v) => String(v ?? "").trim() !== "");
}

export function validateTablePartData(partData: unknown): { ok: true; data: TablePartData } | { ok: false; msg: string } {
  const data = parseTablePartData(partData);
  if (!data) {
    return { ok: false, msg: "Table part needs headers and at least one row." };
  }
  if (data.headers.length < 1) {
    return { ok: false, msg: "Table needs at least one header." };
  }
  const blanks = listBlankCells(data);
  if (blanks.length < 1) {
    return { ok: false, msg: "Table needs at least one blank (editable) cell." };
  }
  for (const blank of blanks) {
    if (!blank.correctAnswer) {
      return {
        ok: false,
        msg: `Blank cell at row ${blank.row + 1}, column ${blank.col + 1} needs a correct answer.`,
      };
    }
  }
  return { ok: true, data };
}

export type { TableStudentAnswers };
