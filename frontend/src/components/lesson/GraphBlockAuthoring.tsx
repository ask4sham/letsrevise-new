import React, { useMemo, useState } from "react";
import { generateGraphBlockFromPrompt } from "../../api/ai";
import { GraphBlock } from "./GraphBlock";
import {
  createGraphAnnotationId,
  createGraphSeriesId,
  GRAPH_CHART_TYPE_LABELS,
  normalizeGraphChartType,
  parseGraphBlockPayload,
  type GraphAnnotation,
  type GraphBlockChartType,
  type GraphDataPoint,
  type GraphSeries,
} from "./graphBlockTypes";
import { GRAPH_BLOCK_TEMPLATES } from "./graphBlockTemplates";

export type GraphBlockAuthoringBlock = {
  type?: string;
  title?: string;
  intro?: string;
  graphType?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xUnits?: string;
  yUnits?: string;
  graphSeries?: GraphSeries[];
  series?: GraphSeries[];
  graphAnnotations?: GraphAnnotation[];
  annotations?: GraphAnnotation[];
  examQuestion?: string;
  markScheme?: string | string[];
  examinerTip?: string;
};

type Props = {
  blk: GraphBlockAuthoringBlock;
  onPatch: (patch: Partial<GraphBlockAuthoringBlock>) => void;
  lessonTitle?: string;
  pageTitle?: string;
  subject?: string;
  level?: string;
  compact?: boolean;
};

const fieldLabel: React.CSSProperties = { fontWeight: 700, marginBottom: 4, fontSize: 13 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: "0.875rem",
  fontFamily: "inherit",
};

export function GraphBlockAuthoring({
  blk,
  onPatch,
  lessonTitle,
  pageTitle,
  subject,
  level,
  compact,
}: Props): React.ReactElement {
  const parsed = useMemo(() => parseGraphBlockPayload(blk), [blk]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const series = parsed.series.length ? parsed.series : [{ id: createGraphSeriesId(), label: "Series 1", points: [] }];

  const patchSeries = (next: GraphSeries[]) => {
    onPatch({ graphSeries: next, series: undefined });
  };

  const updatePoint = (seriesIndex: number, pointIndex: number, field: "x" | "y", value: string) => {
    const next = series.map((s, si) => {
      if (si !== seriesIndex) return s;
      const points = s.points.map((p, pi) => {
        if (pi !== pointIndex) return p;
        if (field === "y") {
          const y = Number(value);
          return { ...p, y: Number.isFinite(y) ? y : 0 };
        }
        const xNum = Number(value);
        const x = Number.isFinite(xNum) && value.trim() !== "" ? xNum : value;
        return { ...p, x };
      });
      return { ...s, points };
    });
    patchSeries(next);
  };

  const addPoint = (seriesIndex: number) => {
    const next = series.map((s, si) => {
      if (si !== seriesIndex) return s;
      const last = s.points[s.points.length - 1];
      const nextX =
        typeof last?.x === "number" ? last.x + 1 : s.points.length;
      const nextY = typeof last?.y === "number" ? last.y : 0;
      return { ...s, points: [...s.points, { x: nextX, y: nextY }] };
    });
    patchSeries(next);
  };

  const removePoint = (seriesIndex: number, pointIndex: number) => {
    const next = series.map((s, si) => {
      if (si !== seriesIndex) return s;
      return { ...s, points: s.points.filter((_, pi) => pi !== pointIndex) };
    });
    patchSeries(next);
  };

  const runAi = async () => {
    const prompt = aiPrompt.trim();
    if (prompt.length < 4) {
      setAiError("Enter at least 4 characters describing the graph you need.");
      return;
    }
    setAiBusy(true);
    setAiError(null);
    try {
      const draft = await generateGraphBlockFromPrompt({
        prompt,
        lessonTitle,
        pageTitle,
        subject,
        level,
        graphType: parsed.graphType,
      });
      onPatch({
        title: draft.title,
        intro: draft.intro,
        graphType: draft.graphType,
        xAxisLabel: draft.xAxisLabel,
        yAxisLabel: draft.yAxisLabel,
        xUnits: draft.xUnits,
        yUnits: draft.yUnits,
        graphSeries: draft.graphSeries.map((s) => ({
          id: createGraphSeriesId(),
          label: s.label,
          points: s.points,
        })),
        graphAnnotations: draft.graphAnnotations.map((a) => ({
          id: createGraphAnnotationId(),
          text: a.text,
          ...(a.kind === "trend" || a.kind === "callout" ? { kind: a.kind } : {}),
        })),
        examQuestion: draft.examQuestion,
        markScheme: draft.markScheme,
        examinerTip: draft.examinerTip,
      });
    } catch {
      setAiError("Could not generate graph — try a clearer prompt or check AI is enabled.");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={{ display: "block" }}>
        <div style={fieldLabel}>Graph type</div>
        <select
          value={parsed.graphType}
          onChange={(e) => onPatch({ graphType: e.target.value as GraphBlockChartType })}
          style={inputStyle}
        >
          {(Object.keys(GRAPH_CHART_TYPE_LABELS) as GraphBlockChartType[]).map((k) => (
            <option key={k} value={k}>
              {GRAPH_CHART_TYPE_LABELS[k]}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 10 }}>
        <label>
          <div style={fieldLabel}>X-axis label</div>
          <input style={inputStyle} value={parsed.xAxisLabel} onChange={(e) => onPatch({ xAxisLabel: e.target.value })} />
        </label>
        <label>
          <div style={fieldLabel}>X units</div>
          <input style={inputStyle} value={parsed.xUnits} onChange={(e) => onPatch({ xUnits: e.target.value })} placeholder="e.g. °C, s, mg" />
        </label>
        <label>
          <div style={fieldLabel}>Y-axis label</div>
          <input style={inputStyle} value={parsed.yAxisLabel} onChange={(e) => onPatch({ yAxisLabel: e.target.value })} />
        </label>
        <label>
          <div style={fieldLabel}>Y units</div>
          <input style={inputStyle} value={parsed.yUnits} onChange={(e) => onPatch({ yUnits: e.target.value })} />
        </label>
      </div>

      <div>
        <div style={{ ...fieldLabel, marginBottom: 8 }}>Data series</div>
        {series.map((s, si) => (
          <div
            key={s.id}
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}
          >
            <input
              style={{ ...inputStyle, marginBottom: 8, fontWeight: 600 }}
              value={s.label}
              onChange={(e) => {
                const next = series.map((row, i) => (i === si ? { ...row, label: e.target.value } : row));
                patchSeries(next);
              }}
              placeholder="Series label"
            />
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#64748b" }}>
                  <th style={{ padding: "4px 6px" }}>X</th>
                  <th style={{ padding: "4px 6px" }}>Y</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {s.points.map((p: GraphDataPoint, pi) => (
                  <tr key={`${s.id}-${pi}`}>
                    <td style={{ padding: "4px 4px 4px 0" }}>
                      <input
                        style={{ ...inputStyle, padding: "6px 8px" }}
                        value={String(p.x)}
                        onChange={(e) => updatePoint(si, pi, "x", e.target.value)}
                      />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <input
                        style={{ ...inputStyle, padding: "6px 8px" }}
                        type="number"
                        step="any"
                        value={p.y}
                        onChange={(e) => updatePoint(si, pi, "y", e.target.value)}
                      />
                    </td>
                    <td style={{ padding: "4px 0 4px 4px" }}>
                      <button
                        type="button"
                        onClick={() => removePoint(si, pi)}
                        disabled={s.points.length <= 2}
                        style={{
                          padding: "4px 8px",
                          fontSize: 12,
                          border: "1px solid #fca5a5",
                          background: "#fff",
                          color: "#b91c1c",
                          borderRadius: 6,
                          cursor: s.points.length <= 2 ? "not-allowed" : "pointer",
                          opacity: s.points.length <= 2 ? 0.5 : 1,
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              onClick={() => addPoint(si)}
              style={{
                marginTop: 8,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                border: "1px solid #93c5fd",
                background: "#eff6ff",
                color: "#1d4ed8",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              + Add point
            </button>
          </div>
        ))}
      </div>

      <div>
        <div style={{ ...fieldLabel, marginBottom: 6 }}>Annotations</div>
        {parsed.annotations.map((a) => (
          <div key={a.id} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={a.text}
              onChange={(e) => {
                const next = parsed.annotations.map((row) =>
                  row.id === a.id ? { ...row, text: e.target.value } : row
                );
                onPatch({ graphAnnotations: next });
              }}
            />
            <button
              type="button"
              onClick={() => onPatch({ graphAnnotations: parsed.annotations.filter((row) => row.id !== a.id) })}
              style={{ padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0", cursor: "pointer" }}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onPatch({
              graphAnnotations: [
                ...parsed.annotations,
                { id: createGraphAnnotationId(), text: "", kind: "callout" },
              ],
            })
          }
          style={{
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            border: "1px dashed #94a3b8",
            background: "#fff",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          + Annotation
        </button>
      </div>

      <label style={{ display: "block" }}>
        <div style={fieldLabel}>Exam question (graph interpretation)</div>
        <textarea
          style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
          value={parsed.examQuestion}
          onChange={(e) => onPatch({ examQuestion: e.target.value })}
          placeholder="e.g. Describe the trend as light intensity increases."
        />
      </label>
      <label style={{ display: "block" }}>
        <div style={fieldLabel}>Mark scheme</div>
        <textarea
          style={{ ...inputStyle, minHeight: 56, resize: "vertical" }}
          value={parsed.markScheme}
          onChange={(e) => onPatch({ markScheme: e.target.value })}
        />
      </label>
      <label style={{ display: "block" }}>
        <div style={fieldLabel}>Examiner tip</div>
        <textarea
          style={{ ...inputStyle, minHeight: 48, resize: "vertical" }}
          value={parsed.examinerTip}
          onChange={(e) => onPatch({ examinerTip: e.target.value })}
        />
      </label>

      <div
        style={{
          padding: 12,
          borderRadius: 10,
          border: "1px solid #c7d2fe",
          background: "linear-gradient(180deg, #eef2ff 0%, #f8fafc 100%)",
        }}
      >
        <div style={{ ...fieldLabel, color: "#3730a3" }}>Generate graph with AI</div>
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          rows={3}
          placeholder="e.g. Limiting factors graph for photosynthesis (light intensity vs rate)"
          style={{ ...inputStyle, marginBottom: 8 }}
        />
        {aiError ? <p style={{ margin: "0 0 8px", fontSize: 12, color: "#b91c1c" }}>{aiError}</p> : null}
        <button
          type="button"
          disabled={aiBusy}
          onClick={() => void runAi()}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: "#1e3a8a",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: aiBusy ? "wait" : "pointer",
            opacity: aiBusy ? 0.7 : 1,
          }}
        >
          {aiBusy ? "Generating…" : "Generate graph with AI"}
        </button>
      </div>

      {!compact ? (
        <div>
          <div style={{ ...fieldLabel, marginBottom: 8 }}>Live preview</div>
          <GraphBlock block={blk} showAnswers />
        </div>
      ) : null}
    </div>
  );
}
