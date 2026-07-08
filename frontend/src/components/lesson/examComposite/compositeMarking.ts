import type { ExamQuestionPart } from "../../../api/examQuestions";
import type { AnswerFeedbackStatus } from "../AnswerFeedbackPanel";
import { buildMcqFeedback, gradeMcq } from "../../../utils/gradeMcq";
import {
  deriveShortAnswerFeedbackStatus,
  gradeShortAnswer,
} from "../../../utils/gradeShortAnswer";
import {
  partLabel,
  resolvePartMarkScheme,
  uniqueSummaryLines,
} from "./compositeUtils";
import { CompositePartType } from "./types";
import { gradeTablePart } from "./interactions/table/markTable";

export type CompositeExamSummary = {
  marksAwarded: number;
  totalMarks: number;
  status: AnswerFeedbackStatus;
  strongAreas: string[];
  needsRevision: string[];
};

export function buildCompositeExamSummary(
  parts: ExamQuestionPart[],
  checkedParts: Record<number, boolean>,
  mcqSelections: Record<number, number>,
  answers: Record<number, string>,
  totalMarks: number
): CompositeExamSummary | null {
  if (parts.length === 0) return null;
  if (!parts.every((_, idx) => checkedParts[idx])) return null;

  const strongAreas: string[] = [];
  const needsRevision: string[] = [];
  let marksAwarded = 0;

  for (let idx = 0; idx < parts.length; idx += 1) {
    const part = parts[idx];
    const label = partLabel(part, idx);
    const type = String(part.type).toLowerCase();
    const isMcq = type === CompositePartType.MCQ;
    const isTable = type === CompositePartType.TABLE;
    const markScheme = resolvePartMarkScheme(part);
    const options = Array.isArray(part.options)
      ? part.options.map((o) => String(o ?? "").trim()).filter(Boolean)
      : [];

    if (isMcq) {
      const selectedIndex = mcqSelections[idx];
      if (selectedIndex === undefined) continue;
      const correctIndex = typeof part.correctIndex === "number" ? part.correctIndex : -1;
      if (correctIndex < 0 || options.length === 0) continue;
      const grade = gradeMcq(selectedIndex, correctIndex, options, part.marks ?? 1);
      marksAwarded += grade.marksAwarded;
      const feedback = buildMcqFeedback({
        grade,
        options,
        markScheme,
        correctAnswer: options[correctIndex] ?? "",
      });

      if (grade.status === "correct") {
        strongAreas.push(
          feedback?.whyCorrect?.trim() ||
            `Correctly answered part (${label}): ${grade.correctOption || options[correctIndex] || ""}`.trim()
        );
      } else {
        const reviseLine =
          feedback?.improvementTip?.replace(/^Revise:\s*/i, "").trim() ||
          feedback?.whySelectedWrong?.trim() ||
          feedback?.memoryRule?.trim() ||
          `Review part (${label}) — correct answer: ${grade.correctOption || options[correctIndex] || ""}`.trim();
        needsRevision.push(reviseLine);
      }
      continue;
    }

    if (isTable) {
      const grade = gradeTablePart({
        partData: part.partData,
        studentAnswerJson: answers[idx],
        marks: part.marks ?? 1,
      });
      if (!grade) continue;
      marksAwarded += grade.marksAwarded;
      for (const line of grade.yourAnswerLines) {
        if (grade.correctKeys.length > 0 && grade.status !== "incorrect") {
          strongAreas.push(`Part (${label}): ${line}`);
        }
      }
      for (const line of grade.correctAnswerLines) {
        if (grade.status !== "correct") {
          needsRevision.push(`Part (${label}): ${line}`);
        }
      }
      continue;
    }

    const grade = gradeShortAnswer({
      userAnswer: answers[idx] ?? "",
      markScheme,
      marks: part.marks ?? 1,
    });
    marksAwarded += grade.score;
    for (const hit of grade.hits || []) {
      strongAreas.push(String(hit ?? "").trim());
    }
    for (const missing of grade.missing || []) {
      needsRevision.push(String(missing ?? "").trim());
    }
    if (grade.score <= 0 && (!grade.missing || grade.missing.length === 0)) {
      needsRevision.push(`Part (${label}): add more detail to score marks.`);
    }
  }

  return {
    marksAwarded,
    totalMarks,
    status: deriveShortAnswerFeedbackStatus(marksAwarded, totalMarks),
    strongAreas: uniqueSummaryLines(strongAreas),
    needsRevision: uniqueSummaryLines(needsRevision),
  };
}

export function gradeCompositePartResult(
  part: ExamQuestionPart,
  mcqSelectedIndex: number | undefined,
  writtenAnswer: string | undefined
): { marksAwarded: number; maxMarks: number; status: AnswerFeedbackStatus } | null {
  const type = String(part.type).toLowerCase();
  const isMcq = type === CompositePartType.MCQ;
  const isTable = type === CompositePartType.TABLE;
  const options = Array.isArray(part.options)
    ? part.options.map((o) => String(o ?? "").trim()).filter(Boolean)
    : [];
  const markScheme = resolvePartMarkScheme(part);
  const maxMarks = Math.max(1, part.marks ?? 1);

  if (isMcq) {
    if (mcqSelectedIndex === undefined) return null;
    const correctIndex = typeof part.correctIndex === "number" ? part.correctIndex : -1;
    if (correctIndex < 0 || options.length === 0) return null;
    const grade = gradeMcq(mcqSelectedIndex, correctIndex, options, maxMarks);
    return { marksAwarded: grade.marksAwarded, maxMarks: grade.totalMarks, status: grade.status };
  }

  if (isTable) {
    const grade = gradeTablePart({
      partData: part.partData,
      studentAnswerJson: writtenAnswer,
      marks: maxMarks,
    });
    if (!grade) return null;
    return { marksAwarded: grade.marksAwarded, maxMarks: grade.maxMarks, status: grade.status };
  }

  const answer = String(writtenAnswer ?? "").trim();
  if (!answer) return null;
  const grade = gradeShortAnswer({ userAnswer: answer, markScheme, marks: maxMarks });
  return {
    marksAwarded: grade.score,
    maxMarks: grade.maxMarks,
    status: deriveShortAnswerFeedbackStatus(grade.score, grade.maxMarks),
  };
}
