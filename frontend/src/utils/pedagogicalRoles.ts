/**
 * Semantic block roles (stored on `block.role`) — no extra DB block types.
 * Used for labels, editor hints, and student/classroom presentation overrides.
 */

export type PedagogicalRoleId =
  | "hook"
  | "coreRule"
  | "commonMistake"
  | "whatToNotice"
  | "examTechnique"
  | "synopticLink"
  | "whyThisMatters"
  | "patternRecognition"
  | "workedExample"
  | "synthesis"
  | "finalMemoryRule"
  | "quickCheck"
  | "checkpoint"
  | "selfCheck"
  | "concept"
  | string;

export type PedagogicalRolePresentation = {
  label: string;
  icon: string;
  studentClassName: string;
  /** Inline preview / classroom mode */
  background: string;
  border: string;
  titleColor: string;
};

const ROLE_PRESENTATION: Record<string, PedagogicalRolePresentation> = {
  examTechnique: {
    label: "Exam technique",
    icon: "📋",
    studentClassName: "student-block--exam-technique",
    background: "#fffbeb",
    border: "2px solid rgba(245, 158, 11, 0.45)",
    titleColor: "#b45309",
  },
  synopticLink: {
    label: "Synoptic link",
    icon: "🔗",
    studentClassName: "student-block--synoptic-link",
    background: "rgba(124, 58, 237, 0.06)",
    border: "2px solid rgba(124, 58, 237, 0.35)",
    titleColor: "#5b21b6",
  },
  whyThisMatters: {
    label: "Why this matters",
    icon: "🌍",
    studentClassName: "student-block--why-this-matters",
    background: "rgba(16, 185, 129, 0.08)",
    border: "2px solid rgba(5, 150, 105, 0.4)",
    titleColor: "#047857",
  },
  coreRule: {
    label: "Core rule",
    icon: "📘",
    studentClassName: "student-block--key",
    background: "#f0fff4",
    border: "2px solid rgba(34, 197, 94, 0.40)",
    titleColor: "#065f46",
  },
  whatToNotice: {
    label: "What to notice",
    icon: "👁",
    studentClassName: "student-block--key",
    background: "#f0f9ff",
    border: "2px solid rgba(59, 130, 246, 0.35)",
    titleColor: "#1e40af",
  },
};

export function normalizePedagogicalRole(role: unknown): string {
  return typeof role === "string" ? role.trim() : "";
}

export function getPedagogicalRolePresentation(
  role: unknown
): PedagogicalRolePresentation | null {
  const r = normalizePedagogicalRole(role);
  if (!r) return null;
  return ROLE_PRESENTATION[r] ?? null;
}

/** Editor chrome override when role differs from generic block type styling. */
export function getRoleBlockStyleOverrides(role: unknown): {
  border: string;
  background: string;
} | null {
  const p = getPedagogicalRolePresentation(role);
  if (!p) return null;
  return { border: p.border, background: p.background };
}
