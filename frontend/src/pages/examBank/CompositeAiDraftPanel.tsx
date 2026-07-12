import React from "react";
import type { AiCompositeDifficulty } from "./compositeAiDraft";

export type CompositeAiDraftPanelProps = {
  difficulty: AiCompositeDifficulty;
  onDifficultyChange: (d: AiCompositeDifficulty) => void;
  onGenerate: () => void;
  generating: boolean;
  status: string | null;
  error: string | null;
  disabled?: boolean;
};

export function CompositeAiDraftPanel({
  difficulty,
  onDifficultyChange,
  onGenerate,
  generating,
  status,
  error,
  disabled,
}: CompositeAiDraftPanelProps): React.ReactElement {
  return (
    <div
      data-testid="composite-ai-draft-panel"
      style={{
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        borderRadius: 8,
        padding: "12px 12px 10px",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 650, color: "#0f172a", marginBottom: 8 }}>
        Generate with AI
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
        Fills a draft composite question for review. Nothing is saved until you click Save Draft.
        AI may generate short-answer and multiple-choice parts. Table parts remain manual.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
          Difficulty{" "}
          <select
            data-testid="composite-ai-difficulty"
            aria-label="AI draft difficulty"
            value={difficulty}
            disabled={generating || disabled}
            onChange={(e) => onDifficultyChange(e.target.value as AiCompositeDifficulty)}
            style={{ marginLeft: 6, padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <button
          type="button"
          data-testid="composite-ai-generate"
          disabled={generating || disabled}
          onClick={onGenerate}
          style={{
            padding: "7px 12px",
            borderRadius: 8,
            border: "1px solid #0369a1",
            background: generating ? "#e0f2fe" : "#0284c7",
            color: generating ? "#0369a1" : "#fff",
            fontWeight: 600,
            fontSize: 13,
            cursor: generating || disabled ? "not-allowed" : "pointer",
          }}
        >
          {generating ? "Generating…" : "Generate with AI"}
        </button>
      </div>
      {error ? (
        <p data-testid="composite-ai-error" role="alert" style={{ margin: "10px 0 0", fontSize: 12, color: "#b91c1c" }}>
          {error}
        </p>
      ) : null}
      {status && !error ? (
        <p data-testid="composite-ai-status" role="status" style={{ margin: "10px 0 0", fontSize: 12, color: "#0f766e" }}>
          {status}
        </p>
      ) : null}
    </div>
  );
}
