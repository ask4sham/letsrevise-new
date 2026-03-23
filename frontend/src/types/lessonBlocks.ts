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

export type LessonBlockType =
  | "text"
  | "keyIdeas"
  | "keyWords"
  | "examTips"
  | "misconceptions"
  | "deeperKnowledge"
  | "checkpoint"
  | "pageQuiz"
  | "diagram";

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
};

/**
 * Normalize any block type string (legacy or canonical) to LessonBlockType.
 * Use when loading blocks from the API or when rendering.
 */
export function normalizeBlockType(raw: string | undefined): LessonBlockType {
  const t = (raw || "text").trim();
  switch (t) {
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
    case "diagram":
      return t as LessonBlockType;
    default:
      return "text";
  }
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
    case "pageQuiz":
      return "pageQuiz";
    case "diagram":
      return "diagram";
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
  { role: "finalMemoryRule", type: "keyIdeas", label: "Final memory rule (key idea)" },
  { role: "keyWords", type: "keyWords", label: "Key words" },
  { role: "deeperKnowledge", type: "deeperKnowledge", label: "Deeper knowledge (stretch)" },
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
    case "pageQuiz":
      return { ...base, border: "2px solid rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.06)" };
    case "diagram":
      return { ...base, border: "2px solid rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.06)" };
    case "text":
    default:
      return { ...base, border: "2px solid rgba(0,0,0,0.14)", background: "white" };
  }
}
