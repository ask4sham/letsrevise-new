/**
 * Spec Document Ingestion Service
 *
 * Turns official exam board specification documents into structured SpecStatements.
 * Source: uploaded files (txt, md, pdf) — no web scraping.
 *
 * Pipeline: extractRawSpecSections → normalizeSpecStatements → mapStatementsToTopics → saveSpecStatements
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const SpecStatement = require("../models/SpecStatement");
const { getTaxonomyBySpecKey } = require("../utils/topicTaxonomy");

const STATEMENT_TYPES = ["core", "required_practical", "maths_skill", "exam_skill", "other"];

/**
 * Extract text from file. Supports .txt, .md, .pdf.
 * @param {string} filePath - Absolute path to file
 * @returns {Promise<string>} Raw text
 */
async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${absPath}`);
  }

  if ([".txt", ".md", ".markdown"].includes(ext)) {
    return fs.promises.readFile(absPath, "utf8");
  }

  if (ext === ".pdf") {
    try {
      const pdfParse = require("pdf-parse");
      const dataBuffer = fs.readFileSync(absPath);
      const data = await pdfParse(dataBuffer);
      return data.text || "";
    } catch (err) {
      throw new Error(`PDF parsing failed: ${err.message}. Ensure pdf-parse is installed.`);
    }
  }

  throw new Error(`Unsupported file type: ${ext}. Use .txt, .md, or .pdf`);
}

/**
 * Extract raw sections (headings + content) from spec document text.
 * Handles markdown headings (##, ###) and plain-text section patterns.
 * @param {string} filePath - Path to file (for extension detection)
 * @param {string} text - Raw text content
 * @returns {Array<{ heading: string, level: number, content: string[], pageHint?: number }>}
 */
function extractRawSpecSections(filePath, text) {
  const sections = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  let currentHeading = "";
  let currentLevel = 0;
  let currentContent = [];
  let pageHint = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Page number hint (e.g. "Page 12" or "p.12")
    const pageMatch = line.match(/^(?:page|p\.?)\s*(\d+)/i);
    if (pageMatch && currentContent.length === 0) {
      pageHint = parseInt(pageMatch[1], 10);
      continue;
    }

    // Markdown heading
    const mdMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (mdMatch) {
      if (currentHeading || currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          level: currentLevel,
          content: currentContent.filter(Boolean),
          pageHint,
        });
      }
      currentLevel = mdMatch[1].length;
      currentHeading = mdMatch[2].trim();
      currentContent = [];
      pageHint = null;
      continue;
    }

    // Plain text section (ALL CAPS or numbered like "1.2.3")
    const capsMatch = line.match(/^([A-Z][A-Z\s\-]+)$/) && line.length > 3;
    const numMatch = line.match(/^\d+(\.\d+)*\.?\s+(.+)$/);
    if (capsMatch && line.length > 2) {
      if (currentHeading || currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          level: currentLevel,
          content: currentContent.filter(Boolean),
          pageHint,
        });
      }
      currentLevel = 2;
      currentHeading = line;
      currentContent = [];
      continue;
    }
    if (numMatch) {
      if (currentHeading || currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          level: currentLevel,
          content: currentContent.filter(Boolean),
          pageHint,
        });
      }
      currentLevel = 2;
      currentHeading = numMatch[2].trim() || numMatch[0];
      currentContent = [];
      continue;
    }

    // Bullet or statement line
    const bulletMatch = line.match(/^[\-\*•·]\s+(.+)$/);
    const numBulletMatch = line.match(/^\d+[\.\)]\s+(.+)$/);
    const trimmed = line.replace(/^[\-\*•·\d\.\)]\s*/, "").trim();

    if (bulletMatch || numBulletMatch) {
      if (trimmed.length > 10) currentContent.push(trimmed);
    } else if (trimmed.length > 15 && !trimmed.match(/^(page|p\.?)\s*\d+/i)) {
      currentContent.push(trimmed);
    }
  }

  if (currentHeading || currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      level: currentLevel,
      content: currentContent.filter(Boolean),
      pageHint,
    });
  }

  return sections;
}

/**
 * Normalize raw sections into candidate statements.
 * @param {Array} rawSections - From extractRawSpecSections
 * @param {string} specKey
 * @param {string} subject
 * @param {string} sourceDocumentName
 * @returns {Array<{ statementText, sourceSectionHeading, sourcePageNumber, statementType }>}
 */
function normalizeSpecStatements(rawSections, specKey, subject, sourceDocumentName) {
  const statements = [];
  for (const sec of rawSections) {
    const heading = (sec.heading || "").trim();
    const isRequiredPractical =
      /required\s+practical|rp\s*[:\-]|practical\s*[:\-]/i.test(heading) ||
      /required\s+practical|rp\s*[:\-]/i.test(sec.content.join(" "));
    const isMathsSkill = /maths\s*skill|mathematical\s*skill|MS\s*[:\-]/i.test(heading);
    const isExamSkill = /exam\s*skill|command\s*word|AO\d/i.test(heading);

    for (const text of sec.content) {
      const t = (text || "").trim();
      if (t.length < 10) continue;
      let st = "core";
      if (isRequiredPractical) st = "required_practical";
      else if (isMathsSkill) st = "maths_skill";
      else if (isExamSkill) st = "exam_skill";

      statements.push({
        statementText: t,
        sourceSectionHeading: heading || null,
        sourcePageNumber: sec.pageHint || null,
        statementType: st,
        sourceDocumentName,
      });
    }
  }
  return statements;
}

/**
 * Slug-normalize a string for matching.
 */
function slugify(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Map statements to leaf topicKeys using taxonomy.
 * Returns confidence: high | medium | low.
 * Only high-confidence mappings are auto-saved.
 */
function mapStatementsToTopics(statements, specKey) {
  const taxonomy = getTaxonomyBySpecKey(specKey);
  if (!taxonomy || !Array.isArray(taxonomy.units)) {
    return statements.map((s) => ({ ...s, topicKey: null, mainTopicKey: null, confidence: "low", reason: "Taxonomy not found" }));
  }

  const leafTopics = [];
  const unitKeyMap = new Map();
  for (const u of taxonomy.units) {
    const unitKey = slugify(u.unit || u.key || "");
    unitKeyMap.set(unitKey, u);
    for (const t of u.topics || []) {
      if (t.key) {
        leafTopics.push({
          topicKey: t.key,
          topicTitle: (t.topic || "").toLowerCase(),
          topicKeySlug: t.key,
          unitKey,
          unitTitle: (u.unit || "").toLowerCase(),
          mainTopicKey: unitKey,
        });
      }
    }
  }

  const mapped = [];
  for (const st of statements) {
    const heading = (st.sourceSectionHeading || "").toLowerCase();
    const headingSlug = slugify(st.sourceSectionHeading || "");
    const text = (st.statementText || "").toLowerCase();

    let best = null;
    let bestConfidence = "low";
    let reason = "No match";

    for (const lt of leafTopics) {
      const exactHeading = heading === lt.topicTitle || headingSlug === lt.topicKeySlug;
      const headingContains = heading.includes(lt.topicTitle) || heading.includes(lt.topicKeySlug.replace(/-/g, " "));
      const textContains = text.includes(lt.topicTitle) || text.includes(lt.topicKeySlug.replace(/-/g, " "));
      const unitMatch = headingSlug.includes(lt.unitKey) || heading.includes(lt.unitTitle);

      if (exactHeading) {
        best = lt;
        bestConfidence = "high";
        reason = "Exact heading match";
        break;
      }
      if (headingContains && !best) {
        best = lt;
        bestConfidence = "medium";
        reason = "Heading contains topic";
      }
      if (unitMatch && textContains && !best) {
        best = lt;
        bestConfidence = "medium";
        reason = "Unit + text match";
      }
      if (textContains && !best && bestConfidence === "low") {
        best = lt;
        bestConfidence = "low";
        reason = "Text contains topic keyword";
      }
    }

    if (best && bestConfidence === "high") {
      mapped.push({
        ...st,
        topicKey: best.topicKey,
        mainTopicKey: best.mainTopicKey,
        confidence: "high",
        reason,
      });
    } else if (best && bestConfidence === "medium") {
      mapped.push({
        ...st,
        topicKey: best.topicKey,
        mainTopicKey: best.mainTopicKey,
        confidence: "medium",
        reason,
      });
    } else {
      mapped.push({
        ...st,
        topicKey: null,
        mainTopicKey: null,
        confidence: best ? "low" : "low",
        reason: best ? reason : "No match",
      });
    }
  }

  return mapped;
}

/**
 * Generate canonical statement key for deduplication.
 */
function makeCanonicalKey(specKey, topicKey, statementText) {
  const raw = `${specKey}|${topicKey || "unmapped"}|${(statementText || "").trim()}`;
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 32);
}

/**
 * Save mapped statements. Only high-confidence are saved. Idempotent via canonicalStatementKey.
 */
async function saveSpecStatements(mappedStatements, options = {}) {
  const { dryRun = false, sourceDocumentName, sourceDocumentVersion, specKey, subject } = options;
  const taxonomy = getTaxonomyBySpecKey(specKey);
  const examBoard = taxonomy?.examBoard || "AQA";
  const level = taxonomy?.level || "GCSE";

  let saved = 0;
  let duplicates = 0;

  for (const m of mappedStatements) {
    if (m.confidence !== "high" || !m.topicKey) continue;

    const topicKeyOnly = m.topicKey.includes(":") ? m.topicKey.split(":")[1] : m.topicKey;
    const canonicalKey = makeCanonicalKey(specKey, topicKeyOnly, m.statementText);
    const statementCode = `ingest-${canonicalKey.slice(0, 12)}`;

    const stText = (m.statementText || "").trim();
    const existing = await SpecStatement.findOne({
      $or: [
        { specKey, canonicalStatementKey: canonicalKey },
        { specKey, topicKey: m.topicKey, statementText: stText },
      ],
    });

    if (existing) {
      duplicates++;
      continue;
    }

    if (!dryRun) {
      await SpecStatement.create({
        specKey,
        examBoard,
        level,
        subject: subject || taxonomy?.subject || null,
        topicKey: m.topicKey,
        mainTopicKey: m.mainTopicKey || null,
        statementCode,
        statementText: m.statementText.trim(),
        statementType: m.statementType || "core",
        sourceDocumentName: sourceDocumentName || m.sourceDocumentName,
        sourceDocumentVersion: sourceDocumentVersion || null,
        sourcePageNumber: m.sourcePageNumber || null,
        sourceSectionHeading: m.sourceSectionHeading || null,
        canonicalStatementKey: canonicalKey,
        tier: null,
        tags: [],
        metadata: { ingestedAt: new Date(), confidence: "high" },
      });
      saved++;
    } else {
      saved++;
    }
  }

  return { saved, duplicates };
}

/**
 * Main ingestion entry point.
 * @param {{ filePath: string, specKey: string, subject?: string, dryRun?: boolean }}
 * @returns {Promise<{ specKey, sourceDocumentName, dryRun, summary, mapped, unmapped }>}
 */
async function ingestSpecDocument({ filePath, specKey, subject, dryRun = true }) {
  const sourceDocumentName = path.basename(filePath);
  const text = await extractTextFromFile(filePath);
  const rawSections = extractRawSpecSections(filePath, text);
  const normalized = normalizeSpecStatements(rawSections, specKey, subject || "", sourceDocumentName);
  const mapped = mapStatementsToTopics(normalized, specKey);

  const highConfidence = mapped.filter((m) => m.confidence === "high" && m.topicKey);
  const unmapped = mapped.filter((m) => !m.topicKey || m.confidence !== "high");

  const { saved, duplicates } = await saveSpecStatements(mapped, {
    dryRun,
    sourceDocumentName,
    specKey,
    subject,
  });

  const summary = {
    parsedStatements: normalized.length,
    mappedStatements: highConfidence.length,
    unmappedStatements: unmapped.length,
    duplicateStatements: duplicates,
    saved,
  };

  return {
    specKey,
    sourceDocumentName,
    dryRun,
    summary,
    mapped: highConfidence.map((m) => ({
      statementText: m.statementText,
      topicKey: m.topicKey,
      mainTopicKey: m.mainTopicKey,
      statementType: m.statementType,
      sourcePageNumber: m.sourcePageNumber,
      sourceSectionHeading: m.sourceSectionHeading,
    })),
    unmapped: unmapped.map((u) => ({
      statementText: u.statementText,
      sourcePageNumber: u.sourcePageNumber,
      sourceSectionHeading: u.sourceSectionHeading,
      reason: u.reason,
    })),
  };
}

module.exports = {
  ingestSpecDocument,
  extractRawSpecSections,
  normalizeSpecStatements,
  mapStatementsToTopics,
  saveSpecStatements,
  extractTextFromFile,
  makeCanonicalKey,
};
