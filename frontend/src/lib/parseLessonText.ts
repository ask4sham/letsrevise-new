/**
 * Parse LetsRevise legacy / text-schema lesson content into structured segments
 * for preview rendering. Storage remains raw text — this is render-time only.
 */

export type LessonHeadingSegment = { type: "heading"; text: string };

export type LessonCheckpointSegment = {
  type: "checkpoint";
  question: string;
  options: string[];
  answer: string;
};

export type LessonMarkdownSegment = { type: "markdown"; text: string };

export type LessonSegment = LessonHeadingSegment | LessonCheckpointSegment | LessonMarkdownSegment;

const BOLD_HEADING_LINE = /^\s*\*\*(.+?)\*\*\s*$/;
const CHECKPOINT_START = /^⚡\s*CHECKPOINT\s*$/i;
const OPTION_LINE = /^Option\s*(\d+):\s*(.*)$/i;

/** Normalise letsrevise-generator style headings before line-based parsing. */
export function preprocessCheckpointHeadings(raw: string): string {
  return String(raw ?? "")
    .replace(/\r/g, "")
    .replace(/^\*{2}\s*⚡\s*CHECKPOINT\s*\*{2}\s*$/gm, "⚡ CHECKPOINT")
    .replace(/^\*{2}\s*QUICK\s+CHECK\b(.*?)\*{2}\s*$/gim, "⚡ CHECKPOINT")
    .replace(/^Quick\s+check\b(.*)$/gm, "⚡ CHECKPOINT$1")
    .replace(/^\d+\.\s+QUICK\s+CHECK\b(.*)$/gim, "⚡ CHECKPOINT$1")
    .replace(/^\d+\s*[\u2014\u2013\-]\s*.*QUICK\s+CHECK\b.*$/gim, "⚡ CHECKPOINT");
}

function isSegmentBreakLine(trimmed: string): boolean {
  return BOLD_HEADING_LINE.test(trimmed) || CHECKPOINT_START.test(trimmed);
}

function parseOptionsAndAnswer(
  question: string,
  lines: string[],
  start: number
): { ok: true; segment: LessonCheckpointSegment; end: number } | { ok: false } {
  let i = start;
  const options: string[] = [];

  while (i < lines.length && OPTION_LINE.test(lines[i])) {
    const m = lines[i].match(OPTION_LINE);
    i++;
    const first = m && m[2] != null ? m[2].trim() : "";
    const optParts: string[] = first ? [first] : [];
    while (i < lines.length && !OPTION_LINE.test(lines[i]) && !/^Answer:/i.test(lines[i].trim())) {
      const t = lines[i];
      if (isSegmentBreakLine(t.trim())) break;
      optParts.push(t);
      i++;
    }
    options.push(optParts.join("\n").trim());
  }

  let answer = "";
  if (i < lines.length && /^Answer:/i.test(lines[i].trim())) {
    const am = lines[i].match(/^Answer:\s*(.*)$/i);
    answer = (am && am[1] != null ? am[1] : "").trim();
    i++;
    const aRest: string[] = [];
    while (i < lines.length) {
      const t = lines[i];
      const tr = t.trim();
      if (isSegmentBreakLine(tr)) break;
      if (/^Question:\s*$/i.test(tr) || /^Question:/i.test(tr)) break;
      if (OPTION_LINE.test(t)) break;
      if (/^⚡\s*CHECKPOINT/i.test(tr)) break;
      aRest.push(t);
      i++;
    }
    if (aRest.length) {
      answer = answer ? `${answer}\n${aRest.join("\n").trim()}` : aRest.join("\n").trim();
    }
  }

  const segment: LessonCheckpointSegment = {
    type: "checkpoint",
    question: question.trim(),
    options: options.filter((o) => o.length > 0),
    answer: answer.trim(),
  };

  if (!segment.question && segment.options.length === 0 && !segment.answer) {
    return { ok: false };
  }

  return { ok: true, segment, end: i };
}

function tryParseCheckpoint(
  lines: string[],
  checkpointLineIndex: number
): { ok: true; segment: LessonCheckpointSegment; end: number } | { ok: false } {
  let i = checkpointLineIndex + 1;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return { ok: false };

  const qLine = lines[i];
  const qTrim = qLine.trim();

  if (/^Question:\s*$/i.test(qTrim)) {
    i++;
    const qBody: string[] = [];
    while (i < lines.length && !OPTION_LINE.test(lines[i]) && !/^Answer:/i.test(lines[i].trim())) {
      const t = lines[i];
      if (isSegmentBreakLine(t.trim())) break;
      if (/^⚡\s*CHECKPOINT/i.test(t.trim())) break;
      qBody.push(t);
      i++;
    }
    const question = qBody.join("\n").trim();
    const rest = parseOptionsAndAnswer(question, lines, i);
    return rest.ok ? rest : { ok: false };
  }

  const qm = qLine.match(/^Question:\s*(.*)$/i);
  if (!qm) return { ok: false };
  const qFirst = (qm[1] || "").trim();
  i++;
  if (i < lines.length && (OPTION_LINE.test(lines[i]) || /^Answer:/i.test(lines[i].trim()))) {
    return parseOptionsAndAnswer(qFirst, lines, i);
  }
  const qBody: string[] = qFirst ? [qFirst] : [];
  while (i < lines.length && !OPTION_LINE.test(lines[i]) && !/^Answer:/i.test(lines[i].trim())) {
    const t = lines[i];
    if (isSegmentBreakLine(t.trim())) break;
    if (/^⚡\s*CHECKPOINT/i.test(t.trim())) break;
    qBody.push(t);
    i++;
  }
  const question = qBody.join("\n").trim();
  const rest = parseOptionsAndAnswer(question, lines, i);
  return rest.ok ? rest : { ok: false };
}

/**
 * Split lesson text into headings, checkpoint cards, and markdown fragments.
 * On any unexpected shape, segments fall back to markdown chunks (graceful).
 */
export function parseLessonText(raw: string): LessonSegment[] {
  const text = preprocessCheckpointHeadings(raw == null ? "" : String(raw));
  let lines: string[];
  try {
    lines = text.split(/\r?\n/);
  } catch {
    return [{ type: "markdown", text }];
  }

  const segments: LessonSegment[] = [];
  let buf: string[] = [];
  let i = 0;

  const flush = () => {
    if (buf.length === 0) return;
    const chunk = buf.join("\n");
    buf = [];
    if (chunk.length > 0) {
      segments.push({ type: "markdown", text: chunk });
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (BOLD_HEADING_LINE.test(trimmed)) {
      flush();
      const inner = trimmed.replace(BOLD_HEADING_LINE, "$1").trim();
      segments.push({ type: "heading", text: inner });
      i++;
      continue;
    }

    if (CHECKPOINT_START.test(trimmed)) {
      const parsed = tryParseCheckpoint(lines, i);
      if (parsed.ok) {
        flush();
        segments.push(parsed.segment);
        i = parsed.end;
        continue;
      }
      buf.push(line);
      i++;
      continue;
    }

    buf.push(line);
    i++;
  }

  flush();

  if (segments.length === 0) {
    return [{ type: "markdown", text }];
  }
  return segments;
}
