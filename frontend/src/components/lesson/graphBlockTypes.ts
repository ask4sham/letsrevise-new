/** Supported graph block chart kinds (pie/histogram reserved for later). */
export type GraphBlockChartType = "line" | "bar" | "scatter";

export type GraphDataPoint = {
  /** X value — number for scales, or category label string for bar charts */
  x: number | string;
  y: number;
};

export type GraphSeries = {
  id: string;
  label: string;
  color?: string;
  points: GraphDataPoint[];
};

export type GraphAnnotation = {
  id: string;
  text: string;
  kind?: "callout" | "trend";
  seriesId?: string;
  /** Index into that series' points */
  pointIndex?: number;
};

export type GraphBlockPayload = {
  content?: string;
  title?: string;
  intro?: string;
  graphType?: GraphBlockChartType;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xUnits?: string;
  yUnits?: string;
  graphSeries?: GraphSeries[];
  /** Legacy / import alias */
  series?: GraphSeries[];
  graphAnnotations?: GraphAnnotation[];
  annotations?: GraphAnnotation[];
  examQuestion?: string;
  markScheme?: string;
  examinerTip?: string;
};

export const GRAPH_CHART_TYPE_LABELS: Record<GraphBlockChartType, string> = {
  line: "Line graph",
  bar: "Bar chart",
  scatter: "Scatter graph",
};

export const GRAPH_BLOCK_DEFAULT_COLORS = [
  "#1e3a8a",
  "#2563eb",
  "#64748b",
  "#0d9488",
  "#7c3aed",
] as const;

export type LimitingFactorGraphVisual = {
  color: string;
  tension: number;
  borderDash?: number[];
  pointRadius: number;
  fillArea: boolean;
};

/** Distinct GCSE limiting-factor curves: light (blue plateau), temperature (red peak), CO₂ (green dashed). */
export function resolveLimitingFactorGraphVisual(
  xAxisLabel = "",
  yAxisLabel = ""
): LimitingFactorGraphVisual | null {
  const hay = `${xAxisLabel} ${yAxisLabel}`.toLowerCase();
  if (!/(light|temperature|carbon|co2|co₂|photosynth|limiting)/.test(hay)) {
    return null;
  }
  if (/\btemperature|°c/.test(hay)) {
    return { color: "#dc2626", tension: 0.38, pointRadius: 5, fillArea: false };
  }
  if (/\bcarbon\s+dioxide|\bco2\b|\bco₂\b/.test(hay)) {
    return { color: "#059669", tension: 0.08, borderDash: [8, 5], pointRadius: 4, fillArea: false };
  }
  if (/\blight/.test(hay)) {
    return { color: "#2563eb", tension: 0.06, pointRadius: 4, fillArea: true };
  }
  return null;
}

export function normalizeGraphChartType(raw: unknown): GraphBlockChartType {
  const t = String(raw ?? "").trim().toLowerCase();
  if (t === "bar" || t === "barchart" || t === "bar chart") return "bar";
  if (t === "scatter" || t === "scattergraph" || t === "scatter graph") return "scatter";
  return "line";
}

export function createGraphSeriesId(): string {
  return `gs_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function createGraphAnnotationId(): string {
  return `ga_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function normalizeGraphSeries(raw: unknown): GraphSeries[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((row, i) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const id = String(o.id ?? "").trim() || createGraphSeriesId();
      const label = String(o.label ?? `Series ${i + 1}`).trim() || `Series ${i + 1}`;
      const ptsRaw = Array.isArray(o.points) ? o.points : [];
      const points: GraphDataPoint[] = ptsRaw
        .map((p) => {
          if (!p || typeof p !== "object") return null;
          const pt = p as Record<string, unknown>;
          const y = Number(pt.y);
          if (!Number.isFinite(y)) return null;
          const xRaw = pt.x;
          const x =
            typeof xRaw === "number" && Number.isFinite(xRaw)
              ? xRaw
              : String(xRaw ?? "").trim();
          if (x === "" && typeof x !== "number") return null;
          return { x, y };
        })
        .filter((p): p is GraphDataPoint => p != null);
      return { id, label, ...(typeof o.color === "string" && o.color.trim() ? { color: o.color.trim() } : {}), points };
    })
    .filter((s): s is GraphSeries => s != null && s.points.length > 0);
}

export function normalizeGraphAnnotations(raw: unknown): GraphAnnotation[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((row, i) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const text = String(o.text ?? "").trim();
      if (!text) return null;
      const id = String(o.id ?? "").trim() || createGraphAnnotationId();
      const pointIndex = o.pointIndex != null ? Number(o.pointIndex) : undefined;
      return {
        id,
        text,
        ...(typeof o.kind === "string" ? { kind: o.kind as GraphAnnotation["kind"] } : {}),
        ...(typeof o.seriesId === "string" && o.seriesId.trim() ? { seriesId: o.seriesId.trim() } : {}),
        ...(pointIndex !== undefined && Number.isFinite(pointIndex) ? { pointIndex } : {}),
      };
    })
    .filter((a): a is GraphAnnotation => a != null);
}

/** Merge persisted block fields into a consistent graph payload for editor + student view. */
export function parseGraphBlockPayload(block: unknown): {
  title: string;
  intro: string;
  graphType: GraphBlockChartType;
  xAxisLabel: string;
  yAxisLabel: string;
  xUnits: string;
  yUnits: string;
  series: GraphSeries[];
  annotations: GraphAnnotation[];
  examQuestion: string;
  markScheme: string;
  examinerTip: string;
} {
  const b = block != null && typeof block === "object" ? (block as GraphBlockPayload) : {};
  const series = normalizeGraphSeries(b.graphSeries ?? b.series);
  const annotations = normalizeGraphAnnotations(b.graphAnnotations ?? b.annotations);
  return {
    title: String(b.title ?? "").trim(),
    intro: String(b.intro ?? "").trim(),
    graphType: normalizeGraphChartType(b.graphType),
    xAxisLabel: String(b.xAxisLabel ?? "").trim(),
    yAxisLabel: String(b.yAxisLabel ?? "").trim(),
    xUnits: String(b.xUnits ?? "").trim(),
    yUnits: String(b.yUnits ?? "").trim(),
    series,
    annotations,
    examQuestion: String(b.examQuestion ?? "").trim(),
    markScheme: String(b.markScheme ?? "").trim(),
    examinerTip: String(b.examinerTip ?? "").trim(),
  };
}

/** True when `content` is a generator/API graph JSON backup blob. */
export function contentLooksLikeGraphJson(content: unknown): boolean {
  const raw = String(content ?? "").trim();
  if (!raw.startsWith("{")) return false;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (!j || typeof j !== "object") return false;
    const series = j.graphSeries ?? j.series;
    if (!Array.isArray(series) || series.length === 0) return false;
    return series.some((row) => {
      if (!row || typeof row !== "object") return false;
      const pts = (row as { points?: unknown }).points;
      return Array.isArray(pts) && pts.length > 0;
    });
  } catch {
    return false;
  }
}

/** When export payload has graph metadata in `content` (JSON) but empty `graphSeries`. */
export function mergeGraphBlockFromExportContent(block: unknown): unknown {
  if (block == null || typeof block !== "object") return block;
  const b = block as Record<string, unknown>;
  const parsed = parseGraphBlockPayload(block);
  if (parsed.series.length > 0) {
    return block;
  }
  const content = String(b.content ?? "").trim();
  if (!contentLooksLikeGraphJson(content)) return block;
  try {
    const j = JSON.parse(content) as Record<string, unknown>;
    if (j && typeof j === "object") {
      return { ...b, ...j, graphSeries: j.graphSeries ?? j.series ?? b.graphSeries };
    }
  } catch {
    /* not JSON */
  }
  return block;
}

/**
 * Hydrate a persisted block for student/editor display: merge JSON backup, force `type: graph`,
 * and clear `content` so the JSON blob is never shown as lesson prose.
 */
export function normalizeGraphBlockForDisplay(block: unknown): Record<string, unknown> {
  if (block == null || typeof block !== "object") {
    return {};
  }
  const merged = mergeGraphBlockFromExportContent(block);
  const b =
    merged != null && typeof merged === "object"
      ? (merged as Record<string, unknown>)
      : (block as Record<string, unknown>);
  const parsed = parseGraphBlockPayload(merged);
  if (parsed.series.length === 0) {
    return { ...b };
  }
  return {
    ...b,
    type: "graph",
    graphType: parsed.graphType,
    graphSeries: parsed.series,
    graphAnnotations: parsed.annotations,
    title: parsed.title || b.title,
    intro: parsed.intro || b.intro,
    xAxisLabel: parsed.xAxisLabel,
    yAxisLabel: parsed.yAxisLabel,
    xUnits: parsed.xUnits,
    yUnits: parsed.yUnits,
    examQuestion: parsed.examQuestion,
    markScheme: parsed.markScheme,
    examinerTip: parsed.examinerTip,
    content: "",
  };
}

/** Normalized graph block for API save / generator import (merges JSON in `content` first). */
export function graphBlockForPersist(
  block: unknown,
  opts?: { role?: string }
): Record<string, unknown> {
  const merged = mergeGraphBlockFromExportContent(block);
  const p = parseGraphBlockPayload(merged);
  const out: Record<string, unknown> = {
    type: "graph",
    content: "",
    title: p.title,
    intro: p.intro,
    graphType: p.graphType,
    xAxisLabel: p.xAxisLabel,
    yAxisLabel: p.yAxisLabel,
    xUnits: p.xUnits,
    yUnits: p.yUnits,
    graphSeries: p.series,
    graphAnnotations: p.annotations,
    examQuestion: p.examQuestion,
    markScheme: p.markScheme,
    examinerTip: p.examinerTip,
  };
  if (opts?.role?.trim()) out.role = opts.role.trim();
  else if (block != null && typeof block === "object") {
    const r = (block as { role?: unknown }).role;
    if (typeof r === "string" && r.trim()) out.role = r.trim();
  }
  return out;
}

export function emptyGraphBlock(): GraphBlockPayload & { type: "graph" } {
  return {
    type: "graph",
    content: "",
    title: "",
    intro: "",
    graphType: "line",
    xAxisLabel: "",
    yAxisLabel: "",
    xUnits: "",
    yUnits: "",
    graphSeries: [
      {
        id: createGraphSeriesId(),
        label: "Series 1",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
      },
    ],
    graphAnnotations: [],
    examQuestion: "",
    markScheme: "",
    examinerTip: "",
  };
}
