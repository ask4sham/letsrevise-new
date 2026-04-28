/** Local MCQ for interactiveSequence when step.caption holds the correct answer. No API. */

const POOL = [
  "Chromosomes condense and the nuclear membrane breaks down",
  "The cell splits into two genetically identical daughter cells",
  "Chromosomes line up along the centre attached to spindle fibres",
  "Spindle fibres pull sister chromatids toward opposite poles",
  "The nucleus reforms around each group of chromosomes",
  "The cell grows and DNA copies before division proceeds further",
  "The cytoplasm divides between the two new nuclei",
  "Chromatids separate and move to opposite poles of the cell",
  "Mitochondria multiply so daughter cells inherit enough organelles",
  "Microtubules assemble between opposite poles of the dividing cell",
  "Chromosomes replicate so each consists of two sister chromatids",
  "Chromatin unwinds back into long thin fibres between divisions",
  "The spindle checkpoint delays progress until chromosomes attach correctly",
  "Crossing over between homologous chromosomes increases genetic variation",
  "Homologous chromosomes pair in synapsis during meiosis",
  "Ribosomes translate mRNA on the rough endoplasmic reticulum",
  "Hydrogen ions flow through ATP synthase to make ATP",
  "Water moves into plant cells when the surrounding solution is dilute",
  "Oxygen diffuses from alveoli into blood down a concentration gradient",
  "Enzymes lower activation energy so reactions proceed faster",
  "DNA is transcribed into messenger RNA in the nucleus",
  "Vesicles fuse with the plasma membrane during exocytosis",
  "The phospholipid bilayer controls what enters and leaves the cell",
  "Active transport uses energy to move substances against a gradient",
  "Plasmolysis occurs when the plant cell loses water to a hypertonic medium",
];

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Deterministic shuffle for stable option order per step. */
function shuffleStableSeed<T>(items: T[], seed: number): T[] {
  const a = [...items];
  let s = Math.imul(seed ^ 0x811c9dc5, 0x01000193) >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 16), 2246822507) >>> 0;
    s ^= s >>> 13;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** One correct (`caption`) plus two distractors → three options, shuffled. */
export function buildCaptionQuizOptions(correctRaw: string, stepIndex: number): string[] {
  const correct = correctRaw.trim();
  if (!correct) return [];

  const nc = norm(correct);
  const used = new Set<string>([nc]);
  const distractors: string[] = [];

  for (const d of POOL) {
    if (distractors.length >= 2) break;
    const nd = norm(d);
    if (used.has(nd)) continue;
    if (correct.length > 24 && (nc.includes(nd) || nd.includes(nc))) continue;
    used.add(nd);
    distractors.push(d);
  }

  let pad = 0;
  while (distractors.length < 2) {
    const fill = `Other structural changes occur that do not match this stage (${stepIndex}-${pad})`;
    pad += 1;
    const nd = norm(fill);
    if (used.has(nd)) continue;
    used.add(nd);
    distractors.push(fill);
  }

  const options = [correct, ...distractors.slice(0, 2)];
  const seed = Math.imul(stepIndex, 1315423911) ^ Math.imul(correct.length, 9741);
  return shuffleStableSeed(options, seed);
}

export function captionsMatchChosen(chosen: string | undefined | null, correctCaption: string | undefined | null): boolean {
  const a = (chosen ?? "").trim();
  const b = (correctCaption ?? "").trim();
  if (!a || !b) return false;
  if (a === b) return true;
  return a.toLowerCase() === b.toLowerCase();
}

/** Leading emojis authors insert via rich toolbars (e.g. “Key point” 👉) — hide in MCQ labels so they don’t hint the answer. Longer / skin-tone variants first. */
const LEADING_HINT_PREFIXES = [
  "👉🏻",
  "👉🏼",
  "👉🏽",
  "👉🏾",
  "👉🏿",
  "👆🏻",
  "👆🏼",
  "👇🏻",
  "👈🏻",
  "👉",
  "👈",
  "👆",
  "👇",
  "☝️",
  "☝",
  "💡",
  "✅",
  "❌",
  "✔️",
  "✔",
  "📌",
  "⭐",
] as const;

function stripBalancedOuterQuotes(s: string): string {
  const t = s.trim();
  if (t.length < 2) return s;
  const a = t[0];
  const b = t[t.length - 1];
  const paired =
    (a === "\"" && b === "\"") ||
    (a === "'" && b === "'") ||
    (a === "\u201C" && b === "\u201D") ||
    (a === "\u2018" && b === "\u2019");
  if (paired) return t.slice(1, -1).trim();
  return s;
}

/**
 * Text shown beside each quiz option — strips instructional prefixes/quotes stored in captions.
 * Full `opt` strings are still used for selection and scoring.
 */
export function formatInteractiveSequenceMcqOptionDisplay(raw: string | undefined | null): string {
  if (raw == null || typeof raw !== "string") {
    return "";
  }
  let s = raw.replace(/^\uFEFF/, "").trimStart();
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of LEADING_HINT_PREFIXES) {
      if (s.startsWith(p)) {
        s = s.slice(p.length).trimStart();
        changed = true;
        break;
      }
    }
  }
  const cleaned = stripBalancedOuterQuotes(s.trim());
  return cleaned || raw.trim();
}
