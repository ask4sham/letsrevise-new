/**
 * Parses MCQ checkpoints from LetsRevise Generator–style pasted text into structured fields
 * (CreateLesson / EditLesson paste path). Mirrors tolerant logic from letsrevise-generator/lib/parseLessonText.js.
 */

import {
  applyDifficultyToMarkScheme,
  normalizeCheckpointDifficultyTier,
  type CheckpointDifficultyTier,
} from "./checkpointDifficulty";

const CHECKPOINT_HEADING_LINE =
  /^(?:\*\*)?\s*⚡\s*CHECKPOINT(?:\*\*)?\s*$/i;
const QUICK_CHECK_HEADING_LINE = /^QUICK\s*CHECK(?:\s*[:—\-].*)?\s*$/i;
/** `12 — QUICK CHECK` or numbered worked-example-checkpoint headings */
const NUMBERED_TOPIC_LINE = /^\d+\s*[\u2014\u2013\-]\s*.+/;

const ANSWER_HEADING_LINE = /^(?:Answer|Correct\s+answer|Answer\s+key)\s*:/i;
/** Body line that starts Explanation (captures continuation for multi-line explanations) */
const EXPL_HEADING_LINE = /^Explanation\s*:/i;
const DIFFICULTY_HEADING_LINE = /^Difficulty\s*:/i;
const DIFFICULTY_BARE_LINE = /^Difficulty\s*$/i;

function cleanLine(line: string): string {
  return String(line || "").replace(/\r/g, "").trim();
}

export function htmlToPlainText(value: string): string {
  return String(value ?? "")
    /** Whole <details> blocks are handled in MCQ parsing (answer extraction); never leak summary UI text into stems. */
    .replace(/<details[^>]*>[\s\S]*?<\/details>/gi, "")
    /** Orphan summaries (invalid HTML) — remove entirely (do not inject "Reveal: " + summary text). */
    .replace(/<summary[^>]*>[\s\S]*?<\/summary>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/ul>/gi, "\n")
    .replace(/<ul[^>]*>/gi, "")
    .replace(/<\/ol>/gi, "\n")
    .replace(/<ol[^>]*>/gi, "")
    .replace(/<strong[^>]*>/gi, "")
    .replace(/<\/strong>/gi, "")
    .replace(/<em[^>]*>/gi, "")
    .replace(/<\/em>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function removeDetailsFragments(value: string): string {
  return String(value)
    .replace(/<details[^>]*>/gi, "")
    .replace(/<\/details>/gi, "")
    .trim();
}

/**
 * Pull hidden model answers out of <details>…</details> (generator / SS1 HTML), strip them from the
 * question stem, and return plain text suitable for `correctAnswer` when no `Answer:` line exists.
 */
function extractDetailsAnswersAndStripHtml(sectionText: string): {
  strippedSection: string;
  combinedDetailsAnswer: string;
} {
  const answers: string[] = [];
  const strippedSection = String(sectionText ?? "").replace(
    /<details[^>]*>([\s\S]*?)<\/details>/gi,
    (_full, inner: string) => {
      const body = String(inner ?? "")
        .replace(/<summary[^>]*>[\s\S]*?<\/summary>/gi, "")
        .trim();
      if (body) {
        answers.push(htmlToPlainText(body));
      }
      return "";
    },
  );
  return {
    strippedSection: strippedSection.replace(/\n{3,}/g, "\n\n").trim(),
    combinedDetailsAnswer: answers.join("\n\n").trim(),
  };
}

/**
 * Normalize common generator / Word variants without breaking unrelated prose too aggressively.
 */
export function normalizeFlexibleCheckpointPasteText(raw: string): string {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/^(Paste\s+into:\s*.*)$/gim, "")
    .replace(/^(Correct\s+answer)\s*:/gim, "Answer:")
    .replace(/^(Answer\s+key)\s*:/gim, "Answer:")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Normalises SS1 / Word / clipboard-damaged checkpoint headings.
 * Exported for unit tests.
 */
export function sanitizeCheckpointMcqPasteText(raw: string): string {
  const lines = String(raw ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  function normalizeHeadingToken(tr: string): string | null {
    const t = tr.trim();
    if (/^CHECKPOINT\s*$/i.test(t) && !/⚡/.test(t)) return "**⚡ CHECKPOINT**";
    if (/^\*{2}\s*⚡\s*CHECKPOINT\s*\*{2}$/i.test(t)) return "**⚡ CHECKPOINT**";
    if (/^⚡\s*CHECKPOINT\*+$/.test(t)) return "**⚡ CHECKPOINT**";
    if (/^\*+\s*⚡\s*CHECKPOINT\*+$/.test(t)) return "**⚡ CHECKPOINT**";
    if (/^\*+\s*⚡\s*CHECKPOINT\s*\*+$/.test(t)) return "**⚡ CHECKPOINT**";
    if (/^⚡\s*CHECKPOINT\s*$/i.test(t)) return "**⚡ CHECKPOINT**";
    return null;
  }

  for (const line of lines) {
    const tr = line.trim();
    if (/^\d+\.\s*CHECKPOINT\s*$/i.test(tr)) continue;
    if (/^\d+\s*[\u2014\u2013\-]\s*CHECKPOINT\s*$/i.test(tr)) continue;

    const bullet = tr.match(/^[-•*]\s+(.+)$/);
    if (bullet) {
      const inner = bullet[1]!.trim();
      const nh = normalizeHeadingToken(inner);
      if (nh) {
        out.push(nh);
        continue;
      }
    }

    const nh = normalizeHeadingToken(tr);
    if (nh) {
      out.push(nh);
      continue;
    }

    out.push(line);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extractAnswerLineFromClipboard(full: string): string {
  const m = full.match(/(?:^|[\n\r])\s*(?:Answer|Correct\s+answer|Answer\s+key)\s*:\s*([^\n\r]+)/i);
  return m?.[1]?.trim() ?? "";
}

function extractExplanationTailFromClipboard(full: string): string {
  const m = full.match(/(?:^|[\n\r])\s*Explanation\s*:\s*([\s\S]*)$/im);
  if (!m?.[1]) return "";
  const chunk = String(m[1]);
  const cut = chunk.split(/\*\*\s*⚡\s*CHECKPOINT|\n⚡\s*CHECKPOINT/i)[0]?.trim();
  return cut ?? chunk.trim();
}

/**
 * Fallback: legacy generator copy used formatCheckpointVisibleHtml (p/ul/li; answer may follow in plain text).
 */
export function convertLegacyHtmlCheckpointExportToCanonicalPlain(fullInput: string): string | null {
  if (typeof DOMParser === "undefined") return null;

  const full = String(fullInput ?? "").trim();
  if (!full.includes("<") || !/<\s*(?:p|ul|li)\b/i.test(full)) return null;

  const htmlStartIdx = full.search(/<[a-z!?]/i);
  if (htmlStartIdx < 0) return null;
  const htmlBlob = full.slice(htmlStartIdx);

  try {
    const doc = new DOMParser().parseFromString(htmlBlob, "text/html");
    const root = doc.body;
    if (!root) return null;

    let questionText = "";
    const paragraphs = Array.from(root.querySelectorAll("p"));
    for (let i = 0; i < paragraphs.length; i++) {
      const st = paragraphs[i]!.querySelector("strong");
      if (st && /^question$/i.test((st.textContent || "").trim())) {
        const next = paragraphs[i + 1];
        questionText = next ? (next.textContent || "").replace(/\s+/g, " ").trim() : "";
        break;
      }
    }

    if (!questionText) {
      for (const p of paragraphs) {
        const st = p.querySelector("strong");
        if (!st || !/^question$/i.test((st.textContent || "").trim())) continue;
        const el = p.cloneNode(true) as HTMLElement;
        el.querySelector("strong")?.remove();
        questionText = (el.textContent || "").replace(/\s+/g, " ").trim();
        break;
      }
    }

    if (!questionText.trim()) {
      const ul = root.querySelector("ul");
      let prev = ul?.previousElementSibling ?? null;
      while (prev && prev.tagName !== "P") prev = prev.previousElementSibling;
      if (prev?.tagName === "P") {
        const txt = (prev.textContent || "").replace(/\s+/g, " ").trim();
        if (txt.length && !/^question$/i.test(txt)) questionText = txt;
      }
    }

    const lis = Array.from(root.querySelectorAll("ul li"))
      .map((li) => (li.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    if (!questionText.trim() || lis.length < 2) return null;

    let answerText = extractAnswerLineFromClipboard(full);

    const det = root.querySelector("details");
    if (det) {
      const dtxt = (det.textContent || "")
        .replace(/^\s*reveal\s*:\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();
      if (dtxt.length > 3) answerText = answerText || dtxt;
    }

    if (!answerText.trim()) return null;

    const explText = extractExplanationTailFromClipboard(full);

    const opts = lis.slice(0, 4);
    while (opts.length < 4) opts.push(" ");

    const lines = ["**⚡ CHECKPOINT**", "", "Question:", questionText.trim(), ""];
    for (let i = 0; i < 4; i++) {
      lines.push(`Option ${i + 1}:`);
      lines.push((opts[i] || "").trim() || " ");
      lines.push("");
    }
    lines.push("Answer:");
    lines.push(answerText.trim());
    lines.push("");
    lines.push("Explanation:");
    lines.push(explText);

    return lines.join("\n").trimEnd();
  } catch {
    return null;
  }
}

function stripLeadingSs1PastePreamble(lines: string[], startIdx: number): number {
  let i = startIdx;
  while (i < lines.length) {
    const L = cleanLine(lines[i]!);
    if (!L) {
      i++;
      continue;
    }
    if (/^paste\s+into:/i.test(L)) {
      i++;
      continue;
    }
    if (/^\d+\.\s*CHECKPOINT\b/i.test(L)) {
      i++;
      continue;
    }
    if (NUMBERED_TOPIC_LINE.test(L) && /\b(?:quick\s*check|checkpoint)\b/i.test(L)) {
      i++;
      continue;
    }
    break;
  }
  return i;
}

function stripOptionalCheckpointTitles(lines: string[], startIdx: number): number {
  let i = startIdx;
  while (i < lines.length && !cleanLine(lines[i]!)) i++;
  if (i >= lines.length) return i;
  const L = cleanLine(lines[i]!);
  const boldCp = /^\*{2}\s*⚡\s*CHECKPOINT\s*\*{2}$/i.test(L);
  if (boldCp || CHECKPOINT_HEADING_LINE.test(L) || QUICK_CHECK_HEADING_LINE.test(L)) {
    i++;
    while (i < lines.length && !cleanLine(lines[i]!)) i++;
    return i;
  }
  return i;
}

function isBlank(line: string): boolean {
  return cleanLine(line) === "";
}

function isDifficultyLine(line: string): boolean {
  const s = cleanLine(htmlToPlainText(line));
  return DIFFICULTY_HEADING_LINE.test(s) || DIFFICULTY_BARE_LINE.test(s);
}

/** Strip `Difficulty: tier` (generator SS1) from body lines before question/option parsing. */
function extractDifficultyFromBodyLines(bodyLines: string[]): {
  difficultyTier?: CheckpointDifficultyTier;
  bodyLines: string[];
} {
  const lines = [...bodyLines];
  const diffIdx = lines.findIndex((l) => isDifficultyLine(String(l ?? "")));
  if (diffIdx < 0) return { bodyLines: lines };

  const raw = String(lines[diffIdx] ?? "");
  const inline = cleanLine(htmlToPlainText(raw)).replace(/^Difficulty\s*:/i, "").trim();
  if (inline) {
    const tier = normalizeCheckpointDifficultyTier(inline);
    lines.splice(diffIdx, 1);
    return { ...(tier ? { difficultyTier: tier } : {}), bodyLines: lines };
  }

  if (DIFFICULTY_BARE_LINE.test(cleanLine(htmlToPlainText(raw)))) {
    lines.splice(diffIdx, 1);
    while (diffIdx < lines.length && isBlank(String(lines[diffIdx] ?? ""))) {
      lines.splice(diffIdx, 1);
    }
    if (diffIdx < lines.length) {
      const next = cleanLine(htmlToPlainText(String(lines[diffIdx] ?? "")));
      if (
        next &&
        !/^Question\s*:/i.test(next) &&
        !ANSWER_HEADING_LINE.test(next) &&
        !/^Option\s+/i.test(next) &&
        !/^⚡\s*CHECKPOINT/i.test(next)
      ) {
        const tier = normalizeCheckpointDifficultyTier(next);
        lines.splice(diffIdx, 1);
        return { ...(tier ? { difficultyTier: tier } : {}), bodyLines: lines };
      }
    }
    return { bodyLines: lines };
  }

  lines.splice(diffIdx, 1);
  return { bodyLines: lines };
}

function isOptionLine(line: string, optionsPhase: boolean, prevBlank: boolean): boolean {
  const raw = cleanLine(line);
  if (!raw) return false;
  const s = cleanLine(htmlToPlainText(raw));
  if (isDifficultyLine(line)) return false;
  if (/^Question\s*:/i.test(s)) return false;
  if (ANSWER_HEADING_LINE.test(s)) return false;

  if (/^Option\s+(?:\d+|[A-Za-z])\s*:/i.test(s)) return true;
  if (/^[-•*]\s+Option\s+(?:\d+|[A-Za-z])\s*:/i.test(s)) return true;
  if (/^\d+[\).\]]\s+\S/.test(s)) return true;
  if (/^[A-Za-z]\.\s+\S/.test(s)) return true;
  if (/^\([A-Za-z]\)\s+\S/.test(s)) return true;
  if (/^[A-Za-z]\)\s+\S/.test(s)) return true;
  if (/^[-•*]\s+\S/.test(s)) {
    return optionsPhase || prevBlank;
  }
  return false;
}

function cleanOptionText(line: string): string {
  let s = cleanLine(htmlToPlainText(line));
  s = s.replace(/^[-•*]\s+/, "").trim();
  s = s.replace(/^Option\s+(?:\d+|[A-Za-z])\s*:\s*/i, "").trim();
  s = s.replace(/^\([A-Za-z]\)\s+/, "").trim();
  s = s.replace(/^[A-Za-z]\)\s+/, "").trim();
  s = s.replace(/^[A-Za-z]\.\s+/, "").trim();
  s = s.replace(/^\d+[\).\]]\s+/, "").trim();
  return s.trim();
}

function isNewOptionHeaderLine(line: string): boolean {
  const raw = cleanLine(line);
  if (!raw) return false;
  const s = cleanLine(htmlToPlainText(raw));
  if (ANSWER_HEADING_LINE.test(s) || /^Question\s*:/i.test(s)) return false;
  if (/^Option\s+(?:\d+|[A-Za-z])\s*:/i.test(s)) return true;
  if (/^[-•*]\s+Option\s+(?:\d+|[A-Za-z])\s*:/i.test(s)) return true;
  if (/^\d+[\).\]]\s+\S/.test(s)) return true;
  if (/^[A-Za-z]\.\s+\S/.test(s)) return true;
  if (/^\([A-Za-z]\)\s+\S/.test(s)) return true;
  if (/^[A-Za-z]\)\s+\S/.test(s)) return true;
  return false;
}

function extractOptions(lines: string[], startIndex: number): string[] {
  const out: string[] = [];
  let optionsPhase = false;
  let prevBlank = false;
  let k = startIndex;

  while (k < lines.length) {
    const ln = lines[k]!;
    if (isBlank(ln)) {
      prevBlank = true;
      k++;
      continue;
    }
    if (!isOptionLine(ln, optionsPhase, prevBlank)) {
      prevBlank = false;
      k++;
      continue;
    }
    optionsPhase = true;
    prevBlank = false;

    let piece = cleanOptionText(ln);
    let t = k + 1;
    if (!piece.trim()) {
      while (t < lines.length) {
        const cont = lines[t]!;
        if (isBlank(cont)) {
          t++;
          continue;
        }
        if (isNewOptionHeaderLine(cont)) break;
        const cs = cleanLine(htmlToPlainText(cont));
        if (ANSWER_HEADING_LINE.test(cs)) break;
        if (/^Question\s*:/i.test(cs)) break;
        piece = piece ? `${piece} ${cs.trim()}` : cs.trim();
        t++;
      }
    }

    k = t;
    const trimmed = piece.trim();
    if (trimmed) out.push(trimmed);
    if (out.length >= 4) break;
  }

  return out;
}

export function normalizeAnswerAgainstOptions(answer: string, options: string[]): string {
  if (answer == null || answer === "") return "";
  let a = removeDetailsFragments(String(answer));
  a = htmlToPlainText(a).trim();
  a = a.replace(/^Answer\s*:\s*/i, "").trim();
  a = a.replace(/^Option\s+(?:\d+|[A-Za-z])\s*:\s*/i, "").trim();

  const opts = (options || []).map((o) => String(o || "").trim()).filter(Boolean);
  if (!a) return "";

  const exact = opts.find((o) => o === a);
  if (exact) return exact;
  const loose = opts.find((o) => o.toLowerCase() === a.toLowerCase());
  if (loose) return loose;

  const letter = a.match(/^([A-Da-d])[\).\s:]\s*(.*)$/);
  if (letter) {
    const idx = letter[1]!.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
    const rest = (letter[2] || "").trim();
    if (idx >= 0 && idx < opts.length) {
      if (
        !rest ||
        opts[idx]!.toLowerCase() === rest.toLowerCase() ||
        opts[idx]!.toLowerCase().startsWith(rest.toLowerCase())
      ) {
        return opts[idx]!;
      }
    }
  }

  const num = a.match(/^(\d)[\).\s:]\s*(.*)$/);
  if (num) {
    const idx = parseInt(num[1]!, 10) - 1;
    const rest = (num[2] || "").trim();
    if (idx >= 0 && idx < opts.length) {
      if (
        !rest ||
        opts[idx]!.toLowerCase() === rest.toLowerCase() ||
        opts[idx]!.toLowerCase().startsWith(rest.toLowerCase())
      ) {
        return opts[idx]!;
      }
    }
  }

  const byContains = opts.find(
    (o) => (a.length >= 3 && o.includes(a)) || (a.length >= 3 && a.includes(o))
  );
  if (byContains) return byContains;

  return a;
}

/** Pad / clamp to exactly four MCQ slots (LetsRevise page checkpoint contract). */
export function padCheckpointOptions(opts: string[]): [string, string, string, string] {
  const a = [...opts.map((x) => String(x ?? "").trim())];
  while (a.length < 4) a.push("");
  const s = a.slice(0, 4);
  return [s[0] ?? "", s[1] ?? "", s[2] ?? "", s[3] ?? ""];
}

/**
 * Coerce persisted/imported/options values into exactly four trimmed strings.
 * Guards against malformed objects (e.g. numeric keys), non-array values, or mixed types.
 */
export function coerceLessonMcqOptionsFour(input: unknown): [string, string, string, string] {
  if (Array.isArray(input)) {
    return padCheckpointOptions(
      input.map((x) => (x == null ? "" : typeof x === "string" ? x : String(x))),
    );
  }
  if (input !== null && typeof input === "object") {
    const o = input as Record<string, unknown>;
    const row = [0, 1, 2, 3].map((i) => {
      const v = o[i] ?? o[String(i)];
      return v == null ? "" : typeof v === "string" ? v : String(v);
    });
    return padCheckpointOptions(row);
  }
  return padCheckpointOptions([]);
}

/**
 * Parses plain / minimal-HTML pasted checkpoint body (after optional headings stripped).
 */
function parseCheckpointFlexibleBody(sectionText: string): {
  question: string;
  options: string[];
  answer: string;
  explanationTailLines: string[];
  difficultyTier?: CheckpointDifficultyTier;
} {
  const { strippedSection, combinedDetailsAnswer } =
    extractDetailsAnswersAndStripHtml(sectionText);
  const rawLines = strippedSection.split("\n").map((l) => l.replace(/\r/g, ""));
  const linesPlain = rawLines.map((l) => htmlToPlainText(l));

  const answerIdx = rawLines.findIndex((l) => ANSWER_HEADING_LINE.test(cleanLine(htmlToPlainText(l))));
  let bodyLines =
    answerIdx >= 0
      ? linesPlain.slice(0, answerIdx)
      : [...linesPlain];

  const { difficultyTier, bodyLines: bodySansDifficulty } = extractDifficultyFromBodyLines(
    bodyLines.map((ln) => String(ln ?? ""))
  );
  bodyLines = bodySansDifficulty;

  let explanationLines: string[] = [];
  let rawAnswer = "";

  if (answerIdx >= 0) {
    const firstAns = linesPlain[answerIdx]!.replace(ANSWER_HEADING_LINE, "").trim();
    let i = answerIdx + 1;

    /** Multi-line Answer: continuation until Explanation / next section */
    const ansParts = firstAns ? [firstAns] : [];
    for (; i < linesPlain.length; i++) {
      const pl = linesPlain[i]!;
      const tr = pl.trim();
      if (!tr) continue;
      if (EXPL_HEADING_LINE.test(tr)) break;
      if (/^⚡\s*CHECKPOINT/i.test(tr) || QUICK_CHECK_HEADING_LINE.test(tr)) break;
      if (/^Question\s*:/i.test(tr)) break;
      if (isDifficultyLine(pl)) break;
      if (/^Option\s+\d+\s*:/i.test(tr)) break;
      if (ANSWER_HEADING_LINE.test(pl)) break;
      ansParts.push(pl);
    }
    rawAnswer = ansParts.join(" ").trim();

    if (i < linesPlain.length && EXPL_HEADING_LINE.test(linesPlain[i]!.trim())) {
      const hdr = rawLines[i] ?? linesPlain[i]!;
      const firstExpl = hdr.replace(EXPL_HEADING_LINE, "").trim();
      explanationLines.push(firstExpl);
      i++;
      for (; i < linesPlain.length; i++) {
        const pl = linesPlain[i]!;
        const tr = pl.trim();
        if (!tr) {
          explanationLines.push("");
          continue;
        }
        if (/^⚡\s*CHECKPOINT/i.test(tr) || QUICK_CHECK_HEADING_LINE.test(tr)) break;
        if (/^Question\s*:/i.test(tr)) break;
        explanationLines.push(linesPlain[i]!);
      }
    }
    while (explanationLines.length && !explanationLines[explanationLines.length - 1]?.trim())
      explanationLines.pop();
  }

  const qi = bodyLines.findIndex((l) => /^Question\s*:/i.test(cleanLine(String(l))));
  let question = "";
  let optionScanFrom = 0;

  if (qi >= 0) {
    const qParts = [bodyLines[qi]!.replace(/^Question\s*:/i, "").trim()].filter(Boolean);
    let kk = qi + 1;
    optionScanFrom = bodyLines.length;
    for (; kk < bodyLines.length; kk++) {
      const ln = bodyLines[kk]!;
      if (!isBlank(ln) && isOptionLine(ln, false, false)) {
        optionScanFrom = kk;
        break;
      }
      if (!isBlank(ln)) qParts.push(ln.trim());
    }
    question = qParts.join(" ").trim();
  } else {
    /** `Question` on its own line (no colon), next line begins stem */
    const qBare = bodyLines.findIndex((l) => /^Question\s*$/i.test(cleanLine(String(l))));
    if (qBare >= 0) {
      let qq = "";
      let kk = qBare + 1;
      optionScanFrom = bodyLines.length;
      for (; kk < bodyLines.length; kk++) {
        const ln = bodyLines[kk]!;
        if (!isBlank(ln) && isOptionLine(ln, false, false)) {
          optionScanFrom = kk;
          break;
        }
        if (!isBlank(ln)) qq = qq ? `${qq} ${ln.trim()}` : ln.trim();
      }
      question = qq.trim();
    }
  }

  let options = extractOptions(bodyLines.map((ln) => String(ln ?? "")), optionScanFrom);
  if (options.length === 0 && qi < 0) {
    options = extractOptions(bodyLines.map((ln) => String(ln ?? "")), 0);
  }
  if (options.length === 0 && qi >= 0) {
    options = extractOptions(bodyLines.map((ln) => String(ln ?? "")), qi + 1);
  }

  if (!question.trim() && qi < 0 && options.length > 0) {
    const firstOpt = bodyLines.findIndex((ln) => !isBlank(ln) && isOptionLine(ln, false, false));
    if (firstOpt > 0) {
      question = bodyLines
        .slice(0, firstOpt)
        .filter((ln) => !isBlank(ln))
        .join(" ")
        .trim();
    }
  }

  let answer = "";
  if (answerIdx >= 0) {
    answer = htmlToPlainText(removeDetailsFragments(rawAnswer)).trim();
  } else if (combinedDetailsAnswer.trim()) {
    answer = combinedDetailsAnswer.trim();
  }

  answer = normalizeAnswerAgainstOptions(answer, options);

  return {
    question: question.trim(),
    options,
    answer: answer.trim(),
    explanationTailLines: explanationLines,
    ...(difficultyTier ? { difficultyTier } : {}),
  };
}

/** Mark scheme lines to persist when saving a parsed MCQ paste (includes `@lr-difficulty:*`). */
export function markSchemeFromFlexibleCheckpointParse(parsed: {
  markScheme?: string[];
  difficultyTier?: CheckpointDifficultyTier;
}): string[] | undefined {
  if (parsed.markScheme?.length) return [...parsed.markScheme];
  return applyDifficultyToMarkScheme(undefined, parsed.difficultyTier);
}

function joinExplanation(parts: string[]): string {
  return parts.map((x) => htmlToPlainText(String(x ?? ""))).join("\n").trim();
}

/**
 * Attempts full-section parse including optional ⚡ CHECKPOINT / QUICK CHECK / SS1 preambles.
 */
export function tryParseFlexibleCheckpointMcq(rawInput: string): {
  prompt: string;
  options: [string, string, string, string];
  correctAnswer: string;
  explanation: string;
  difficultyTier?: CheckpointDifficultyTier;
  markScheme?: string[];
} | null {
  let normalized = sanitizeCheckpointMcqPasteText(String(rawInput || ""));
  normalized = normalizeFlexibleCheckpointPasteText(normalized);
  const fromHtml = convertLegacyHtmlCheckpointExportToCanonicalPlain(normalized);
  if (fromHtml) normalized = fromHtml;
  if (!normalized.trim()) return null;

  const looseLines = normalized.split(/\n/).map((l) => String(l ?? ""));
  let cursor = stripLeadingSs1PastePreamble(looseLines, 0);
  cursor = stripOptionalCheckpointTitles(looseLines, cursor);

  const sectionTail = looseLines.slice(cursor).join("\n");
  /** Also try whole text if preamble strip removed nothing useful */
  const primary = parseCheckpointFlexibleBody(sectionTail);
  const fallback =
    sectionTail.trim() !== normalized.trim()
      ? parseCheckpointFlexibleBody(normalized.trim())
      : null;

  const pick =
    primary.options.filter(Boolean).length >= 2 && primary.answer && primary.question
      ? primary
      : fallback &&
          fallback.options.filter(Boolean).length >= 2 &&
          fallback.answer &&
          fallback.question
        ? fallback
        : primary.question && primary.options.filter(Boolean).length >= 2 && primary.answer
          ? primary
          : null;

  if (!pick || pick.options.filter(Boolean).length < 2 || !pick.question.trim()) {
    /** Last resort: original strict SS1 "Question:\n...\nOption 1:" paste only */
    return null;
  }

  /** Require non-empty keyed answer unless we inferred from letter (already in pick.answer string) */
  if (!pick.answer.trim()) return null;

  const padded = padCheckpointOptions(pick.options);
  const alignedAnswer = normalizeAnswerAgainstOptions(pick.answer, [...padded]);
  const explanation = joinExplanation(pick.explanationTailLines);
  const markScheme = applyDifficultyToMarkScheme(undefined, pick.difficultyTier);

  return {
    prompt: pick.question.trim(),
    options: padded,
    correctAnswer: alignedAnswer,
    explanation: explanation || "",
    ...(pick.difficultyTier ? { difficultyTier: pick.difficultyTier } : {}),
    ...(markScheme?.length ? { markScheme } : {}),
  };
}

/** Prefer structured checkpoint conversion only when paste replaces empty cell or selects all — avoids shredding mixed markdown. */
export function lessonCheckpointWholeCellPaste(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number,
  before: string,
  after: string,
): boolean {
  const emptySides = before.trim() === "" && after.trim() === "";
  const fullSelection = start === 0 && end === textarea.value.length;
  return emptySides || fullSelection;
}
