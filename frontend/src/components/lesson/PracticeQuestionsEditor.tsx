import React, { useCallback, useMemo, useState } from "react";
import type {
  LessonEditPayload,
  PracticeQuestionAttachment,
} from "../../api/lessonPracticeEdits";
import {
  applyPracticeQuestionFieldPatch,
  buildPracticeQuestionTabLabels,
  countStudentVisiblePracticeAttachments,
  getDisplayEffective,
  isPracticeAttachmentShownToStudents,
  isPracticeQuestionEdited,
  PRACTICE_QUESTION_BANK_MANAGED_MESSAGE,
  type PendingPracticeQuestionEditsMap,
} from "../../utils/practiceQuestionLessonState";

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

const COMPACT_MARKS_STYLE: React.CSSProperties = {
  width: 64,
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  marginBottom: 10,
  fontSize: 13,
};

type Props = {
  attachments: PracticeQuestionAttachment[];
  pendingEdits: PendingPracticeQuestionEditsMap;
  onUpsertLessonEdit: (questionId: string, lessonEdit: LessonEditPayload) => void;
  onClearLessonEdit: (questionId: string) => void;
  onDiscardPendingEdit: (questionId: string) => void;
  onRemoveQuestion: (questionId: string) => void;
  onAddFromQuestionBank?: () => void;
  onAutoSelectQuestions?: () => void;
  autoSelectLoading?: boolean;
};

function defaultMcqOptions(options?: string[]): string[] {
  const normalized = Array.isArray(options) ? [...options] : [];
  while (normalized.length < 4) normalized.push("");
  return normalized.slice(0, 6);
}

function bankManagedMessage(reason?: string): string {
  if (!reason) return PRACTICE_QUESTION_BANK_MANAGED_MESSAGE;
  if (/managed in the Question Bank/i.test(reason)) {
    return PRACTICE_QUESTION_BANK_MANAGED_MESSAGE;
  }
  return reason;
}

export default function PracticeQuestionsEditor({
  attachments,
  pendingEdits,
  onUpsertLessonEdit,
  onClearLessonEdit,
  onDiscardPendingEdit,
  onRemoveQuestion,
  onAddFromQuestionBank,
  onAutoSelectQuestions,
  autoSelectLoading = false,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const safeIndex = attachments.length ? Math.min(selectedIndex, attachments.length - 1) : 0;
  const current = attachments[safeIndex];
  const currentPending = current ? pendingEdits[current.questionId] : undefined;
  const display = current ? getDisplayEffective(current, currentPending) : null;
  const edited = current ? isPracticeQuestionEdited(current, currentPending) : false;
  const questionType = display?.type || current?.master?.type || current?.effective?.type;

  const tabLabels = useMemo(
    () => buildPracticeQuestionTabLabels(attachments),
    [attachments]
  );
  const studentVisibleCount = useMemo(
    () => countStudentVisiblePracticeAttachments(attachments),
    [attachments]
  );

  const applyPatch = useCallback(
    (patch: Parameters<typeof applyPracticeQuestionFieldPatch>[2]) => {
      if (!current) return;
      const nextEdit = applyPracticeQuestionFieldPatch(current, currentPending, patch);
      onUpsertLessonEdit(current.questionId, nextEdit);
    },
    [current, currentPending, onUpsertLessonEdit]
  );

  const handleUndoEdit = useCallback(() => {
    if (!current) return;
    if (currentPending?.action === "upsert" && !current.hasLessonEdit) {
      onDiscardPendingEdit(current.questionId);
      return;
    }
    if (current.hasLessonEdit || currentPending?.action === "upsert") {
      onClearLessonEdit(current.questionId);
    }
  }, [current, currentPending, onClearLessonEdit, onDiscardPendingEdit]);

  const handleRemove = useCallback(() => {
    if (!current) return;
    if (
      !window.confirm(
        "Remove this question from the lesson? The question will stay in the Question Bank."
      )
    ) {
      return;
    }
    onRemoveQuestion(current.questionId);
    setSelectedIndex((idx) => Math.max(0, idx - 1));
  }, [current, onRemoveQuestion]);

  const statusLabel = useMemo(() => {
    if (!current) return "";
    if (edited) return "Your edited question";
    return "Question from bank — edit to customise";
  }, [current, edited]);

  const isUnsupportedBankManaged =
    current &&
    !current.editable &&
    Boolean(current.unsupportedReason) &&
    current.available;

  const isUnavailable = current && !current.available && !current.editable;

  if (!attachments.length) {
    return (
      <div style={{ fontSize: 13, color: "#64748b" }}>
        <p style={{ margin: "0 0 8px", fontWeight: 600, color: "#334155" }}>
          No practice questions added yet.
        </p>
        <p style={{ margin: "0 0 16px" }}>
          Add questions for students to practise at the end of the lesson.
        </p>
        {(onAddFromQuestionBank || onAutoSelectQuestions) && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {onAddFromQuestionBank && (
              <button
                type="button"
                onClick={onAddFromQuestionBank}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "2px solid rgba(59,130,246,0.4)",
                  background: "rgba(59,130,246,0.08)",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#1e40af",
                }}
              >
                Add from Question Bank
              </button>
            )}
            {onAutoSelectQuestions && (
              <button
                type="button"
                onClick={onAutoSelectQuestions}
                disabled={autoSelectLoading}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "2px solid rgba(34,197,94,0.4)",
                  background: "rgba(34,197,94,0.08)",
                  cursor: autoSelectLoading ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#166534",
                  opacity: autoSelectLoading ? 0.7 : 1,
                }}
              >
                {autoSelectLoading ? "Selecting…" : "Auto-select questions"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>
        Edit the questions students will answer in this lesson. Changes are saved when you click{" "}
        <strong>Save Changes</strong> for the lesson.
      </p>

      {studentVisibleCount > 10 && (
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#92400e", fontWeight: 600 }}>
          Students see the first 10 questions they can answer, in this order.
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {tabLabels.map((tab) => {
          const att = attachments[tab.teacherIndex];
          const pending = pendingEdits[att.questionId];
          const tabEdited = isPracticeQuestionEdited(att, pending);
          return (
            <button
              key={att.questionId}
              type="button"
              onClick={() => setSelectedIndex(tab.teacherIndex)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: tab.teacherIndex === safeIndex ? "2px solid #2563eb" : "1px solid #cbd5e1",
                background: tab.teacherIndex === safeIndex ? "#eff6ff" : "#fff",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {tab.label}
              {tabEdited ? " ✎" : ""}
            </button>
          );
        })}
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
          {isUnavailable && current.unsupportedReason && (
            <>
              <div
                style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#fef2f2",
                  color: "#b91c1c",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {current.unsupportedReason}
              </div>
              <button
                type="button"
                onClick={handleRemove}
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
                Remove Question
              </button>
            </>
          )}

          {isUnsupportedBankManaged && (
            <>
              {!isPracticeAttachmentShownToStudents(current) && (
                <div
                  style={{
                    marginBottom: 10,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#f1f5f9",
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Not shown to students
                </div>
              )}
              <div
                style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#fef3c7",
                  color: "#92400e",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {bankManagedMessage(current.unsupportedReason)}
              </div>
              <button
                type="button"
                onClick={handleRemove}
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
                Remove Question
              </button>
            </>
          )}

          {current.editable && display && (
            <>
              <div style={{ marginBottom: 8, fontSize: 12, color: "#64748b" }}>{statusLabel}</div>

              <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                Question
              </label>
              <textarea
                value={display.question ?? ""}
                onChange={(e) => applyPatch({ question: e.target.value })}
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

              <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                Marks
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={display.marks ?? 1}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  applyPatch({ marks: Number.isFinite(n) && n >= 1 ? n : 1 });
                }}
                style={COMPACT_MARKS_STYLE}
                aria-label="Marks"
              />

              {questionType === "mcq" && (
                <>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Options</div>
                  {defaultMcqOptions(display.options).map((opt, oi) => (
                    <div key={oi} style={MCQ_OPTION_ROW_STYLE}>
                      <input
                        type="radio"
                        name={`pq-correct-${current.questionId}`}
                        checked={
                          Boolean(opt.trim()) &&
                          (display.correctAnswer ?? "").trim() === opt.trim()
                        }
                        onChange={() => applyPatch({ correctAnswer: opt })}
                        style={MCQ_RADIO_STYLE}
                        aria-label={`Mark option ${oi + 1} as correct`}
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const next = defaultMcqOptions(display.options);
                          next[oi] = e.target.value;
                          const prevCorrect = (display.correctAnswer ?? "").trim();
                          const nextCorrect =
                            prevCorrect === opt.trim() ? e.target.value.trim() : display.correctAnswer;
                          applyPatch({ options: next, correctAnswer: nextCorrect });
                        }}
                        placeholder={`Option ${oi + 1}`}
                        style={MCQ_TEXT_INPUT_STYLE}
                        aria-label={`Option ${oi + 1} text`}
                      />
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    {defaultMcqOptions(display.options).filter((o) => o.trim()).length < 6 && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = defaultMcqOptions(display.options);
                          if (next.filter((o) => o.trim()).length >= 6) return;
                          next.push("");
                          applyPatch({ options: next });
                        }}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        + Add option
                      </button>
                    )}
                    {defaultMcqOptions(display.options).filter((o) => o.trim()).length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = defaultMcqOptions(display.options).filter((o) => o.trim());
                          next.pop();
                          const ca = (display.correctAnswer ?? "").trim();
                          const stillValid = next.some((o) => o.trim() === ca);
                          applyPatch({
                            options: next.length >= 2 ? next : next.concat([""]),
                            correctAnswer: stillValid ? display.correctAnswer : next[0],
                          });
                        }}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid #fecaca",
                          background: "#fef2f2",
                          color: "#b91c1c",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Remove last option
                      </button>
                    )}
                  </div>
                </>
              )}

              {questionType === "short" && (
                <>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Mark scheme</div>
                  {(display.markScheme?.length ? display.markScheme : [""]).map((line, mi) => (
                    <div key={mi} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <input
                        type="text"
                        value={line}
                        onChange={(e) => {
                          const base = display.markScheme?.length ? [...display.markScheme] : [""];
                          base[mi] = e.target.value;
                          applyPatch({ markScheme: base });
                        }}
                        placeholder={`Mark point ${mi + 1}`}
                        style={{ ...MCQ_TEXT_INPUT_STYLE, flex: 1 }}
                        aria-label={`Mark point ${mi + 1}`}
                      />
                      {(display.markScheme?.length ?? 1) > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const base = [...(display.markScheme ?? [""])];
                            base.splice(mi, 1);
                            applyPatch({ markScheme: base.length ? base : [""] });
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: "1px solid #fecaca",
                            background: "#fef2f2",
                            color: "#b91c1c",
                            cursor: "pointer",
                            fontSize: 12,
                            flexShrink: 0,
                          }}
                        >
                          Remove mark point
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const base = display.markScheme?.length ? [...display.markScheme] : [""];
                      base.push("");
                      applyPatch({ markScheme: base });
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      cursor: "pointer",
                      fontSize: 12,
                      marginBottom: 10,
                    }}
                  >
                    + Add mark point
                  </button>
                </>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {edited && (
                  <button
                    type="button"
                    onClick={handleUndoEdit}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    Undo Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRemove}
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
                  Remove Question
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
