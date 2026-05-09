/**
 * Shared lesson block types and metadata for CreateLessonPage and EditLessonPage.
 * Use BLOCK_META for labels, icons, and styles. Use normalizeBlockType when loading
 * from API; use toLegacyBlockType when saving to API for backward compatibility.
 */

import type { CSSProperties } from "react";

/**
 * Shared lesson block shape for contract enforcement.
 * role = semantic label (e.g. Hook, Core rule, What to Notice).
 */
export interface LessonBlock {
  type: LessonBlockType | LegacyBlockType;
  title?: string;
  content?: string;
  question?: string;
  answer?: string;
  role?: string;
}

/** Merge page/block checkpoint `explanation` with `markScheme` lines for student display. */
export { mergeCheckpointExplanationParts } from "../utils/checkpointFeedback";

/** Hotspot on an `interactiveDiagram` block — `description` is legacy storage; prefer `explanation` when authoring. */
export type InteractiveDiagramHotspotDraft = {
  id: string;
  x?: number;
  y?: number;
  label: string;
  description?: string;
  explanation?: string;
  test?: unknown;
};

export type LessonBlockType =
  | "text"
  | "keyIdeas"
  | "keyWords"
  | "examTips"
  | "misconceptions"
  | "deeperKnowledge"
  | "checkpoint"
  /** Inline self-check — independent of page.checkpoint; reveal-answer only for students */
  | "selfCheck"
  | "pageQuiz"
  | "diagram"
  | "interactiveSequence"
  | "interactiveDiagram"
  | "dragDropMatch";

/** Legacy block type strings that may come from the API. */
export type LegacyBlockType =
  | "text"
  | "keyIdea"
  | "examTip"
  | "commonMistake"
  | "keyWords"
  | "stretch"
  | "checkpoint"
  | "diagram";

export interface BlockMeta {
  label: string;
  icon: string;
  /** Optional teacher hint — editors and add-block dropdown tooltip */
  subtitle?: string;
  style: {
    border: string;
    background: string;
  };
}

const baseBox = {
  padding: 12,
  borderRadius: 10,
  boxShadow: "0 1px 4px rgba(15,23,42,0.03)",
} as const;

export const BLOCK_META: Record<LessonBlockType, BlockMeta> = {
  text: {
    label: "Text",
    icon: "📝",
    style: {
      border: "1px solid rgba(15,23,42,0.06)",
      background: "#fff",
    },
  },
  keyIdeas: {
    label: "Key Ideas",
    icon: "💡",
    style: {
      border: "1px solid rgba(59,130,246,0.2)",
      background: "rgba(59,130,246,0.03)",
    },
  },
  keyWords: {
    label: "Key words",
    icon: "🔑",
    style: {
      border: "1px solid rgba(139,92,246,0.2)",
      background: "rgba(139,92,246,0.03)",
    },
  },
  examTips: {
    label: "Exam Tips",
    icon: "✅",
    style: {
      border: "1px solid rgba(16,185,129,0.2)",
      background: "rgba(16,185,129,0.03)",
    },
  },
  misconceptions: {
    label: "Misconceptions",
    icon: "⚠️",
    style: {
      border: "1px solid rgba(239,68,68,0.2)",
      background: "rgba(239,68,68,0.03)",
    },
  },
  deeperKnowledge: {
    label: "Deeper knowledge",
    icon: "📚",
    style: {
      border: "1px solid rgba(124,58,237,0.2)",
      background: "rgba(124,58,237,0.03)",
    },
  },
  checkpoint: {
    label: "Checkpoint",
    icon: "✓",
    style: {
      border: "1px solid rgba(59,130,246,0.35)",
      background: "rgba(59,130,246,0.06)",
    },
  },
  selfCheck: {
    label: "Self-check",
    icon: "🔎",
    style: {
      border: "1px solid rgba(16,185,129,0.35)",
      background: "rgba(16,185,129,0.06)",
    },
  },
  pageQuiz: {
    label: "Page Quiz",
    icon: "📋",
    style: {
      border: "1px solid rgba(245,158,11,0.35)",
      background: "rgba(245,158,11,0.06)",
    },
  },
  diagram: {
    label: "Diagram",
    icon: "🖼",
    style: {
      border: "1px solid rgba(34,197,94,0.35)",
      background: "rgba(34,197,94,0.06)",
    },
  },
  interactiveSequence: {
    label: "Step-by-step diagram (process)",
    subtitle: "Use for processes like mitosis, digestion, life cycles",
    icon: "🔁",
    style: {
      border: "1px solid rgba(99,102,241,0.35)",
      background: "rgba(99,102,241,0.06)",
    },
  },
  interactiveDiagram: {
    label: "Interactive diagram",
    icon: "📍",
    style: {
      border: "1px solid rgba(220,38,38,0.3)",
      background: "rgba(254,242,242,0.5)",
    },
  },
  dragDropMatch: {
    label: "Drag and drop match",
    icon: "🧩",
    style: {
      border: "1px solid rgba(14,165,233,0.35)",
      background: "rgba(224,242,254,0.45)",
    },
  },
};

/** Collapse spaces/underscores/hyphens so API variants (drag_drop_match, Drag-Drop-Match) match. */
function compactTypeKey(raw: string): string {
  return raw.trim().replace(/[\s_\-]/g, "").toLowerCase();
}

/**
 * Normalize any block type string (legacy or canonical) to LessonBlockType.
 * Use when loading blocks from the API or when rendering.
 */
export function normalizeBlockType(raw: string | undefined): LessonBlockType {
  const t0 = (raw || "text").trim();
  const compact = compactTypeKey(t0);
  /** Tolerant aliases — some stores/exports use snake_case or kebab-case. */
  if (compact === "dragdropmatch") return "dragDropMatch";
  if (compact === "interactivediagram") return "interactiveDiagram";
  if (compact === "interactivesequence") return "interactiveSequence";
  if (compact === "pagequiz") return "pageQuiz";
  /** Some exports/clients use SCREAMING_SNAKE or snake_case for the same block. */
  if (compact === "selfcheck") return "selfCheck";

  switch (t0) {
    case "keyIdea":
      return "keyIdeas";
    case "examTip":
      return "examTips";
    case "commonMistake":
      return "misconceptions";
    case "stretch":
      return "deeperKnowledge";
    case "keyIdeas":
    case "keyWords":
    case "examTips":
    case "misconceptions":
    case "deeperKnowledge":
    case "text":
    case "checkpoint":
    case "selfCheck":
    case "pageQuiz":
    case "diagram":
    case "interactiveSequence":
    case "interactiveDiagram":
    case "dragDropMatch":
      return t0 as LessonBlockType;
    default:
      return "text";
  }
}

/**
 * Student / preview routing: normalizes type and recovers drag-drop rows mis-saved as `text`
 * when `pairs` still contains structured data (legacy persistence mismatch).
 */
export function resolveLessonDisplayBlockType(block: unknown): LessonBlockType {
  const b =
    block != null && typeof block === "object"
      ? (block as { type?: unknown; pairs?: unknown })
      : {};
  const base = normalizeBlockType(b.type !== undefined ? String(b.type) : undefined);
  if (base !== "text") return base;
  const rp = Array.isArray(b.pairs) ? b.pairs : [];
  const looksLikeDragDrop =
    rp.length >= 1 &&
    rp.some((row: unknown) => {
      if (!row || typeof row !== "object") return false;
      const o = row as { prompt?: unknown; answer?: unknown };
      return Boolean(String(o.prompt ?? "").trim() || String(o.answer ?? "").trim());
    });
  return looksLikeDragDrop ? "dragDropMatch" : "text";
}

/**
 * Convert canonical LessonBlockType to legacy API type string.
 * Use when saving lessons to the backend so existing contracts are unchanged.
 */
export function toLegacyBlockType(t: LessonBlockType): string {
  switch (t) {
    case "keyIdeas":
      return "keyIdea";
    case "examTips":
      return "examTip";
    case "misconceptions":
      return "commonMistake";
    case "deeperKnowledge":
      return "stretch";
    case "checkpoint":
      return "checkpoint";
    case "selfCheck":
      return "selfCheck";
    case "pageQuiz":
      return "pageQuiz";
    case "diagram":
      return "diagram";
    case "interactiveSequence":
      return "interactiveSequence";
    case "interactiveDiagram":
      return "interactiveDiagram";
    case "dragDropMatch":
      return "dragDropMatch";
    case "text":
    case "keyWords":
      return t;
    default:
      return "text";
  }
}

/**
 * Return full CSS style object for a block (for editor and preview).
 * Use this instead of duplicating inline style logic.
 * Defensive: never read .style off undefined; unknown/legacy/undefined type falls back to "text".
 */
export function getBlockStyle(
  type: LessonBlockType | LegacyBlockType | string | undefined,
  overrides?: Partial<CSSProperties>
): CSSProperties {
  const safeType: LessonBlockType =
    type && type in BLOCK_META ? (type as LessonBlockType) : normalizeBlockType(type as string | undefined);
  const meta = BLOCK_META[safeType] ?? BLOCK_META.text;
  const style = meta?.style;
  if (!style) return { ...baseBox, ...overrides } as CSSProperties;
  return {
    ...baseBox,
    border: style.border,
    background: style.background,
    ...overrides,
  };
}

/**
 * Page-type options: lightweight semantic label for what role the page plays in the lesson.
 * Chips = what block you add; Page type = what this page is for. Optional, non-blocking.
 */
export const PAGE_TYPE_OPTIONS: string[] = [
  "Explanation",
  "Key Ideas",
  "Keywords",
  "Exam Tips",
  "Misconceptions",
  "Deeper Knowledge",
  "Checkpoint",
  "Diagram",
  "Worked Example",
  "Practice Questions",
  "Summary",
];

/** Ordered list of block types for add-block buttons. */
export const BLOCK_TYPES_FOR_BUTTONS: LessonBlockType[] = [
  "text",
  "keyIdeas",
  "keyWords",
  "examTips",
  "misconceptions",
  "deeperKnowledge",
  "checkpoint",
  "diagram",
  "interactiveSequence",
  "dragDropMatch",
];

/** Option for add-block dropdown: maps role to block type + optional title. */
export interface AddBlockOption {
  role: string;
  type: LessonBlockType;
  title?: string;
  label: string;
}

/** Contract-aligned add-block options for the dropdown menu. */
export const ADD_BLOCK_OPTIONS: AddBlockOption[] = [
  { role: "hook", type: "text", label: "Hook (text)" },
  { role: "coreRule", type: "keyIdeas", title: "", label: "Core rule (key idea)" },
  { role: "commonMistake", type: "misconceptions", label: "Common mistake" },
  { role: "patternRecognition", type: "keyIdeas", title: "", label: "Pattern recognition (key idea)" },
  { role: "concept", type: "diagram", label: "Diagram (concept)" },
  { role: "whatToNotice", type: "keyIdeas", title: "What to Notice", label: "What to Notice (key idea)" },
  { role: "concept", type: "text", label: "Text (concept)" },
  { role: "concept", type: "examTips", label: "Exam tip (concept)" },
  { role: "workedExample", type: "checkpoint", label: "Worked example (checkpoint)" },
  { role: "synthesis", type: "keyIdeas", label: "Synthesis (key idea)" },
  { role: "quickCheck", type: "checkpoint", label: "Quick check (checkpoint)" },
  { role: "selfCheck", type: "selfCheck", label: "Self-check question" },
  { role: "finalMemoryRule", type: "keyIdeas", label: "Final memory rule (key idea)" },
  { role: "keyWords", type: "keyWords", label: "Key words" },
  { role: "deeperKnowledge", type: "deeperKnowledge", label: "Deeper knowledge (stretch)" },
  { role: "sequence", type: "interactiveSequence", label: "Step-by-step diagram (process)" },
  { role: "hotspot", type: "interactiveDiagram", label: "Interactive diagram" },
  { role: "match", type: "dragDropMatch", label: "Drag and drop match" },
];

/** Button style for "+ Block" add buttons (same colours as block, slightly stronger border). */
export function getBlockButtonStyle(type: LessonBlockType): CSSProperties {
  const base = {
    padding: "8px 10px",
    borderRadius: 10,
    cursor: "pointer" as const,
    fontWeight: 900,
  };
  switch (type) {
    case "keyIdeas":
      return { ...base, border: "2px solid rgba(59,130,246,0.35)", background: "rgba(59,130,246,0.06)" };
    case "examTips":
      return { ...base, border: "2px solid rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.06)" };
    case "misconceptions":
      return { ...base, border: "2px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.06)" };
    case "deeperKnowledge":
      return { ...base, border: "2px solid rgba(124,58,237,0.35)", background: "rgba(124,58,237,0.06)" };
    case "keyWords":
      return { ...base, border: "2px solid rgba(139,92,246,0.35)", background: "rgba(139,92,246,0.06)" };
    case "checkpoint":
      return { ...base, border: "2px solid rgba(59,130,246,0.35)", background: "rgba(59,130,246,0.06)" };
    case "selfCheck":
      return { ...base, border: "2px solid rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.06)" };
    case "pageQuiz":
      return { ...base, border: "2px solid rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.06)" };
    case "diagram":
      return { ...base, border: "2px solid rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.06)" };
    case "interactiveSequence":
      return { ...base, border: "2px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.08)" };
    case "interactiveDiagram":
      return { ...base, border: "2px solid rgba(220,38,38,0.4)", background: "rgba(254,242,242,0.7)" };
    case "dragDropMatch":
      return { ...base, border: "2px solid rgba(14,165,233,0.4)", background: "rgba(224,242,254,0.55)" };
    case "text":
    default:
      return { ...base, border: "2px solid rgba(0,0,0,0.14)", background: "white" };
  }
}
