import React from "react";
import type { AiCompositeDifficulty, AiCompositeQuestionStyle } from "./compositeAiDraft";
import type { StimulusTable } from "../../components/lesson/examComposite/stimulusTable";
import { CompositeStimulusTable } from "../../components/lesson/examComposite/CompositeStimulusTable";

export type CompositeAiDraftPanelProps = {
  questionStyle: AiCompositeQuestionStyle;
  onQuestionStyleChange: (s: AiCompositeQuestionStyle) => void;
  difficulty: AiCompositeDifficulty;
  onDifficultyChange: (d: AiCompositeDifficulty) => void;
  onGenerate: () => void;
  generating: boolean;
  status: string | null;
  error: string | null;
  disabled?: boolean;
  stimulusPreview?: StimulusTable | null;
};

export function CompositeAiDraftPanel({
  questionStyle,
  onQuestionStyleChange,
  difficulty,
  onDifficultyChange,
  onGenerate,
  generating,
  status,
  error,
  disabled,
  stimulusPreview,
}: CompositeAiDraftPanelProps): React.ReactElement {
  const isDataTable = questionStyle === "data_table";

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
        {isDataTable
          ? " Data-table mode creates a read-only data stimulus plus short-answer parts. Fill-in table parts remain manual."
          : " AI will generate one multiple-choice part plus short-answer parts. Table parts remain manual."}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
          Question style{" "}
          <select
            data-testid="composite-ai-question-style"
            aria-label="AI question style"
            value={questionStyle}
            disabled={generating || disabled}
            onChange={(e) => onQuestionStyleChange(e.target.value as AiCompositeQuestionStyle)}
            style={{ marginLeft: 6, padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }}
          >
            <option value="standard">Standard composite</option>
            <option value="data_table">Data-table question</option>
          </select>
        </label>
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
      {stimulusPreview ? (
        <div data-testid="composite-ai-stimulus-preview" style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
            Data table preview (read-only stimulus)
          </div>
          <CompositeStimulusTable table={stimulusPreview} testId="composite-ai-stimulus-table" />
        </div>
      ) : null}
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
