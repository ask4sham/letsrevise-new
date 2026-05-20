/** SS1 block heading: `8 — GRAPH / DATA VISUALISATION` (lesson ordinal + clean label). */

/** Matches `3 —`, `7b —`, `12 —` at start of a stored title. */
export const SS1_NUMBERED_TITLE_PREFIX_RE = /^([\d]+[a-zA-Z]?)\s*[\u2014\u2013\-]\s*(.*)$/;

const CORE_TEACHING_LABEL_RE = /\bcore\s+teaching\b/gi;
const SCENARIO_HOOK_LABEL_RE = /\bscenario\s*\/\s*hook\b/gi;

/** Rename legacy generator SS1 label in stored titles (display + load normalisation). */
export function normalizeLegacyBlockLabel(label: string): string {
  let out = String(label ?? "").replace(CORE_TEACHING_LABEL_RE, (match) => {
    if (match === match.toUpperCase()) return "CORE LEARNING";
    if (match[0] === match[0].toUpperCase()) return "Core Learning";
    return "core learning";
  });
  out = out.replace(SCENARIO_HOOK_LABEL_RE, (match) => {
    if (match === match.toUpperCase()) return "SCENARIO";
    if (match[0] === match[0].toUpperCase()) return "Scenario";
    return "scenario";
  });
  return out;
}

export function normalizeLegacySs1Heading(heading: string): string {
  const raw = String(heading ?? "").trim();
  const m = raw.match(SS1_NUMBERED_TITLE_PREFIX_RE);
  if (!m) return normalizeLegacyBlockLabel(raw);
  const num = m[1];
  const label = normalizeLegacyBlockLabel(String(m[2] ?? "").trim());
  return label ? `${num} — ${label}` : raw;
}

export type BlockHeadingSource = {
  title?: unknown;
  number?: unknown;
};

/** Strip one or more stacked SS1 prefixes (`8 — 7b — Title` → `Title`). */
export function stripSs1PrefixFromTitle(title: string): string {
  let t = String(title ?? "").trim();
  let prev = "";
  while (prev !== t) {
    prev = t;
    const m = t.match(SS1_NUMBERED_TITLE_PREFIX_RE);
    if (m) t = String(m[2] ?? "").trim();
    else break;
  }
  return normalizeLegacyBlockLabel(t);
}

export function titleAlreadyHasSs1Prefix(title: string): boolean {
  return SS1_NUMBERED_TITLE_PREFIX_RE.test(String(title ?? "").trim());
}

/**
 * Canonical student heading: always `block.number — cleanLabel`.
 * Never preserves legacy subsection ids (e.g. `7b`) when `number` is set.
 */
export function formatStudentBlockHeading(block: BlockHeadingSource | null | undefined): string {
  if (!block || typeof block !== "object") return "";

  const label = normalizeLegacyBlockLabel(stripSs1PrefixFromTitle(String(block.title ?? "")));
  const n = block.number;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) {
    if (!label) return "";
    return `${Math.trunc(n)} — ${label}`;
  }

  const raw = String(block.title ?? "").trim();
  if (raw && titleAlreadyHasSs1Prefix(raw)) return normalizeLegacySs1Heading(raw);
  return label;
}

/** Normalise persisted block title field (fixes legacy `8 — 7b — …` rows on load). */
export function normalizePersistedBlockTitle<T extends BlockHeadingSource>(block: T): T {
  if (!block || typeof block !== "object") return block;
  const label = normalizeLegacyBlockLabel(stripSs1PrefixFromTitle(String(block.title ?? "")));
  if (!label && !block.number) return block;
  return { ...block, title: label };
}

/** True when markdown content already opens with the same heading line. */
export function studentContentStartsWithHeading(content: string, heading: string): boolean {
  const h = heading.trim();
  if (!h) return false;
  const first =
    String(content ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) ?? "";
  if (!first) return false;
  const normalized = first.replace(/^#{1,6}\s+/, "").trim();
  return normalized === h || first === h;
}

/** Assign SS1 display number when legacy rows only have a combined title or no number field. */
export function resolveSs1BlockNumber(
  block: BlockHeadingSource,
  lessonOrdinal: number
): number | undefined {
  const n = block.number;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) return Math.trunc(n);
  if (lessonOrdinal > 0) return lessonOrdinal;
  return undefined;
}
