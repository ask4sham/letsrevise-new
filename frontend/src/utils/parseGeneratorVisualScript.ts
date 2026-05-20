/**
 * Parse generator script (Instruction / Labels / Hotspots / Answer key, Step N) from
 * interactive diagram and step-by-step block intro/content fields.
 */

import { mergeLessonBlockIntroFields } from "./lessonRichText";
import { htmlToPlainText } from "./parseFlexibleCheckpointPaste";

export type GeneratorHotspotSpec = {
  label: string;
  description: string;
};

export type GeneratorSequenceStepSpec = {
  title: string;
  description: string;
};

function cleanLine(line: string): string {
  return String(line || "").replace(/\r/g, "").trim();
}

function isBlank(line: string): boolean {
  return cleanLine(line) === "";
}

function isBullet(line: string): boolean {
  return /^[-•*]\s+/.test(cleanLine(line));
}

function stripBullet(line: string): string {
  return cleanLine(line).replace(/^[-•*]\s+/, "").trim();
}

function splitContentLines(text: string): string[] {
  return String(text ?? "")
    .split(/\n/)
    .map((l) => l.trimEnd());
}

function parseArrowPair(line: string): { left: string; right: string } | null {
  const s = cleanLine(line);
  if (!/\s*[→:=]\s*|->/.test(s)) return null;
  const parts = s.split(/\s*[→:=]\s*|->/).map((x) => x.trim());
  if (!parts[0]) return null;
  return { left: parts[0], right: parts.slice(1).join(" ").trim() };
}

const PENDING_DIAGRAM_BANNER =
  /<p>\s*<strong>\s*Interactive diagram\s*<\/strong>\s*<\/p>\s*<p>\s*Diagram image is not available yet[\s\S]*?<\/p>/gi;

/** Strip export-only “pending image” banner before parsing labels / steps. */
export function stripGeneratorPendingVisualBanner(html: string): string {
  return String(html ?? "")
    .replace(PENDING_DIAGRAM_BANNER, "")
    .trim();
}

function mergeGeneratorScriptFields(intro?: string, content?: string): string {
  return stripGeneratorPendingVisualBanner(
    mergeLessonBlockIntroFields(intro ?? "", content ?? "")
  );
}

export function parseGeneratorInteractiveDiagramScript(
  intro?: string,
  content?: string
): {
  instruction: string;
  labels: string[];
  hotspotLines: string[];
  answerKey: string[];
} {
  const text = htmlToPlainText(mergeGeneratorScriptFields(intro, content));
  const lines = splitContentLines(text);

  const instruction: string[] = [];
  const labels: string[] = [];
  const hotspotLines: string[] = [];
  const answerKey: string[] = [];
  let mode: "instruction" | "labels" | "hotspots" | "answer-key" = "instruction";

  for (const line of lines) {
    if (isBlank(line)) continue;

    if (/^Instruction:/i.test(line)) {
      mode = "instruction";
      const value = line.replace(/^Instruction:/i, "").trim();
      if (value) instruction.push(value);
      continue;
    }

    if (/^Labels(?:\s+to\s+use)?:/i.test(line)) {
      mode = "labels";
      continue;
    }

    if (/^Hotspots(?:\s*\/\s*parts)?:/i.test(line)) {
      mode = "hotspots";
      continue;
    }

    if (/^Answer key:/i.test(line) || /^Reveal:/i.test(line)) {
      mode = "answer-key";
      continue;
    }

    if (mode === "labels" && isBullet(line)) {
      labels.push(stripBullet(line));
    } else if (mode === "hotspots" && isBullet(line)) {
      hotspotLines.push(stripBullet(line));
    } else if (mode === "answer-key" && isBullet(line)) {
      answerKey.push(stripBullet(line));
    } else if (mode === "instruction") {
      instruction.push(line);
    }
  }

  if (answerKey.length === 0) {
    for (const line of lines) {
      const pair = parseArrowPair(line);
      if (pair) answerKey.push(`${pair.left} → ${pair.right}`);
    }
  }

  return {
    instruction: instruction.join("\n").trim(),
    labels,
    hotspotLines,
    answerKey,
  };
}

/** Build hotspot label + explanation list (mirrors generator `buildInteractiveDiagramPayload`). */
export function buildHotspotsFromGeneratorScript(
  intro?: string,
  content?: string
): GeneratorHotspotSpec[] {
  const { labels, hotspotLines, answerKey } = parseGeneratorInteractiveDiagramScript(intro, content);
  const n = Math.max(labels.length, hotspotLines.length, answerKey.length, 0);
  if (n === 0) return [];

  const hotspots: GeneratorHotspotSpec[] = [];
  for (let idx = 0; idx < n; idx++) {
    let label = labels[idx]?.trim() ?? "";
    const akLine = answerKey[idx] != null ? parseArrowPair(answerKey[idx]) : null;
    if (!label && akLine?.right) {
      label = akLine.right.trim();
    }
    if (!label && akLine?.left) {
      const letter = akLine.left.replace(/[^\w]/g, "").charAt(0);
      label = letter ? `Part ${letter.toUpperCase()}` : `Part ${idx + 1}`;
    }
    const spotPlain = hotspotLines[idx] != null ? parseArrowPair(hotspotLines[idx]) : null;
    if (!label && spotPlain?.left) {
      label =
        spotPlain.right && !/^[_\s]+$/.test(spotPlain.right)
          ? spotPlain.right.trim()
          : `Part ${spotPlain.left}`;
    }
    if (!label) label = `Part ${idx + 1}`;

    const fromLabel = labels[idx]?.trim() ?? "";
    const fromSpot =
      spotPlain?.right && !/^[_\s]+$/.test(spotPlain.right) ? spotPlain.right.trim() : "";
    const fromAk = akLine?.right?.trim() ?? "";
    const description = fromLabel || fromSpot || fromAk || label;

    hotspots.push({ label, description });
  }
  return hotspots;
}

function normHotspotLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Next hotspot from generator script not yet present on the block (for “+ Add hotspot”). */
export function nextHotspotFromGeneratorScript(
  intro: string | undefined,
  content: string | undefined,
  existing: Array<{ label?: string }>
): GeneratorHotspotSpec | null {
  const pending = buildHotspotsFromGeneratorScript(intro, content);
  const used = new Set(
    existing.map((h) => normHotspotLabel(String(h.label ?? ""))).filter(Boolean)
  );
  for (const spec of pending) {
    const key = normHotspotLabel(spec.label);
    if (key && !used.has(key)) return spec;
  }
  return null;
}

function normalizeStepLine(line: string): string {
  let s = stripBullet(cleanLine(line));
  s = s.replace(/\*\*/g, "").trim();
  return s;
}

function parseStepHeadingLine(line: string): { body: string } | null {
  const s = normalizeStepLine(line);
  if (!s) return null;
  const stepColon = s.match(/^Step\s+\d+\s*:\s*(.*)$/i);
  const stepDash = s.match(/^Step\s+\d+\s*[—–\-]\s*(.*)$/i);
  const stepMatch = stepColon ?? stepDash;
  if (!stepMatch) return null;
  return { body: (stepMatch[1] ?? "").trim() };
}

/** Scan full text for `Step N — body` when line-by-line parsing finds nothing. */
function parseStepsFromTextBlob(text: string): string[] {
  const steps: string[] = [];
  const re =
    /(?:^|[\n\r])\s*(?:[-•*]\s*)?Step\s+(\d+)\s*(?:[—–\-:])\s*([\s\S]*?)(?=(?:[\n\r]\s*(?:[-•*]\s*)?Step\s+\d+\s*(?:[—–\-:]))|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const body = String(m[2] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (body) steps.push(body);
  }
  return steps;
}

function parseStepsFromHtmlLists(html: string): string[] {
  const steps: string[] = [];
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = liRe.exec(html)) !== null) {
    const plain = htmlToPlainText(m[1] ?? "");
    const parsed = parseStepHeadingLine(plain);
    if (parsed?.body) steps.push(parsed.body);
  }
  return steps;
}

export function parseGeneratorSequenceScript(
  intro?: string,
  content?: string
): { steps: string[]; examLink: string } {
  const mergedHtml = mergeGeneratorScriptFields(intro, content);
  const fromHtml = parseStepsFromHtmlLists(mergedHtml);
  if (fromHtml.length > 0) {
    return { steps: fromHtml, examLink: "" };
  }

  const text = htmlToPlainText(mergedHtml);
  const lines = splitContentLines(text);
  const steps: string[] = [];
  let examLink = "";
  let collectingExamLink = false;

  for (const line of lines) {
    if (isBlank(line) || line === "↓") continue;

    const stepParsed = parseStepHeadingLine(line);
    if (stepParsed) {
      steps.push(stepParsed.body);
      collectingExamLink = false;
      continue;
    }

    if (/^Exam link:/i.test(normalizeStepLine(line))) {
      collectingExamLink = true;
      examLink = normalizeStepLine(line).replace(/^Exam link:/i, "").trim();
      continue;
    }

    if (collectingExamLink) {
      examLink += examLink ? ` ${line}` : line;
    } else if (steps.length > 0) {
      steps[steps.length - 1] += ` ${line}`;
    }
  }

  if (steps.length === 0) {
    const blobSteps = parseStepsFromTextBlob(text);
    if (blobSteps.length > 0) {
      return { steps: blobSteps, examLink };
    }
  }

  return { steps, examLink };
}

export function buildSequenceStepsFromGeneratorScript(
  intro?: string,
  content?: string
): GeneratorSequenceStepSpec[] {
  const { steps } = parseGeneratorSequenceScript(intro, content);
  return steps.map((body, idx) => ({
    title: `Step ${idx + 1}`,
    description: body.trim(),
  }));
}

function normStepTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Next step from generator script not yet on the block (for “+ Add step”). */
export function nextSequenceStepFromGeneratorScript(
  intro: string | undefined,
  content: string | undefined,
  existing: Array<{ title?: string; description?: string }>
): GeneratorSequenceStepSpec | null {
  const pending = buildSequenceStepsFromGeneratorScript(intro, content);
  const usedTitles = new Set(
    existing.map((s) => normStepTitle(String(s.title ?? ""))).filter(Boolean)
  );
  const usedBodies = new Set(
    existing
      .map((s) => String(s.description ?? "").trim().toLowerCase())
      .filter(Boolean)
  );
  for (const spec of pending) {
    const titleKey = normStepTitle(spec.title);
    const bodyKey = spec.description.trim().toLowerCase();
    if (titleKey && usedTitles.has(titleKey)) continue;
    if (bodyKey && usedBodies.has(bodyKey)) continue;
    return spec;
  }
  return null;
}

export type InteractiveSequenceStepEditorRow = {
  id?: string;
  title: string;
  description: string;
  imageUrl: string;
  caption: string;
  testExplanation?: string;
};

function mapRawSequenceStepRow(
  s: {
    id?: unknown;
    title?: unknown;
    description?: unknown;
    imageUrl?: unknown;
    caption?: unknown;
    testExplanation?: unknown;
  },
  i: number
): InteractiveSequenceStepEditorRow {
  const te =
    typeof s.testExplanation === "string" ? String(s.testExplanation).trim() : "";
  return {
    ...(typeof s.id === "string" && String(s.id).trim()
      ? { id: String(s.id).trim().slice(0, 64) }
      : {}),
    title: String(s.title ?? `Step ${i + 1}`).trim(),
    description: String(s.description ?? "").trim(),
    imageUrl: s.imageUrl != null ? String(s.imageUrl).trim() : "",
    caption: s.caption != null ? String(s.caption).trim() : "",
    ...(te ? { testExplanation: te } : {}),
  };
}

/** True when there are no steps, or every step row is completely empty. */
export function interactiveSequenceStepsNeedHydration(
  steps: Array<{
    title?: string;
    description?: string;
    imageUrl?: string;
    caption?: string;
    testExplanation?: string;
  }>
): boolean {
  if (!steps.length) return true;
  return steps.every(
    (s) =>
      !String(s.title ?? "").trim() &&
      !String(s.description ?? "").trim() &&
      !String(s.imageUrl ?? "").trim() &&
      !String(s.caption ?? "").trim() &&
      !String(s.testExplanation ?? "").trim()
  );
}

/**
 * Ensure `sequenceSteps[]` is populated for the editor from intro/content script when
 * export/import left steps only in HTML fields.
 */
export function hydrateInteractiveSequenceStepsForEditor(
  intro?: string,
  content?: string,
  rawSteps?: unknown[]
): InteractiveSequenceStepEditorRow[] {
  const existing = (Array.isArray(rawSteps) ? rawSteps : [])
    .filter((s) => s && typeof s === "object")
    .map((s, i) => mapRawSequenceStepRow(s as Record<string, unknown>, i));

  const fromScript = buildSequenceStepsFromGeneratorScript(intro, content);

  if (!interactiveSequenceStepsNeedHydration(existing)) {
    if (!fromScript.length) return existing;
    return existing.map((row, i) => {
      const scriptRow = fromScript[i];
      const description =
        row.description.trim() ||
        scriptRow?.description?.trim() ||
        "";
      const title =
        row.title.trim() ||
        scriptRow?.title?.trim() ||
        `Step ${i + 1}`;
      return {
        ...row,
        title,
        description,
      };
    });
  }

  if (!fromScript.length) {
    return existing;
  }

  return fromScript.map((spec, i) => ({
    id: existing[i]?.id ?? `seq_hydrate_${i + 1}`,
    title: spec.title,
    description: spec.description,
    imageUrl: existing[i]?.imageUrl ?? "",
    caption: existing[i]?.caption ?? "",
    ...(existing[i]?.testExplanation ? { testExplanation: existing[i]!.testExplanation } : {}),
  }));
}
