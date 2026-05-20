/**
 * Question difficulty tiers without new DB fields — stored as a reserved markScheme line.
 * Format: `@lr-difficulty:easy` | `medium` | `hard`
 */

export type CheckpointDifficultyTier = "easy" | "medium" | "hard";

const META_PREFIX = "@lr-difficulty:";
const META_RE = /^@lr-difficulty:\s*(easy|medium|hard)\s*$/i;

export const CHECKPOINT_DIFFICULTY_BADGE: Record<
  CheckpointDifficultyTier,
  { label: string; color: string; background: string; border: string }
> = {
  easy: {
    label: "Foundation",
    color: "#166534",
    background: "#ecfdf5",
    border: "1px solid rgba(34, 197, 94, 0.45)",
  },
  medium: {
    label: "Standard",
    color: "#b45309",
    background: "#fffbeb",
    border: "1px solid rgba(245, 158, 11, 0.45)",
  },
  hard: {
    label: "Higher",
    color: "#b91c1c",
    background: "#fef2f2",
    border: "1px solid rgba(239, 68, 68, 0.4)",
  },
};

export function normalizeCheckpointDifficultyTier(
  raw: unknown
): CheckpointDifficultyTier | undefined {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "easy" || s === "foundation") return "easy";
  if (s === "medium" || s === "standard") return "medium";
  if (s === "hard" || s === "higher") return "hard";
  return undefined;
}

export function encodeDifficultyMarkSchemeLine(
  tier: CheckpointDifficultyTier
): string {
  return `${META_PREFIX}${tier}`;
}

export function parseDifficultyFromMarkScheme(
  markScheme?: string[] | null
): { tier?: CheckpointDifficultyTier; markScheme: string[] } {
  const ms = Array.isArray(markScheme)
    ? markScheme.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  let tier: CheckpointDifficultyTier | undefined;
  const rest: string[] = [];
  for (const line of ms) {
    const m = line.match(META_RE);
    if (m) {
      tier = normalizeCheckpointDifficultyTier(m[1]);
      continue;
    }
    rest.push(line);
  }
  return { tier, markScheme: rest };
}

export function applyDifficultyToMarkScheme(
  markScheme: string[] | undefined,
  tier: CheckpointDifficultyTier | undefined
): string[] | undefined {
  const { markScheme: rest } = parseDifficultyFromMarkScheme(markScheme);
  if (!tier) return rest.length ? rest : undefined;
  return [encodeDifficultyMarkSchemeLine(tier), ...rest];
}

export function parseDifficultyFromPasteText(text: string): CheckpointDifficultyTier | undefined {
  const m = String(text ?? "").match(/^Difficulty:\s*(easy|medium|hard)\s*$/im);
  return m ? normalizeCheckpointDifficultyTier(m[1]) : undefined;
}
