/**
 * Required Practical V2.2 — parse specialist block content for visible rendering.
 */

const SPECIALIST_TITLE_PATTERNS = {
  equipment: /^equipment$/i,
  method: /^method$/i,
  resultsTable: /^results?\s*table$/i,
  evaluationGrid: /^evaluation\s*grid$/i,
};

const SPECIALIST_ROLE_MAP = {
  equipment: "equipment",
  method: "method",
  resultstable: "resultsTable",
  evaluationgrid: "evaluationGrid",
};

function detectRpSpecialistBlock(block = {}) {
  const role = String(block.role || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  if (role && SPECIALIST_ROLE_MAP[role]) {
    return SPECIALIST_ROLE_MAP[role];
  }
  const title = String(block.title || "").trim();
  for (const [kind, re] of Object.entries(SPECIALIST_TITLE_PATTERNS)) {
    if (re.test(title)) return kind;
  }
  return null;
}

function stripHtml(text) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parseEquipmentItems(content) {
  const plain = stripHtml(content);
  const lines = plain
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^equipment\s*(list)?/i.test(l) && !/^mandatory/i.test(l) && !/\*\*equipment/i.test(l));
  const items = [];
  for (const line of lines) {
    const m = line.match(/^[-*•]\s+(.+)$/) || line.match(/^\d+[\.)]\s+(.+)$/);
    if (m) items.push(m[1].trim());
    else if (line.length > 1 && !line.startsWith("|"))
      items.push(line.replace(/^\*\*|\*\*$/g, "").trim());
  }
  return items.filter(Boolean);
}

function parseMethodSteps(content) {
  const plain = stripHtml(content);
  const lines = plain
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^method/i.test(l) && !/^numbered steps/i.test(l));
  const steps = [];
  for (const line of lines) {
    const m = line.match(/^\d+[\.)]\s+(.+)$/) || line.match(/^👉\s*\d+[\.)]?\s*(.+)$/);
    if (m) steps.push(m[1].trim());
    else if (line.match(/^[-*•]\s+/)) steps.push(line.replace(/^[-*•]\s+/, "").trim());
    else if (!line.startsWith("|") && line.length > 4) steps.push(line.replace(/^👉\s*/, "").trim());
  }
  return steps.filter(Boolean);
}

function parseMarkdownTable(content) {
  const plain = stripHtml(content);
  const tableLines = plain
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|"));
  if (tableLines.length < 2) return null;

  const parseRow = (line) =>
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

function defaultSectionTitle(kind) {
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

module.exports = {
  detectRpSpecialistBlock,
  parseEquipmentItems,
  parseMethodSteps,
  parseMarkdownTable,
  defaultSectionTitle,
};
