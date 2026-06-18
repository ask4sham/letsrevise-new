import {
  buildMarkPointContract,
  type MarkPointContract,
  type MarkingConfidence,
  normaliseMarkingText,
} from "./markPointContract";
import { checkContradiction, markShortAnswer } from "./shortAnswerMarking";

export type { MarkPointContract, MarkingConfidence };

export interface GradeShortAnswerResult {
  score: number;
  maxMarks: number;
  confidence: MarkingConfidence;
  /** False when confidence is low — do not show estimated score to students */
  showEstimatedScore: boolean;
  hits: string[];
  missing?: string[];
  included?: string[];
  toImprove?: string[];
  guidedSelfCheck?: string[];
  contract?: MarkPointContract;
  contradictionFeedback?: string;
}

/** Deterministic short-answer scoring (shared by QuizView and practice questions). */
export function gradeShortAnswer({
  userAnswer,
  question,
  markScheme,
  correctAnswer,
  marks,
}: {
  userAnswer: string;
  question?: string;
  markScheme?: string[];
  correctAnswer?: string;
  marks: number;
}): GradeShortAnswerResult {
  const maxMarks = Math.max(1, marks || 1);
  const modelAnswer = (correctAnswer || "").trim();
  const scheme = Array.isArray(markScheme)
    ? markScheme.map((l) => String(l ?? "").trim()).filter(Boolean)
    : [];

  const acceptableAnswers = [...scheme, ...(modelAnswer ? [modelAnswer] : [])].filter(Boolean);
  const ua = normaliseMarkingText(userAnswer);

  if (acceptableAnswers.length > 0 && ua) {
    const contradiction = checkContradiction(userAnswer, acceptableAnswers);
    if (contradiction.isContradiction) {
      const feedback = contradiction.negatedConcept
        ? `Your answer contradicts the key marking point. The expected idea includes "${contradiction.negatedConcept}" in a positive sense.`
        : "Your answer contradicts the key marking point.";
      return {
        score: 0,
        maxMarks,
        confidence: "low",
        showEstimatedScore: false,
        hits: [],
        contradictionFeedback: feedback,
        guidedSelfCheck: scheme.map(
          (line) => `Check whether your answer mentions: ${line.replace(/\.$/, "")}`
        ),
      };
    }
  }

  if (!scheme.length && !modelAnswer) {
    return {
      score: 0,
      maxMarks,
      confidence: "low",
      showEstimatedScore: false,
      hits: [],
      guidedSelfCheck: ["Compare your answer with the model answer and mark scheme."],
    };
  }

  const contract = buildMarkPointContract({
    question,
    markScheme: scheme,
    modelAnswer,
    maxMarks,
    userAnswer,
  });

  const matchedCount = contract.criteria.filter((c) => c.matched).length;
  const included = contract.criteria.filter((c) => c.matched).map((c) => c.label);
  const toImprove = contract.criteria.filter((c) => !c.matched).map((c) => c.improveHint);
  const showEstimatedScore = contract.confidence === "high" || contract.confidence === "medium";

  if (!showEstimatedScore && !scheme.length && modelAnswer) {
    const fallback = markShortAnswer(userAnswer, [modelAnswer], {
      overlapThreshold: 0.45,
      requireConceptMatch: true,
    });
    if (!fallback.correct) {
      return {
        score: 0,
        maxMarks,
        confidence: "low",
        showEstimatedScore: false,
        hits: [],
        guidedSelfCheck: contract.guidedSelfCheck,
        contract,
      };
    }
  }

  return {
    score: Math.min(matchedCount, maxMarks),
    maxMarks,
    confidence: contract.confidence,
    showEstimatedScore,
    hits: included,
    missing: toImprove.length ? toImprove : undefined,
    included: included.length ? included : undefined,
    toImprove: toImprove.length ? toImprove : undefined,
    guidedSelfCheck: contract.guidedSelfCheck,
    contract,
  };
}
