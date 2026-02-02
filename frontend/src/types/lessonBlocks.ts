/**
 * Shared lesson block types and metadata for CreateLessonPage and EditLessonPage.
 * Use BLOCK_META for labels, icons, and styles. Use normalizeBlockType when loading
 * from API; use toLegacyBlockType when saving to API for backward compatibility.
 */

import type { CSSProperties } from "react";

export type LessonBlockType =
  | "text"
  | "keyIdeas"
  | "keyWords"
  | "examTips"
  | "misconceptions"
  | "deeperKnowledge";

/** Legacy block type strings that may come from the API. */
export type LegacyBlockType =
  | "text"
  | "keyIdea"
  | "examTip"
  | "commonMistake"
  | "keyWords"
  | "stretch";

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
    label: "Key Words",
    icon: "🔑",
    style: {
      border: "1px solid rgba(15,23,42,0.06)",
      background: "#fff",
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
 */
export function getBlockStyle(
  type: LessonBlockType,
  overrides?: Partial<CSSProperties>
): CSSProperties {
  const meta = BLOCK_META[type];
  return {
    ...baseBox,
    border: meta.style.border,
    background: meta.style.background,
    ...overrides,
  };
}

/** Ordered list of block types for add-block buttons. */
export const BLOCK_TYPES_FOR_BUTTONS: LessonBlockType[] = [
  "text",
  "keyIdeas",
  "keyWords",
  "examTips",
  "misconceptions",
  "deeperKnowledge",
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
    case "text":
    case "keyWords":
    default:
      return { ...base, border: "2px solid rgba(0,0,0,0.14)", background: "white" };
  }
}
