import React, { useCallback, useMemo, useState } from "react";
import {
  buildRevisionPracticePool,
  type LayerQuizQuestion,
} from "../../utils/lessonQuestionPools";
import {
  collectCheckpointMcqsFromPages,
  createRevisionVariantFromCheckpoint,
  sourceLinkageKeyFromCheckpoint,
} from "../../utils/revisionPracticeVariants";
import {
  findRevisionPracticeOverride,
  isRevisionPracticeOverride,
  type PersistedLessonQuizQuestion,
} from "../../utils/revisionPracticeOverrides";
import type {
  RevisionPracticeOverrideRemoveInput,
  RevisionPracticeOverrideUpsertInput,
} from "../../utils/revisionPracticeLessonState";

export type RevisionPracticeEditorPage = {
  pageId?: string;
  blocks?: unknown[];
  checkpoint?: unknown;
};

type EditorSlot = {
  key: string;
  linkageKey: string | null;
  isOverride: boolean;
  isOrphan: boolean;
  isGenerated: boolean;
  overrideId?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  sourcePageId?: string;
  sourceBlockIndex?: number;
  sourceQuestionBankId?: string;
};

type Props = {
  pages: RevisionPracticeEditorPage[];
  quizQuestions: PersistedLessonQuizQuestion[];
  onUpsertOverride: (patch: RevisionPracticeOverrideUpsertInput) => void;
  onRemoveOverride: (opts: RevisionPracticeOverrideRemoveInput) => void;
  max?: number;
};

function emptyMcqOptions(): string[] {
  return ["", "", "", ""];
}

/** Match EditLessonPage MCQ rows — overrides global `input { width: 100% }` in App.css. */
const MCQ_OPTION_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  marginBottom: 6,
  minWidth: 0,
  width: "100%",
  boxSizing: "border-box",
};

const MCQ_RADIO_STYLE: React.CSSProperties = {
  flexShrink: 0,
  width: "auto",
  padding: 0,
  margin: 0,
};

const MCQ_TEXT_INPUT_STYLE: React.CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  width: "auto",
  padding: "8px 10px",
  borderRadius: 8,
  border: "2px solid rgba(0,0,0,0.14)",
  backgroundColor: "#fff",
  boxSizing: "border-box",
  fontSize: 13,
};

function buildEditorSlots(
  pages: RevisionPracticeEditorPage[],
  quizQuestions: PersistedLessonQuizQuestion[],
  max: number
): EditorSlot[] {
  const pool = buildRevisionPracticePool(pages, quizQuestions as Record<string, unknown>[], max);
  const checkpoints = collectCheckpointMcqsFromPages(pages);
  const slots: EditorSlot[] = [];
  const checkpointSegments: EditorSlot[] = [];
  const matchedLinkageKeys = new Set<string>();

  for (let i = 0; i < checkpoints.length; i++) {
    const source = checkpoints[i];
    const linkageKey = sourceLinkageKeyFromCheckpoint(source);
    const override = linkageKey
      ? findRevisionPracticeOverride(quizQuestions, linkageKey)
      : undefined;
    if (override) {
      matchedLinkageKeys.add(linkageKey);
      checkpointSegments.push({
        key: `override-${linkageKey}`,
        linkageKey,
        isOverride: true,
        isOrphan: false,
        isGenerated: false,
        overrideId: override.id,
        question: override.question,
        options: [...(override.options ?? emptyMcqOptions())],
        correctAnswer: override.correctAnswer,
        explanation: override.explanation,
        sourcePageId: source.sourcePageId,
        sourceBlockIndex: source.sourceBlockIndex,
        sourceQuestionBankId: source.sourceQuestionId,
      });
      continue;
    }
    const generated = createRevisionVariantFromCheckpoint(source, i, checkpoints);
    if (!generated) continue;
    checkpointSegments.push({
      key: linkageKey ? `generated-${linkageKey}` : `generated-${i}`,
      linkageKey: linkageKey || null,
      isOverride: false,
      isOrphan: false,
      isGenerated: true,
      question: generated.question,
      options: [...generated.options],
      correctAnswer: generated.correctAnswer,
      explanation: generated.explanation,
      sourcePageId: source.sourcePageId,
      sourceBlockIndex: source.sourceBlockIndex,
      sourceQuestionBankId: source.sourceQuestionId,
    });
  }

  const orphanSlots: EditorSlot[] = [];
  for (const q of quizQuestions) {
    if (!isRevisionPracticeOverride(q as Record<string, unknown>)) continue;
    const linkageKey = String(q.sourceQuestionId ?? "").trim();
    if (!linkageKey || matchedLinkageKeys.has(linkageKey)) continue;
    orphanSlots.push({
      key: `orphan-${q.id}`,
      linkageKey,
      isOverride: true,
      isOrphan: true,
      isGenerated: false,
      overrideId: q.id,
      question: q.question,
      options: [...(q.options ?? emptyMcqOptions())],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    });
  }

  const checkpointBudget = Math.max(0, max - orphanSlots.length);
  for (let i = 0; i < checkpointSegments.length && slots.length < checkpointBudget; i++) {
    slots.push(checkpointSegments[i]);
  }
  for (const orphanSlot of orphanSlots) {
    if (slots.length >= max) break;
    slots.push(orphanSlot);
  }

  for (let i = 0; i < pool.length && slots.length < max; i++) {
    const layer = pool[i] as LayerQuizQuestion;
    const raw = quizQuestions.find((q) => q.id === layer.id);
    if (raw && isRevisionPracticeOverride(raw as Record<string, unknown>)) continue;
    if (slots.some((s) => s.question === layer.question && s.correctAnswer === layer.correctAnswer)) {
      continue;
    }
    slots.push({
      key: `stored-${layer.id}`,
      linkageKey: null,
      isOverride: false,
      isOrphan: false,
      isGenerated: layer.questionSource === "variant-generated",
      question: layer.question,
      options: [...layer.options],
      correctAnswer: layer.correctAnswer,
      explanation: layer.explanation,
    });
  }

  return slots.slice(0, max);
}

export default function RevisionPracticeEditor({
  pages,
  quizQuestions,
  onUpsertOverride,
  onRemoveOverride,
  max = 5,
}: Props) {
  const slots = useMemo(
    () => buildEditorSlots(pages, quizQuestions, max),
    [pages, quizQuestions, max]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const safeIndex = slots.length ? Math.min(selectedIndex, slots.length - 1) : 0;
  const current = slots[safeIndex];

  const applySlotUpdate = useCallback(
    (patch: Partial<EditorSlot>) => {
      if (!current) return;
      onUpsertOverride({
        linkageKey: current.linkageKey ?? undefined,
        sourcePageId: current.sourcePageId,
        sourceBlockIndex: current.sourceBlockIndex,
        sourceQuestionBankId: current.sourceQuestionBankId,
        question: patch.question ?? current.question,
        options: patch.options ?? current.options,
        correctAnswer: patch.correctAnswer ?? current.correctAnswer,
        explanation: patch.explanation ?? current.explanation,
        existingOverrideId: current.overrideId,
      });
    },
    [current, onUpsertOverride]
  );

  const handleRemoveOverride = useCallback(() => {
    if (!current?.isOverride) return;
    onRemoveOverride({
      linkageKey: current.linkageKey ?? undefined,
      overrideId: current.overrideId,
    });
  }, [current, onRemoveOverride]);

  if (!slots.length) {
    return (
      <div style={{ fontSize: 13, color: "#64748b" }}>
        No Revision Practice questions yet. Add checkpoint or self-check blocks with MCQs to generate
        revision questions for students.
      </div>
    );
  }

  return (
    <div>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>
        Edit the lesson&apos;s Revision Practice questions. Changes are saved when you click{" "}
        <strong>Save Changes</strong> for the lesson.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {slots.map((slot, idx) => (
          <button
            key={slot.key}
            type="button"
            onClick={() => setSelectedIndex(idx)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: idx === safeIndex ? "2px solid #2563eb" : "1px solid #cbd5e1",
              background: idx === safeIndex ? "#eff6ff" : "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Q{idx + 1}
            {slot.isOverride ? " ✎" : ""}
          </button>
        ))}
      </div>

      {current && (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          <div style={{ marginBottom: 8, fontSize: 12, color: "#64748b" }}>
            {current.isOverride
              ? "Your edited question"
              : current.isGenerated
                ? "Question from lesson — edit to customise"
                : "Stored revision question"}
          </div>

          <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
            Question
          </label>
          <textarea
            value={current.question}
            onChange={(e) => applySlotUpdate({ question: e.target.value })}
            rows={3}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              marginBottom: 10,
              fontSize: 14,
              boxSizing: "border-box",
            }}
          />

          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Options</div>
          {(current.options.length ? current.options : emptyMcqOptions()).map((opt, oi) => (
            <div key={oi} style={MCQ_OPTION_ROW_STYLE}>
              <input
                type="radio"
                name={`rp-correct-${current.key}`}
                checked={current.correctAnswer === opt && Boolean(opt.trim())}
                onChange={() => applySlotUpdate({ correctAnswer: opt })}
                style={MCQ_RADIO_STYLE}
                aria-label={`Mark option ${oi + 1} as correct`}
              />
              <input
                type="text"
                value={opt}
                onChange={(e) => {
                  const next = [...(current.options.length ? current.options : emptyMcqOptions())];
                  next[oi] = e.target.value;
                  const nextCorrect =
                    current.correctAnswer === opt ? e.target.value : current.correctAnswer;
                  applySlotUpdate({ options: next, correctAnswer: nextCorrect });
                }}
                placeholder={`Option ${oi + 1}`}
                style={MCQ_TEXT_INPUT_STYLE}
                aria-label={`Option ${oi + 1} text`}
              />
            </div>
          ))}

          <label style={{ display: "block", fontWeight: 600, fontSize: 13, margin: "10px 0 4px" }}>
            Explanation (optional)
          </label>
          <textarea
            value={current.explanation ?? ""}
            onChange={(e) => applySlotUpdate({ explanation: e.target.value })}
            rows={2}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              marginBottom: 10,
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />

          {current.isOverride && (
            <button
              type="button"
              onClick={handleRemoveOverride}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#b91c1c",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {current.isOrphan ? "Remove Question" : "Undo Edit"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { buildEditorSlots };
export type {
  RevisionPracticeOverrideRemoveInput,
  RevisionPracticeOverrideUpsertInput,
} from "../../utils/revisionPracticeLessonState";
