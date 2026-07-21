function escapeHtml(s = ""): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripHtmlToPlain(content = ""): string {
  return String(content || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function detailsInnerText(detailsHtml = ""): string {
  return stripHtmlToPlain(
    String(detailsHtml).replace(/<summary>[\s\S]*?<\/summary>/gi, "")
  ).trim();
}

function parseMarkSchemeBullets(text = ""): string[] {
  return String(text || "")
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s+/, "").trim())
    .filter(Boolean);
}

function extractDetailsBlocks(html: string): string[] {
  const blocks: string[] = [];
  const re = /<details>[\s\S]*?<\/details>/gi;
  let match = re.exec(html);
  while (match !== null) {
    blocks.push(match[0]);
    match = re.exec(html);
  }
  return blocks;
}

function extractMarkSchemeBulletsFromHtml(rawAfterQ5 = ""): string[] {
  const ulMatch = rawAfterQ5.match(
    /<h3><strong>Mark scheme:<\/strong><\/h3>\s*<ul>([\s\S]*?)<\/ul>/i
  );
  if (!ulMatch) return [];

  const bullets: string[] = [];
  const re = /<li>([\s\S]*?)<\/li>/gi;
  let match = re.exec(ulMatch[1]);
  while (match !== null) {
    const text = stripHtmlToPlain(match[1]).trim();
    if (text) bullets.push(text);
    match = re.exec(ulMatch[1]);
  }
  return bullets;
}

const MARK_SCHEME_BLOCK_RE =
  /<h3>\s*<strong>\s*Mark scheme:\s*<\/strong>\s*<\/h3>\s*<ul>[\s\S]*?<\/ul>/gi;

/**
 * Move open Mark scheme sections inside the Reveal Model Answer <details>,
 * so students only see them after clicking reveal.
 */
export function concealOpenExamPracticeMarkSchemes(content = ""): string {
  let html = String(content || "");
  if (!html.trim()) return html;

  // Pair each open mark-scheme block with the following Reveal details opener.
  html = html.replace(
    /(<h3>\s*<strong>\s*Mark scheme:\s*<\/strong>\s*<\/h3>\s*<ul>[\s\S]*?<\/ul>)\s*(<details>\s*<summary>\s*Reveal Model Answer\s*<\/summary>)/gi,
    "$2\n$1\n"
  );

  // Wrap any remaining open mark schemes that are still outside <details>.
  html = html.replace(MARK_SCHEME_BLOCK_RE, (markSchemeHtml, offset: number) => {
    const before = html.slice(0, offset);
    const openCount = (before.match(/<details\b/gi) || []).length;
    const closeCount = (before.match(/<\/details>/gi) || []).length;
    if (openCount > closeCount) return markSchemeHtml;
    return `<details>\n<summary>Reveal Model Answer</summary>\n${markSchemeHtml}\n</details>`;
  });

  return html;
}

export function extractQ5ModelDetailsBlock(raw = "", rawQ5Idx = -1): string {
  if (rawQ5Idx < 0) return "";
  const rawAfterQ5 = raw.slice(rawQ5Idx);
  const introPart = raw.slice(0, rawQ5Idx);
  const introMatch = introPart.match(/<details>[\s\S]*?<\/details>/i);
  const firstIntroAnswer = detailsInnerText(introMatch ? introMatch[0] : "");

  const sectionDetails = extractDetailsBlocks(rawAfterQ5);

  for (let i = sectionDetails.length - 1; i >= 0; i--) {
    const body = detailsInnerText(sectionDetails[i]);
    if (body && (!firstIntroAnswer || body !== firstIntroAnswer)) {
      return sectionDetails[i];
    }
  }

  if (sectionDetails.length) return sectionDetails[sectionDetails.length - 1];

  const plain = stripHtmlToPlain(rawAfterQ5);
  const pm = plain.match(
    /(?:Reveal Model Answer|Model Answer)\s*:?\s*([\s\S]*?)(?=Examiner tip:|$)/i
  );
  if (pm && pm[1] && pm[1].trim().length > 20) {
    return `<details>\n<summary>Reveal Model Answer</summary>\n${pm[1].trim()}\n</details>`;
  }
  return "";
}

function parseQ5Question(raw = "", rawQ5Idx = -1, plainQ5Section = ""): string {
  const rawAfterQ5 = rawQ5Idx >= 0 ? raw.slice(rawQ5Idx) : raw;
  const formattedQ = rawAfterQ5.match(
    /<p><strong>Q5\s*\(\s*6\s*marks?\)\s*:?<\/strong><\/p>\s*<p>([\s\S]*?)<\/p>/i
  );
  if (formattedQ) return stripHtmlToPlain(formattedQ[1]).trim();

  const headerMatch = plainQ5Section.match(/^Q5\s*\(\s*6\s*marks?\)\s*:?\s*([\s\S]*)$/i);
  let question = headerMatch ? headerMatch[1].trim() : "";
  return question.replace(/\s*\[\s*6\s*\]\s*$/i, "").trim();
}

function detailsBodyFromBlock(detailsHtml = ""): string {
  return String(detailsHtml || "")
    .replace(/^[\s\S]*?<summary>[\s\S]*?<\/summary>/i, "")
    .replace(/<\/details>\s*$/i, "")
    .trim();
}

/** Preserve Q5 structure and correct model-answer binding on import. */
export function formatExamPracticeContentForImport(content = ""): string {
  const raw = String(content || "").trim();
  if (!raw) return raw;

  const rawQ5Idx = raw.search(/Q5\s*\(\s*6\s*marks?\)/i);
  if (rawQ5Idx < 0) {
    // Non-Q5 exam practice (e.g. synthesised Q1/Q2 banks): still conceal open mark schemes.
    return concealOpenExamPracticeMarkSchemes(raw);
  }

  const introHtml = rawQ5Idx > 0 ? raw.slice(0, rawQ5Idx).trim() : "";
  const rawAfterQ5 = raw.slice(rawQ5Idx);
  const q5ModelDetails = extractQ5ModelDetailsBlock(raw, rawQ5Idx);

  const plain = stripHtmlToPlain(raw);
  const q5Idx = plain.search(/Q5\s*\(\s*6\s*marks?\)/i);
  const q5Section = plain.slice(q5Idx).trim();

  const msSplit = q5Section.split(/\n?\s*Mark scheme:\s*\n?/i);
  const afterMs = msSplit.slice(1).join("\n") || "";
  const detailsIdx = afterMs.search(/Reveal Model Answer|Examiner tip:/i);
  const msText = detailsIdx >= 0 ? afterMs.slice(0, detailsIdx) : afterMs;

  const question = parseQ5Question(raw, rawQ5Idx, msSplit[0] || "");
  const htmlBullets = extractMarkSchemeBulletsFromHtml(rawAfterQ5);
  const bullets = htmlBullets.length > 0 ? htmlBullets : parseMarkSchemeBullets(msText);

  const examinerTip = afterMs.match(/Examiner tip:\s*([\s\S]*)$/i);
  const modelBody = detailsBodyFromBlock(q5ModelDetails);

  const parts: string[] = [];
  if (introHtml) parts.push(concealOpenExamPracticeMarkSchemes(introHtml));
  parts.push("<p><strong>Q5 (6 marks):</strong></p>");
  if (question) parts.push(`<p>${escapeHtml(question)}</p>`);
  if (bullets.length || modelBody) {
    parts.push("<details>");
    parts.push("<summary>Reveal Model Answer</summary>");
    if (bullets.length) {
      parts.push("<h3><strong>Mark scheme:</strong></h3>");
      parts.push(`<ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`);
    }
    if (modelBody) parts.push(modelBody);
    parts.push("</details>");
  } else if (examinerTip && examinerTip[1] && examinerTip[1].trim()) {
    parts.push(`<p><strong>Examiner tip:</strong> ${escapeHtml(examinerTip[1].trim())}</p>`);
  }

  return parts.join("\n");
}
