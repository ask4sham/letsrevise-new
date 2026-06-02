export type InteractiveSequenceIntroSectionId = "big-question" | "your-mission" | "exam-link";

export type InteractiveSequenceIntroSection = {
  id: InteractiveSequenceIntroSectionId;
  label: string;
  body: string;
};

const INTRO_MARKER_SPLIT_RE =
  /(🔍\s*BIG\s+QUESTION|🎯\s*YOUR\s+MISSION|📝\s*EXAM\s+LINK)\s*/gi;

const INTRO_MARKER_DETECT_RE =
  /🔍\s*BIG\s+QUESTION|🎯\s*YOUR\s+MISSION|📝\s*EXAM\s+LINK/i;

const SECTION_META: Record<
  InteractiveSequenceIntroSectionId,
  { label: string }
> = {
  "big-question": { label: "🔍 BIG QUESTION" },
  "your-mission": { label: "🎯 YOUR MISSION" },
  "exam-link": { label: "📝 EXAM LINK" },
};

function markerTokenToSectionId(token: string): InteractiveSequenceIntroSectionId | null {
  const t = token.replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim().toLowerCase();
  if (/big\s+question/.test(t)) return "big-question";
  if (/your\s+mission/.test(t)) return "your-mission";
  if (/exam\s+link/.test(t)) return "exam-link";
  return null;
}

/** True when intro uses LetsRevise step-by-step teaching markers. */
export function hasInteractiveSequenceIntroMarkers(text: string): boolean {
  return INTRO_MARKER_DETECT_RE.test(String(text ?? ""));
}

/**
 * Splits intro text into labelled sections when teaching markers are present.
 * Returns null for legacy intros (single paragraph rendering).
 */
export function parseInteractiveSequenceIntro(
  intro: string
): InteractiveSequenceIntroSection[] | null {
  const raw = String(intro ?? "");
  if (!hasInteractiveSequenceIntroMarkers(raw)) return null;

  const tokens = raw.split(INTRO_MARKER_SPLIT_RE);
  const sections: InteractiveSequenceIntroSection[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token?.trim()) continue;
    const id = markerTokenToSectionId(token);
    if (!id) continue;
    const body = String(tokens[i + 1] ?? "").trim();
    sections.push({ id, label: SECTION_META[id].label, body });
    i += 1;
  }

  return sections.length > 0 ? sections : null;
}

/** Primary heading markdown for BIG QUESTION / YOUR MISSION bodies. */
export function introSectionBodyToHeadingMarkdown(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (/^#{1,6}\s/m.test(trimmed)) return trimmed;
  return `## ${trimmed}`;
}

/** Formats EXAM LINK pathway chains for readable line-by-line display. */
export function formatExamLinkIntroBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (!/→/.test(trimmed)) return trimmed;
  const parts = trimmed
    .split(/\s*→\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return trimmed;
  return parts.map((part, index) => (index === 0 ? part : `→ ${part}`)).join("\n");
}
