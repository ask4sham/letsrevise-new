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

const INTRO_STEP_LINE_RE =
  /^(?:[-•*]\s*)?Step\s+(\d+)\s*([—–\-:])\s*(.+)$/i;

const INTRO_STEP_BLOB_RE =
  /(?:[-•*]\s*)?Step\s+(\d+)\s*([—–\-:])\s*([\s\S]*?)(?=(?:\s+(?:[-•*]\s*)?Step\s+\d+\s*(?:[—–\-:]))|$)/gi;

export type InteractiveSequenceIntroStepList = {
  preamble: string;
  steps: string[];
};

function formatIntroStepLine(num: string, separator: string, body: string): string {
  const cleaned = String(body ?? "")
    .replace(/\s*↓\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (separator === ":") {
    return `Step ${num}: ${cleaned}`;
  }
  return `Step ${num} — ${cleaned}`;
}

function parseIntroStepLine(line: string): string | null {
  const trimmed = String(line ?? "").trim();
  if (!trimmed || trimmed === "↓") return null;
  const m = trimmed.match(INTRO_STEP_LINE_RE);
  if (!m) return null;
  return formatIntroStepLine(m[1], m[2], m[3]);
}

/**
 * Plain-text step-by-step intro overview (export puts "- Step N — …" lines in intro).
 * Returns null when teaching markers, HTML, or no step lines are present.
 */
export function parseInteractiveSequenceIntroStepList(
  intro: string
): InteractiveSequenceIntroStepList | null {
  const raw = String(intro ?? "").trim();
  if (!raw) return null;
  if (hasInteractiveSequenceIntroMarkers(raw)) return null;
  if (/<[a-z][\s\S]*>/i.test(raw)) return null;

  const lines = raw.split(/\r?\n/);
  const steps: string[] = [];
  let firstStepLineIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseIntroStepLine(lines[i]);
    if (parsed) {
      if (firstStepLineIndex < 0) firstStepLineIndex = i;
      steps.push(parsed);
    }
  }

  const stepMarkerCount = (raw.match(/(?:[-•*]\s*)?Step\s+\d+\s*(?:[—–\-:])/gi) || []).length;

  if (steps.length > 0 && steps.length >= stepMarkerCount) {
    const preamble = lines
      .slice(0, firstStepLineIndex)
      .map((l) => l.trim())
      .filter((l) => l && l !== "↓")
      .join("\n\n")
      .trim();
    return { preamble, steps };
  }

  const blobSteps: string[] = [];
  let match: RegExpExecArray | null;
  INTRO_STEP_BLOB_RE.lastIndex = 0;
  while ((match = INTRO_STEP_BLOB_RE.exec(raw)) !== null) {
    blobSteps.push(formatIntroStepLine(match[1], match[2], match[3]));
  }

  if (blobSteps.length === 0) return null;

  const firstMatch = raw.search(/(?:[-•*]\s*)?Step\s+\d+\s*(?:[—–\-:])/i);
  const preamble = firstMatch > 0 ? raw.slice(0, firstMatch).trim() : "";
  return { preamble, steps: blobSteps };
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
