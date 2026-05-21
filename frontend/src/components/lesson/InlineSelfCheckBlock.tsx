import React, { useMemo, useState } from "react";
import { CheckpointDifficultyBadge } from "./CheckpointDifficultyBadge";
import {
  isPlaceholderMcqOptions,
  recoverMcqFieldsFromBlockContent,
} from "../../utils/mcqPlaceholderOptions";

/** Legacy paste/html conversion sometimes left summary UI text in the stem — strip so the purple reveal button is the only reveal. */
function sanitizeSelfCheckPrompt(text: string): string {
  return String(text ?? "")
    .replace(/\bReveal\s*:\s*Reveal\s+Answer\b/gi, "")
    .replace(/\bReveal\s*:\s*Reveal\s+model\s+answer\b/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type InlineSelfCheckBlockProps = {
  prompt: string;
  questionType: "mcq" | "short";
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  markScheme?: string[];
  presentation?: "default" | "v12";
  /** e.g. "Quick check" for checkpoint blocks; default "Self-check" */
  headingLabel?: string;
  /** Generator HTML / CHECKPOINT paste — used when options are still placeholders. */
  contentFallback?: string;
};

/**
 * Inline self-check: no scoring, no page.checkpoint — reveal/hide model answer only.
 */
export function InlineSelfCheckBlock({
  prompt,
  questionType,
  options = [],
  correctAnswer,
  explanation,
  markScheme,
  presentation = "default",
  headingLabel = "Self-check",
  contentFallback = "",
}: InlineSelfCheckBlockProps): React.ReactElement {
  const [revealed, setRevealed] = useState(false);
  const v12 = presentation === "v12";
  const isMcq = questionType === "mcq";

  const resolved = useMemo(() => {
    let p = sanitizeSelfCheckPrompt(String(prompt ?? ""));
    let opts = options.map((o) => String(o ?? "").trim());
    let ca = String(correctAnswer ?? "").trim();
    let expl = String(explanation ?? "").trim();
    if (isMcq && isPlaceholderMcqOptions(opts)) {
      const recovered = recoverMcqFieldsFromBlockContent(contentFallback);
      if (recovered) {
        p = recovered.prompt || p;
        opts = recovered.options;
        ca = recovered.correctAnswer || ca;
        expl = recovered.explanation || expl;
      }
    }
    return {
      prompt: p,
      options: opts.filter(Boolean),
      correctAnswer: ca,
      explanation: expl,
    };
  }, [contentFallback, correctAnswer, explanation, isMcq, options, prompt]);

  const displayPrompt = resolved.prompt;
  const filledOptions = resolved.options;
  const displayAnswer = resolved.correctAnswer;
  const displayExplanation = resolved.explanation;

  const box: React.CSSProperties = v12
    ? {
        marginTop: 20,
        marginBottom: 8,
        padding: 16,
        borderRadius: 14,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        textAlign: "left" as const,
      }
    : {
        marginTop: 14,
        marginBottom: 10,
        padding: 16,
        borderRadius: 14,
        background: "#f8f9fa",
        border: "2px solid rgba(16,185,129,0.28)",
        boxShadow: "0 0 0 2px rgba(16,185,129,0.06)",
        textAlign: "left" as const,
      };

  return (
    <div style={box} className={v12 ? "lesson-inline-selfcheck-v12" : undefined}>
      <div
        style={{
          fontSize: v12 ? 12 : 13,
          fontWeight: 700,
          color: v12 ? "#64748b" : "#047857",
          marginBottom: 8,
          letterSpacing: "0.02em",
        }}
      >
        {headingLabel}
      </div>
      <CheckpointDifficultyBadge markScheme={markScheme} />
      <div
        style={{
          fontWeight: 700,
          marginBottom: isMcq && filledOptions.length > 0 ? 12 : 10,
          color: "#111827",
          fontSize: v12 ? 16 : undefined,
          lineHeight: 1.55,
        }}
      >
        {displayPrompt || "Question"}
      </div>
      {isMcq && filledOptions.length > 0 && !isPlaceholderMcqOptions(filledOptions) ? (
        <ol
          style={{
            margin: "0 0 12px 0",
            paddingLeft: 22,
            lineHeight: 1.75,
            color: "#374151",
            fontSize: v12 ? 15 : undefined,
          }}
        >
          {filledOptions.map((opt, i) => (
            <li key={i}>{opt}</li>
          ))}
        </ol>
      ) : null}
      {isMcq && isPlaceholderMcqOptions(filledOptions) ? (
        <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
          Options for this question were not saved correctly. Ask your teacher to re-import or edit this
          self-check in Edit lesson.
        </p>
      ) : null}

      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          aria-expanded={revealed}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "2px solid rgba(5,150,105,0.45)",
            background: revealed ? "rgba(5,150,105,0.12)" : "white",
            cursor: "pointer",
            fontWeight: 700,
            color: "#047857",
            fontSize: 14,
          }}
        >
          {revealed ? "Hide answer" : "Reveal answer"}
        </button>
      </div>

      {revealed ? (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontSize: 14, color: "#374151" }}>
            <strong style={{ color: "#111827" }}>Answer:</strong>{" "}
            <span>{displayAnswer || "—"}</span>
          </div>
          {displayExplanation ? (
            <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "#4b5563" }}>
              <strong style={{ color: "#374151" }}>Explanation:</strong> {displayExplanation}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
