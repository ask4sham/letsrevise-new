import type { ExamQuestion, ExamQuestionPart } from "../../../api/examQuestions";
import { makeAbsoluteAssetUrl, resolveExamQuestionImageSrc } from "../../../utils/assetUrl";
import { isCompositePartTypeEnabled } from "./featureFlags";
import { tableHasStudentInput } from "./interactions/table/markTable";
import { parseTablePartData } from "./interactions/table/tableTypes";
import { CompositePartType } from "./types";

export function normalizeCompositePartType(part: ExamQuestionPart): string {
  return String(part.type ?? "").toLowerCase().trim();
}

/** True when the stored part is a table interaction (type or valid partData when flag allows). */
export function isCompositeTablePart(part: ExamQuestionPart): boolean {
  const type = normalizeCompositePartType(part);
  if (type === CompositePartType.TABLE) return true;
  if (!isCompositePartTypeEnabled(CompositePartType.TABLE)) return false;
  return parseTablePartData(part.partData) != null;
}

export function isCompositeQuestion(q: ExamQuestion): boolean {
  return (
    (String(q.questionMode ?? "").toLowerCase() === "composite" ||
      String(q.type ?? "").toLowerCase() === "composite") &&
    Array.isArray(q.parts) &&
    q.parts.length > 0
  );
}

export function partLabel(part: ExamQuestionPart, index: number): string {
  return part.label ? String(part.label).trim() : String.fromCharCode(97 + index);
}

/** Exam-paper answer space: lines scale with mark demand. */
export function answerLineCount(marks: number | null | undefined): number {
  const m = Number(marks);
  if (!Number.isFinite(m) || m < 1) return 2;
  if (m === 1) return 1;
  if (m === 2) return 3;
  if (m === 3) return 4;
  if (m === 4) return 5;
  if (m >= 6) return Math.max(6, m);
  return m + 1;
}

export function formatMarksBadge(marks: number | null | undefined): string {
  if (marks == null || !Number.isFinite(Number(marks))) return "";
  return `[${marks}]`;
}

export function resolvePartMarkScheme(part: ExamQuestionPart): string[] {
  if (!Array.isArray(part.markScheme)) return [];
  return part.markScheme.map((line) => String(line ?? "").trim()).filter(Boolean);
}

export function uniqueSummaryLines(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines
    .map((line) => String(line ?? "").trim())
    .filter(Boolean)
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Stored exam `imageUrl` → inline src (original PNG when a `.display.png` sibling exists). */
export function inlineExamQuestionImageSrc(storedUrl: string): string {
  const trimmed = storedUrl.trim();
  if (!trimmed) return "";
  const absolute = makeAbsoluteAssetUrl(trimmed) ?? trimmed;
  return resolveExamQuestionImageSrc(absolute);
}

export function compositePartHasStudentAnswer(
  part: ExamQuestionPart,
  partIndex: number,
  mcqSelections: Record<number, number>,
  answers: Record<number, string>
): boolean {
  const type = normalizeCompositePartType(part);
  if (type === CompositePartType.MCQ) {
    return mcqSelections[partIndex] !== undefined;
  }
  if (isCompositeTablePart(part) && isCompositePartTypeEnabled(CompositePartType.TABLE)) {
    return tableHasStudentInput(answers[partIndex]);
  }
  return Boolean(String(answers[partIndex] ?? "").trim());
}

export function compositeAllPartsChecked(
  parts: ExamQuestionPart[],
  checkedParts: Record<number, boolean>
): boolean {
  if (parts.length < 1) return false;
  return parts.every((_, index) => Boolean(checkedParts[index]));
}

export function compositeAllPartsHaveAnswers(
  parts: ExamQuestionPart[],
  mcqSelections: Record<number, number>,
  answers: Record<number, string>
): boolean {
  if (parts.length < 1) return false;
  return parts.every((part, index) =>
    compositePartHasStudentAnswer(part, index, mcqSelections, answers)
  );
}
