import React, { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  BarElement,
  BarController,
  ScatterController,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
  type ChartData,
} from "chart.js";
import { formatStudentBlockHeading } from "../../utils/formatBlockHeading";
import { Chart } from "react-chartjs-2";
import {
  GRAPH_BLOCK_DEFAULT_COLORS,
  type GraphAnnotation,
  type GraphBlockChartType,
  type GraphSeries,
  mergeGraphBlockFromExportContent,
  parseGraphBlockPayload,
  resolveLimitingFactorGraphVisual,
} from "./graphBlockTypes";
import { LessonRichText } from "./LessonRichText";
import "./graphBlock.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  BarElement,
  BarController,
  ScatterController,
  Title,
  Tooltip,
  Legend,
  Filler
);

export type GraphBlockProps = {
  block: unknown;
  /** 0-based index — used for SS1 `N — title` when block.number is missing. */
  blockIndex?: number;
  /** When false, hide mark scheme until student reveals (default true in editor preview). */
  showAnswers?: boolean;
  /** Student lesson view vs teacher editor preview. */
  audience?: "student" | "editor";
  /**
   * When true, omit the block-level title (outer SS1 heading already labels the frame).
   */
  hideTitle?: boolean;
};

function axisTitle(label: string, units: string): string {
  const l = label.trim();
  const u = units.trim();
  if (l && u) return `${l} (${u})`;
  return l || u;
}

function buildChartData(
  graphType: GraphBlockChartType,
  series: GraphSeries[],
  xAxisLabel = "",
  yAxisLabel = ""
): { data: ChartData<"line" | "bar" | "scatter">; isCategory: boolean } {
  const isCategory = graphType === "bar";
  const first = series[0];
  const labels =
    isCategory && first
      ? first.points.map((p) => String(p.x))
      : undefined;
  const factorVisual = resolveLimitingFactorGraphVisual(xAxisLabel, yAxisLabel);

  const datasets = series.map((s, i) => {
    const color =
      s.color?.trim() ||
      factorVisual?.color ||
      GRAPH_BLOCK_DEFAULT_COLORS[i % GRAPH_BLOCK_DEFAULT_COLORS.length];
    const data = isCategory
      ? s.points.map((p) => p.y)
      : s.points.map((p) => ({
          x: typeof p.x === "number" ? p.x : Number(p.x) || 0,
          y: p.y,
        }));

    const base = {
      label: s.label,
      data,
      borderColor: color,
      backgroundColor:
        graphType === "bar"
          ? `${color}99`
          : factorVisual?.fillArea
            ? `${color}22`
            : color,
      borderWidth: graphType === "line" ? 2.5 : graphType === "bar" ? 1 : 2,
      borderDash: factorVisual?.borderDash,
      pointRadius:
        graphType === "scatter"
          ? 5
          : factorVisual?.pointRadius ?? (graphType === "line" ? 4 : 0),
      pointHoverRadius: 7,
      pointBackgroundColor: color,
      pointBorderColor: "#fff",
      pointBorderWidth: 1.5,
      tension:
        graphType === "line"
          ? factorVisual?.tension ?? 0.15
          : 0,
      fill: factorVisual?.fillArea ?? false,
    };

    if (graphType === "scatter") {
      return { ...base, showLine: series.length === 1, spanGaps: true };
    }
    return base;
  });

  if (isCategory && labels) {
    return {
      isCategory: true,
      data: {
        labels,
        datasets: datasets as ChartData<"bar">["datasets"],
      },
    };
  }

  return {
    isCategory: false,
    data: { datasets: datasets as ChartData<"line">["datasets"] },
  };
}

function chartKind(graphType: GraphBlockChartType): "line" | "bar" | "scatter" {
  if (graphType === "bar") return "bar";
  if (graphType === "scatter") return "scatter";
  return "line";
}

function graphDebugEnabled(): boolean {
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("lrGraphDebug") === "1") {
      return true;
    }
  } catch {
    /* ignore */
  }
  return process.env.NODE_ENV === "development";
}

function GraphDebugPanel({
  message,
  payload,
}: {
  message: string;
  payload: unknown;
}): React.ReactElement {
  let json = "";
  try {
    json = JSON.stringify(payload, null, 2);
  } catch {
    json = String(payload);
  }
  return (
    <div className="graph-block__debug" role="alert">
      <p className="graph-block__debug-title">Graph debug</p>
      <p className="graph-block__debug-message">{message}</p>
      <pre className="graph-block__debug-json">{json}</pre>
    </div>
  );
}

export function GraphBlock({
  block,
  blockIndex,
  showAnswers = false,
  audience = "editor",
  hideTitle = false,
}: GraphBlockProps): React.ReactElement {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const mergedBlock = useMemo(
    () => mergeGraphBlockFromExportContent(block),
    [block]
  );
  const parsed = useMemo(() => {
    const p = parseGraphBlockPayload(mergedBlock);
    const heading = formatStudentBlockHeading(
      block != null && typeof block === "object" ? (block as { title?: unknown; number?: unknown }) : null
    );
    if (hideTitle) {
      return { ...p, title: "" };
    }
    return { ...p, title: heading || p.title };
  }, [block, mergedBlock, hideTitle]);
  const showDebug = graphDebugEnabled();
  const [revealed, setRevealed] = useState(showAnswers);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);

  const { graphType, series, xAxisLabel, yAxisLabel, xUnits, yUnits } = parsed;
  const chartBuilt = useMemo(
    () => buildChartData(graphType, series, xAxisLabel, yAxisLabel),
    [graphType, series, xAxisLabel, yAxisLabel]
  );
  const kind = chartKind(graphType);

  const options = useMemo((): ChartOptions<typeof kind> => {
    const xTitle = axisTitle(xAxisLabel, xUnits);
    const yTitle = axisTitle(yAxisLabel, yUnits);
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: true },
      plugins: {
        legend: {
          display: series.length > 1,
          position: "top",
          labels: { color: "#334155", font: { size: 12, weight: "bold" }, boxWidth: 14 },
        },
        title: { display: false },
        tooltip: {
          backgroundColor: "#0f172a",
          titleFont: { size: 13, weight: "bold" },
          bodyFont: { size: 12 },
          padding: 10,
          callbacks: {
            label(ctx) {
              const label = ctx.dataset.label || "";
              const y = ctx.parsed.y;
              if (chartBuilt.isCategory) {
                return `${label}: ${y}`;
              }
              const x = ctx.parsed.x;
              return `${label}: (${x}, ${y})`;
            },
          },
        },
      },
      scales: {
        x: {
          type: chartBuilt.isCategory ? "category" : "linear",
          title: xTitle ? { display: true, text: xTitle, color: "#475569", font: { size: 12, weight: "bold" } } : undefined,
          grid: { color: "rgba(148,163,184,0.25)" },
          ticks: { color: "#64748b", maxTicksLimit: 12 },
        },
        y: {
          title: yTitle ? { display: true, text: yTitle, color: "#475569", font: { size: 12, weight: "bold" } } : undefined,
          grid: { color: "rgba(148,163,184,0.25)" },
          ticks: { color: "#64748b" },
          beginAtZero: graphType === "bar",
        },
      },
    };
  }, [chartBuilt.isCategory, graphType, series.length, xAxisLabel, xUnits, yAxisLabel, yUnits]);

  const visibleAnnotations = useMemo(() => {
    if (!activeAnnotationId) return parsed.annotations;
    return parsed.annotations.filter((a) => a.id === activeAnnotationId);
  }, [activeAnnotationId, parsed.annotations]);

  const onPointClick = (seriesIndex: number, pointIndex: number) => {
    const s = series[seriesIndex];
    if (!s) return;
    const match = parsed.annotations.find(
      (a) =>
        (a.seriesId == null || a.seriesId === s.id) &&
        (a.pointIndex == null || a.pointIndex === pointIndex)
    );
    if (match) {
      setActiveAnnotationId((prev) => (prev === match.id ? null : match.id));
    }
  };

  if (series.length === 0 || series.every((s) => s.points.length === 0)) {
    const emptyMsg =
      audience === "student"
        ? "This graph has no data to display yet. If this looks wrong, ask your teacher to re-save the lesson."
        : "Add data points in Edit lesson to display this graph.";
    return (
      <section className="graph-block" aria-label="Graph">
        {(parsed.title || parsed.intro) && (
          <header className="graph-block__header">
            {parsed.title ? <h3 className="graph-block__title">{parsed.title}</h3> : null}
            <LessonRichText text={parsed.intro ?? ""} className="graph-block__intro" />
          </header>
        )}
        <div className="graph-block__empty">{emptyMsg}</div>
        {showDebug ? (
          <GraphDebugPanel
            message={
              typeof mergedBlock === "object" &&
              mergedBlock != null &&
              String((mergedBlock as { content?: unknown }).content ?? "").trim().startsWith("{")
                ? "Chart data missing after import — parsed series is empty but content JSON exists."
                : "No series points on this graph block."
            }
            payload={mergedBlock}
          />
        ) : null}
      </section>
    );
  }

  if (!mounted) {
    return (
      <section className="graph-block" aria-label={parsed.title || "Graph"} aria-busy="true">
        {(parsed.title || parsed.intro) && (
          <header className="graph-block__header">
            {parsed.title ? <h3 className="graph-block__title">{parsed.title}</h3> : null}
            <LessonRichText text={parsed.intro ?? ""} className="graph-block__intro" />
          </header>
        )}
        <div className="graph-block__chart-wrap">
          <div className="graph-block__chart-inner graph-block__chart-inner--loading" />
        </div>
      </section>
    );
  }

  return (
    <section className="graph-block" aria-label={parsed.title || "Graph"}>
      {(parsed.title || parsed.intro) && (
        <header className="graph-block__header">
          {parsed.title ? <h3 className="graph-block__title">{parsed.title}</h3> : null}
          <LessonRichText text={parsed.intro ?? ""} className="graph-block__intro" />
        </header>
      )}

      <div className="graph-block__chart-wrap">
        <div className="graph-block__chart-inner">
          <Chart
            type={kind}
            data={chartBuilt.data}
            options={{
              ...options,
              onClick: (_evt, elements) => {
                if (elements.length > 0) {
                  const el = elements[0];
                  onPointClick(el.datasetIndex, el.index);
                }
              },
            }}
          />
        </div>
        <p className="graph-block__axis-hint" role="note">
          {graphType === "scatter" || graphType === "line"
            ? "Tap or hover a point to see values. Annotations appear below when linked to a point."
            : "Compare bar heights carefully — check the axis scale."}
        </p>
      </div>

      {parsed.annotations.length > 0 ? (
        <div className="graph-block__annotations" aria-label="Graph annotations">
          {(activeAnnotationId ? visibleAnnotations : parsed.annotations).map((a: GraphAnnotation) => (
            <p
              key={a.id}
              className={`graph-block__annotation${a.kind === "trend" ? " graph-block__annotation--trend" : ""}`}
            >
              {a.text}
            </p>
          ))}
        </div>
      ) : null}

      {parsed.examQuestion ? (
        <div className="graph-block__exam">
          <p className="graph-block__exam-label">Graph interpretation</p>
          <p className="graph-block__exam-question">{parsed.examQuestion}</p>
          {!revealed && (parsed.markScheme || parsed.examinerTip) ? (
            <button type="button" className="graph-block__reveal-btn" onClick={() => setRevealed(true)}>
              Show mark scheme
            </button>
          ) : null}
          {revealed && parsed.markScheme ? (
            <div className="graph-block__mark-scheme">
              <strong>Mark scheme</strong>
              {parsed.markScheme}
            </div>
          ) : null}
          {revealed && parsed.examinerTip ? (
            <div className="graph-block__examiner-tip">
              <strong>Examiner tip</strong>
              {parsed.examinerTip}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
