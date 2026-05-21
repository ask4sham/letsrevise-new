/**
 * Optional per-block metadata for future adaptive learning (non-breaking).
 * Not shown in student view; preserved on save/load/import only.
 */

export type LearningMetaDifficulty = "easy" | "medium" | "hard";

export type LearningMeta = {
  concept?: string;
  skill?: string;
  misconceptionRisk?: string;
  examSkill?: string;
  difficulty?: LearningMetaDifficulty;
};

export type LearningMetaWarning = {
  pageIndex: number;
  blockIndex: number;
  blockType: string;
  message: string;
};

export type LearningIntelligenceGroupedItem = {
  label: string;
  count: number;
};

export type LearningIntelligenceDifficultyBalance = {
  easy: number;
  medium: number;
  hard: number;
  unspecified: number;
};

/** Teacher-only summary derived from page.blocks[].learningMeta (read-only). */
export type LearningIntelligenceSummary = {
  hasAnyMeta: boolean;
  blocksWithMeta: number;
  totalBlocks: number;
  concepts: LearningIntelligenceGroupedItem[];
  skills: LearningIntelligenceGroupedItem[];
  misconceptionRisks: LearningIntelligenceGroupedItem[];
  examSkills: LearningIntelligenceGroupedItem[];
  difficultyBalance: LearningIntelligenceDifficultyBalance;
};

export const EMPTY_LEARNING_INTELLIGENCE_SUMMARY: LearningIntelligenceSummary = {
  hasAnyMeta: false,
  blocksWithMeta: 0,
  totalBlocks: 0,
  concepts: [],
  skills: [],
  misconceptionRisks: [],
  examSkills: [],
  difficultyBalance: { easy: 0, medium: 0, hard: 0, unspecified: 0 },
};

function groupMetaFieldValues(
  metas: LearningMeta[],
  pick: (m: LearningMeta) => string | undefined
): LearningIntelligenceGroupedItem[] {
  const map = new Map<string, LearningIntelligenceGroupedItem>();
  for (const meta of metas) {
    const raw = pick(meta);
    if (!raw) continue;
    const key = raw.toLowerCase();
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { label: raw, count: 1 });
  }
  return Array.from(map.values()).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  );
}

function collectBlockMetas(pages: Array<{ blocks?: unknown[] }> | null | undefined): {
  metas: LearningMeta[];
  totalBlocks: number;
} {
  let totalBlocks = 0;
  const metas: LearningMeta[] = [];
  const pageList = Array.isArray(pages) ? pages : [];
  for (const page of pageList) {
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    for (const block of blocks) {
      totalBlocks += 1;
      const meta = sanitizeLearningMeta(
        block != null && typeof block === "object"
          ? (block as Record<string, unknown>).learningMeta
          : undefined
      );
      if (meta) metas.push(meta);
    }
  }
  return { metas, totalBlocks };
}

/** Derive grouped coverage summary for teacher authoring UI (no side effects). */
export function deriveLearningIntelligenceSummary(
  pages: Array<{ blocks?: unknown[] }> | null | undefined
): LearningIntelligenceSummary {
  const { metas, totalBlocks } = collectBlockMetas(pages);
  const difficultyBalance: LearningIntelligenceDifficultyBalance = {
    easy: 0,
    medium: 0,
    hard: 0,
    unspecified: 0,
  };
  for (const meta of metas) {
    if (meta.difficulty === "easy") difficultyBalance.easy += 1;
    else if (meta.difficulty === "medium") difficultyBalance.medium += 1;
    else if (meta.difficulty === "hard") difficultyBalance.hard += 1;
    else difficultyBalance.unspecified += 1;
  }
  const blocksWithMeta = metas.length;

  return {
    hasAnyMeta: blocksWithMeta > 0,
    blocksWithMeta,
    totalBlocks,
    concepts: groupMetaFieldValues(metas, (m) => m.concept),
    skills: groupMetaFieldValues(metas, (m) => m.skill),
    misconceptionRisks: groupMetaFieldValues(metas, (m) => m.misconceptionRisk),
    examSkills: groupMetaFieldValues(metas, (m) => m.examSkill),
    difficultyBalance,
  };
}

/** Never throws — safe for teacher sidebar panels. */
export function safeDeriveLearningIntelligenceSummary(
  pages: Array<{ blocks?: unknown[] }> | null | undefined
): LearningIntelligenceSummary {
  try {
    return deriveLearningIntelligenceSummary(pages);
  } catch {
    return EMPTY_LEARNING_INTELLIGENCE_SUMMARY;
  }
}

const DIFFICULTIES = new Set<LearningMetaDifficulty>(["easy", "medium", "hard"]);

function safeTrim(v: unknown, maxLen: number): string | undefined {
  const s = v === undefined || v === null ? "" : String(v).trim();
  if (!s) return undefined;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/** Normalise optional learningMeta from API/editor/import (drops invalid fields). */
export function sanitizeLearningMeta(raw: unknown): LearningMeta | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: LearningMeta = {};
  const concept = safeTrim(o.concept, 500);
  const skill = safeTrim(o.skill, 500);
  const misconceptionRisk = safeTrim(o.misconceptionRisk, 500);
  const examSkill = safeTrim(o.examSkill, 500);
  if (concept) out.concept = concept;
  if (skill) out.skill = skill;
  if (misconceptionRisk) out.misconceptionRisk = misconceptionRisk;
  if (examSkill) out.examSkill = examSkill;
  const dRaw = safeTrim(o.difficulty, 20)?.toLowerCase();
  if (dRaw && DIFFICULTIES.has(dRaw as LearningMetaDifficulty)) {
    out.difficulty = dRaw as LearningMetaDifficulty;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Attach sanitised learningMeta to a block payload when present on the source row. */
export function attachLearningMetaForPersist(
  out: Record<string, unknown>,
  block: unknown
): Record<string, unknown> {
  const raw =
    block != null && typeof block === "object"
      ? (block as Record<string, unknown>).learningMeta
      : undefined;
  const meta = sanitizeLearningMeta(raw);
  if (!meta) return out;
  return { ...out, learningMeta: meta };
}

/**
 * Non-blocking advisory warnings when blocks lack learningMeta (dev / author tooling).
 * Never used to reject saves.
 */
export function collectLearningMetaWarnings(
  pages: Array<{ blocks?: unknown[]; title?: string }>
): LearningMetaWarning[] {
  const warnings: LearningMetaWarning[] = [];
  pages.forEach((page, pageIndex) => {
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    blocks.forEach((block, blockIndex) => {
      const b =
        block != null && typeof block === "object"
          ? (block as Record<string, unknown>)
          : {};
      if (sanitizeLearningMeta(b.learningMeta)) return;
      const blockType = String(b.type ?? "text");
      warnings.push({
        pageIndex,
        blockIndex,
        blockType,
        message: `Page ${pageIndex + 1} block ${blockIndex + 1} (${blockType}): no learningMeta — adaptive features unavailable until metadata is added.`,
      });
    });
  });
  return warnings;
}

/** Log warnings in development only; never throws. */
export function warnLearningMetaIfMissing(
  pages: Array<{ blocks?: unknown[]; title?: string }>,
  label = "lesson save"
): LearningMetaWarning[] {
  const warnings = collectLearningMetaWarnings(pages);
  if (warnings.length > 0 && typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
    const sample = warnings.slice(0, 8);
    console.info(
      `[learningMeta] ${warnings.length} block(s) without learningMeta (${label}). Sample:`,
      sample.map((w) => w.message)
    );
  }
  return warnings;
}
