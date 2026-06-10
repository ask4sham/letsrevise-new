/**
 * Required Practical V2.2 — parse specialist block content for visible rendering.
 *
 * Browser-safe copy of lib/teacherBrain/requiredPracticalBlockParse.js.
 * Duplicated here because Create React App forbids imports outside frontend/src.
 * Keep in sync with the backend shared parser; do not change RP behaviour here alone.
 */

export type RpSpecialistBlockKind = "equipment" | "method" | "resultsTable" | "evaluationGrid";

export type ParsedMarkdownTable = {
  headers: string[];
  rows: string[][];
};

const SPECIALIST_TITLE_PATTERNS: Record<RpSpecialistBlockKind, RegExp> = {
  equipment: /^equipment$/i,
  method: /^method$/i,
  resultsTable: /^results?\s*table$/i,
  evaluationGrid: /^evaluation\s*grid$/i,
};

const SPECIALIST_ROLE_MAP: Record<string, RpSpecialistBlockKind> = {
  equipment: "equipment",
  method: "method",
  resultstable: "resultsTable",
  evaluationgrid: "evaluationGrid",
};

type BlockLike = { role?: string; title?: string; content?: string };

export function detectRpSpecialistBlock(block: BlockLike = {}): RpSpecialistBlockKind | null {
  const role = String(block.role || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  if (role && SPECIALIST_ROLE_MAP[role]) {
    return SPECIALIST_ROLE_MAP[role];
  }
  const title = String(block.title || "").trim();
  for (const [kind, re] of Object.entries(SPECIALIST_TITLE_PATTERNS) as [RpSpecialistBlockKind, RegExp][]) {
    if (re.test(title)) return kind;
  }
  return null;
}

function stripHtml(text: string): string {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function parseEquipmentItems(content: string): string[] {
  const plain = stripHtml(content);
  const lines = plain
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^equipment\s*(list)?/i.test(l) && !/^mandatory/i.test(l) && !/\*\*equipment/i.test(l));
  const items: string[] = [];
  for (const line of lines) {
    const m = line.match(/^[-*•]\s+(.+)$/) || line.match(/^\d+[\.)]\s+(.+)$/);
    if (m) items.push(m[1].trim());
    else if (line.length > 1 && !line.startsWith("|"))
      items.push(line.replace(/^\*\*|\*\*$/g, "").trim());
  }
  return items.filter(Boolean);
}

export function parseMethodSteps(content: string): string[] {
  const plain = stripHtml(content);
  const lines = plain
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^method/i.test(l) && !/^numbered steps/i.test(l));
  const steps: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\d+[\.)]\s+(.+)$/) || line.match(/^👉\s*\d+[\.)]?\s*(.+)$/);
    if (m) steps.push(m[1].trim());
    else if (line.match(/^[-*•]\s+/)) steps.push(line.replace(/^[-*•]\s+/, "").trim());
    else if (!line.startsWith("|") && line.length > 4) steps.push(line.replace(/^👉\s*/, "").trim());
  }
  return steps.filter(Boolean);
}

export function parseMarkdownTable(content: string): ParsedMarkdownTable | null {
  const plain = stripHtml(content);
  const tableLines = plain
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|"));
  if (tableLines.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());

  const headers = parseRow(tableLines[0]);
  const dataStart = tableLines[1].replace(/[-\s|:]/g, "").length === 0 ? 2 : 1;
  const rows = tableLines.slice(dataStart).map(parseRow).filter((r) => r.some(Boolean));
  if (!headers.length || !rows.length) return null;
  return { headers, rows };
}

export function defaultSectionTitle(kind: RpSpecialistBlockKind | string): string {
  switch (kind) {
    case "equipment":
      return "Equipment";
    case "method":
      return "Method";
    case "resultsTable":
      return "Results Table";
    case "evaluationGrid":
      return "Evaluation Grid";
    default:
      return kind;
  }
}
