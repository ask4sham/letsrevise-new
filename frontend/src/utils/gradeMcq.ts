export type McqGradeStatus = "correct" | "incorrect";

export type McqGradeResult = {
  status: McqGradeStatus;
  marksAwarded: number;
  totalMarks: number;
  correctIndex: number;
  correctLabel: string;
  correctOption: string;
  selectedIndex: number;
  selectedLabel: string;
  selectedOption: string;
};

export type McqOptionExplanation = {
  label: string;
  option: string;
  explanation: string;
};

export type McqFeedback = {
  whyCorrect?: string;
  whySelectedWrong?: string;
  wrongOptionExplanations: McqOptionExplanation[];
  improvementTip?: string;
};

const CORRECT_ANSWER_LINE_RE = /^correct\s+answer:\s*([A-Za-z])\s*[—\-–:]\s*(.*)$/i;
const WHY_WRONG_LINE_RE = /^why\s+([A-Za-z])\s+is\s+wrong:\s*(.+)$/i;

export function mcqOptionLabel(index: number): string {
  if (!Number.isFinite(index) || index < 0) return "";
  return String.fromCharCode(65 + index);
}

export function letterToMcqIndex(letter: string, optionCount: number): number {
  const code = String(letter || "").trim().toUpperCase().charCodeAt(0);
  if (!code || code < 65) return -1;
  const idx = code - 65;
  return idx >= 0 && idx < optionCount ? idx : -1;
}

export function gradeMcq(
  selectedIndex: number | null | undefined,
  correctIndex: number,
  options: string[],
  marks = 1
): McqGradeResult {
  const totalMarks = Math.max(1, marks || 1);
  const ci = typeof correctIndex === "number" && Number.isFinite(correctIndex) ? correctIndex : -1;
  const si =
    typeof selectedIndex === "number" && Number.isFinite(selectedIndex) ? selectedIndex : -1;
  const correctOption = ci >= 0 && options[ci] != null ? String(options[ci]).trim() : "";
  const selectedOption = si >= 0 && options[si] != null ? String(options[si]).trim() : "";
  const isCorrect = si >= 0 && ci >= 0 && si === ci;

  return {
    status: isCorrect ? "correct" : "incorrect",
    marksAwarded: isCorrect ? totalMarks : 0,
    totalMarks,
    correctIndex: ci,
    correctLabel: ci >= 0 ? mcqOptionLabel(ci) : "",
    correctOption,
    selectedIndex: si,
    selectedLabel: si >= 0 ? mcqOptionLabel(si) : "",
    selectedOption,
  };
}

function parseMarkSchemeMcqLines(markScheme: string[]): {
  whyCorrectParts: string[];
  wrongByLabel: Map<string, string>;
} {
  const whyCorrectParts: string[] = [];
  const wrongByLabel = new Map<string, string>();

  for (const raw of markScheme) {
    const line = String(raw ?? "").trim();
    if (!line) continue;

    const correctMatch = line.match(CORRECT_ANSWER_LINE_RE);
    if (correctMatch) {
      const trailing = (correctMatch[2] || "").trim();
      if (trailing) whyCorrectParts.push(trailing);
      continue;
    }

    const whyWrongMatch = line.match(WHY_WRONG_LINE_RE);
    if (whyWrongMatch) {
      wrongByLabel.set(whyWrongMatch[1].toUpperCase(), whyWrongMatch[2].trim());
      continue;
    }

    if (/^why\s+.+\s+is\s+correct:/i.test(line)) {
      whyCorrectParts.push(line.replace(/^why\s+.+\s+is\s+correct:\s*/i, "").trim() || line);
      continue;
    }
  }

  return { whyCorrectParts, wrongByLabel };
}

export function buildMcqFeedback(input: {
  grade: McqGradeResult;
  options: string[];
  markScheme?: string[];
  explanation?: string;
  correctAnswer?: string;
  optionExplanations?: (string | null | undefined)[];
}): McqFeedback {
  const {
    grade,
    options,
    markScheme = [],
    explanation,
    correctAnswer,
    optionExplanations = [],
  } = input;

  const lines = markScheme.map((l) => String(l ?? "").trim()).filter(Boolean);
  const { whyCorrectParts, wrongByLabel } = parseMarkSchemeMcqLines(lines);

  const expl = String(explanation ?? "").trim();
  if (expl) whyCorrectParts.unshift(expl);

  const ca = String(correctAnswer ?? "").trim();
  if (ca && !whyCorrectParts.length) whyCorrectParts.push(ca);

  const whyCorrect = whyCorrectParts.filter(Boolean).join("\n\n") || undefined;

  const wrongOptionExplanations: McqOptionExplanation[] = [];
  options.forEach((opt, i) => {
    if (i === grade.correctIndex) return;
    const label = mcqOptionLabel(i);
    const fromScheme = wrongByLabel.get(label);
    const fromField = String(optionExplanations[i] ?? "").trim();
    const text = fromField || fromScheme;
    if (!text) return;
    wrongOptionExplanations.push({
      label,
      option: String(opt ?? "").trim(),
      explanation: text,
    });
  });

  let whySelectedWrong: string | undefined;
  if (grade.status === "incorrect" && grade.selectedIndex >= 0) {
    const selectedExpl =
      String(optionExplanations[grade.selectedIndex] ?? "").trim() ||
      wrongByLabel.get(grade.selectedLabel);
    if (selectedExpl) {
      whySelectedWrong = selectedExpl;
    } else if (grade.correctLabel && grade.correctOption) {
      whySelectedWrong = `The correct answer is ${grade.correctLabel} — ${grade.correctOption}.`;
    }
  }

  let improvementTip: string | undefined;
  if (grade.status === "incorrect") {
    improvementTip =
      whySelectedWrong ||
      (grade.correctLabel && grade.correctOption
        ? `Review why ${grade.correctLabel} (${grade.correctOption}) is correct.`
        : "Review the correct answer and explanation.");
  }

  return {
    whyCorrect,
    whySelectedWrong,
    wrongOptionExplanations,
    improvementTip,
  };
}
