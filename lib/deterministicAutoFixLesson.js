/**
 * Deterministic SS1 lesson repairs (no LLM).
 * Uses chunk-safe edits + sequential renumbering.
 */

import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  profileAwareKeywordFallback,
  extractKeywordLines,
  evaluateKeyWordsAuthorityGate,
  reconcileKeywordRows,
  isFrameworkMetaTerm,
  keywordRowsFrameworkRatio,
} = require("./teacherBrain/keyWordsAuthority.js");
const {
  ensureObjectiveScopeCompliance,
  evaluateObjectivesAuthorityGate,
} = require("./teacherBrain/objectivesAuthority.js");
const {
  ensureCheckpointScopeCompliance,
  evaluateCheckpointAuthorityGate,
} = require("./teacherBrain/checkpointAuthority.js");
const {
  ensureExamPracticeScopeCompliance,
  evaluateExamPracticeAuthorityGate,
} = require("./teacherBrain/examPracticeAuthority.js");
const {
  ensureSummaryScopeCompliance,
  evaluateSummaryAuthorityGate,
} = require("./teacherBrain/summaryAuthority.js");
const {
  ensureMemoryRuleScopeCompliance,
  evaluateMemoryRuleAuthorityGate,
} = require("./teacherBrain/memoryRuleAuthority.js");

function norm(text = "") {
  return String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function sanitizeTopic(topic) {
  const t = String(topic || "this topic").trim() || "this topic";
  return t.replace(/\s+/g, " ").slice(0, 120);
}

function isTeacherFirstSs1Enabled() {
  return String(process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING || "0").trim() === "1";
}

/** Canonical SS1 ordering — classic (20) or teacher-first (24) when flag is on. */
const CLASSIC_SS1_SHELL_SLOTS = [
  { key: "objectives", title: "REVISION OBJECTIVES", paste: "Text (concept)" },
  { key: "priorKnowledge", title: "PRIOR KNOWLEDGE", paste: "Text (concept)" },
  { key: "scenario", title: "SCENARIO", paste: "Hook (text)" },
  { key: "coreRule", title: "CORE RULE", paste: "Core rule (key idea)" },
  { key: "coreTeaching", title: "CORE TEACHING", paste: "Text (concept)" },
  { key: "checkpoint", title: "CHECKPOINT", paste: "Checkpoint block" },
  { key: "dragDrop", title: "DRAG AND DROP MATCH", paste: "Drag and drop match" },
  { key: "commonMistake", title: "COMMON MISTAKE", paste: "Common mistake" },
  { key: "diagram", title: "DIAGRAM / VISUAL SETUP", paste: "Diagram (concept)" },
  { key: "stepByStep", title: "STEP-BY-STEP PROCESS", paste: "Step-by-step diagram (process)" },
  { key: "interactiveDiagram", title: "INTERACTIVE DIAGRAM", paste: "Interactive diagram" },
  { key: "examTip", title: "EXAM TIP", paste: "Exam tip (concept)" },
  { key: "workedExample", title: "WORKED EXAMPLE", paste: "Worked example (checkpoint)" },
  { key: "quickCheck", title: "QUICK CHECK", paste: "Quick check (checkpoint)" },
  { key: "synthesis", title: "SYNTHESIS", paste: "Synthesis (key idea)" },
  { key: "selfCheck", title: "SELF-CHECK QUESTION", paste: "Self-check question" },
  { key: "finalMemoryRule", title: "FINAL MEMORY RULE", paste: "Final memory rule (key idea)" },
  { key: "examPractice", title: "EXAM PRACTICE", paste: "Text (concept)" },
  { key: "summary", title: "SUMMARY", paste: "Text (concept)" },
  { key: "keywords", title: "KEY WORDS", paste: "Key words" },
];

const TEACHER_FIRST_SS1_SHELL_SLOTS = [
  { key: "objectives", title: "REVISION OBJECTIVES", paste: "Text (concept)" },
  { key: "priorKnowledge", title: "PRIOR KNOWLEDGE", paste: "Text (concept)" },
  { key: "definition", title: "DEFINITION", paste: "Text (concept)" },
  { key: "scenario", title: "SCENARIO", paste: "Hook (text)" },
  { key: "whyItMatters", title: "WHY IT MATTERS", paste: "Text (concept)" },
  { key: "coreModel", title: "CORE MODEL", paste: "Core rule (key idea)" },
  { key: "keyExamples", title: "KEY EXAMPLES", paste: "Text (concept)" },
  { key: "examVocabulary", title: "EXAM VOCABULARY", paste: "Text (concept)" },
  { key: "coreTeaching", title: "CORE LEARNING", paste: "Text (concept)" },
  { key: "checkpoint", title: "CHECKPOINT", paste: "Checkpoint block" },
  { key: "dragDrop", title: "DRAG AND DROP MATCH", paste: "Drag and drop match" },
  { key: "commonMistake", title: "COMMON MISTAKE", paste: "Common mistake" },
  { key: "diagram", title: "DIAGRAM / VISUAL SETUP", paste: "Diagram (concept)" },
  { key: "stepByStep", title: "STEP-BY-STEP PROCESS", paste: "Step-by-step diagram (process)" },
  { key: "interactiveDiagram", title: "INTERACTIVE DIAGRAM", paste: "Interactive diagram" },
  { key: "examTip", title: "EXAM TIP", paste: "Exam tip (concept)" },
  { key: "workedExample", title: "WORKED EXAMPLE", paste: "Worked example (checkpoint)" },
  { key: "quickCheck", title: "QUICK CHECK", paste: "Quick check (checkpoint)" },
  { key: "synthesis", title: "SYNTHESIS", paste: "Synthesis (key idea)" },
  { key: "selfCheck", title: "SELF-CHECK QUESTION", paste: "Self-check question" },
  { key: "finalMemoryRule", title: "FINAL MEMORY RULE", paste: "Final memory rule (key idea)" },
  { key: "examPractice", title: "EXAM PRACTICE", paste: "Text (concept)" },
  { key: "summary", title: "SUMMARY", paste: "Text (concept)" },
  { key: "keywords", title: "KEY WORDS", paste: "Key words" },
];

function resolveSs1CanonicalSlots() {
  return isTeacherFirstSs1Enabled() ? TEACHER_FIRST_SS1_SHELL_SLOTS : CLASSIC_SS1_SHELL_SLOTS;
}

function getCoreTeachingOverflowSlotIndex() {
  return resolveSs1CanonicalSlots().findIndex((s) => s.key === "coreTeaching");
}

function slotKeyForIndex(index) {
  return resolveSs1CanonicalSlots()[index]?.key || null;
}

/** Map an SS1 block header / paste line to a canonical slot key (position-independent). */
function slotKeyFromBlockHeader(blockText = "") {
  const headerLine = (blockText.split("\n")[0] || "").toUpperCase();
  const pasteLine = blockPasteLine(blockText);
  const slots = resolveSs1CanonicalSlots();

  for (const slot of slots) {
    if (headerLine.includes(slot.title.toUpperCase())) return slot.key;
  }
  for (const slot of slots) {
    if (pasteLine && pasteLine.includes(slot.paste.toLowerCase())) return slot.key;
  }
  if (/\bKEY\s+WORDS\b|\bKEYWORDS\b/.test(headerLine)) return "keywords";
  if (/\bSUMMARY\b/.test(headerLine)) return "summary";
  if (/\bEXAM\s+PRACTICE\b/.test(headerLine)) return "examPractice";
  if (/\bFINAL\s+MEMORY\s+RULE\b/.test(headerLine)) return "finalMemoryRule";
  return null;
}

function indexModelBlockBodiesBySlotKey(modelBlocks = []) {
  const byKey = {};
  for (const blockText of modelBlocks) {
    const key = slotKeyFromBlockHeader(blockText);
    if (!key) continue;
    const body = splitBlockHeaderPasteBody(blockText).body.trim();
    if (!body) continue;
    if (!byKey[key] || body.length > byKey[key].length) {
      byKey[key] = body;
    }
  }
  return byKey;
}

function keywordsBodyIsSubstantive(body = "") {
  const rows = extractKeywordLines(body);
  if (rows.length < 8) return false;
  const subjectRows = rows.filter((r) => !isFrameworkMetaTerm(r.term));
  return subjectRows.length >= 8 && keywordRowsFrameworkRatio(rows) <= 0.3;
}

/** Split lesson into PAGE, numbered SS1 blocks, and loose prelude/trail text. */
function lessonChunks(text) {
  const lines = norm(text).split("\n");
  const chunks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^PAGE\s+\d+/i.test(line)) {
      const start = i;
      i++;
      while (
        i < lines.length &&
        !/^PAGE\s+\d+/i.test(lines[i]) &&
        !/^(\d+)\s*[—\-–]\s+/.test(lines[i])
      ) {
        i++;
      }
      chunks.push({
        kind: "page",
        text: lines.slice(start, i).join("\n"),
      });
      continue;
    }

    if (/^(\d+)\s*[—\-–]\s+/.test(line)) {
      const start = i;
      i++;
      while (
        i < lines.length &&
        !/^PAGE\s+\d+/i.test(lines[i]) &&
        !/^(\d+)\s*[—\-–]\s+/.test(lines[i])
      ) {
        i++;
      }
      chunks.push({
        kind: "block",
        text: lines.slice(start, i).join("\n"),
      });
      continue;
    }

    const looseStart = i;
    while (
      i < lines.length &&
      !/^PAGE\s+\d+/i.test(lines[i]) &&
      !/^(\d+)\s*[—\-–]\s+/.test(lines[i])
    ) {
      i++;
    }
    chunks.push({
      kind: "loose",
      text: lines.slice(looseStart, i).join("\n"),
    });
  }

  return chunks;
}

function rebuildLesson(chunks) {
  return chunks.map((c) => c.text.replace(/\s+$/gm, "").trimEnd()).filter(Boolean).join("\n\n");
}

/** Flatten HTML so validators / marker checks see headings like `<h3>Weak answer:</h3>`. */
function stripHtmlToPlain(text = "") {
  return String(text || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function insertBeforeSection(text = "", sectionRegex, blockText) {
  const t = norm(text);
  const rx = sectionRegex;

  const str = rx instanceof RegExp ? rx.source : String(rx);
  // Always use a fixed flag set — appending "mi" to rx.flags duplicates "i" (e.g. /x/i → "imi", invalid).
  const full = new RegExp(`(?:^|\\n)(?=\\d+\\s*[—\\-–]\\s+[^\\n]*${str})`, "mi");
  let idx = t.search(full);
  if (idx === -1) {
    return t.trimEnd() + "\n\n" + String(blockText).trim() + "\n";
  }
  if (idx > 0 && t[idx] === "\n") idx += 1;
  return (
    t.slice(0, idx).trimEnd() +
    "\n\n" +
    String(blockText).trim() +
    "\n\n" +
    t.slice(idx)
  );
}

export function renumberBlocks(text = "") {
  const lines = norm(text).split("\n");
  let n = 0;
  return lines
    .map((line) => {
      const m = line.match(/^(\d+)\s*([—\-–])\s+(.+)$/);
      if (!m || /^PAGE\s+/i.test(line)) return line;
      n += 1;
      return `${n}${m[2]} ${m[3]}`;
    })
    .join("\n");
}

/** Insert `blockText` before the first numbered block whose title matches Exam Practice, else Summary, else append. */
function insertBeforeExamPracticeOrSummary(text, blockText) {
  const t = norm(text);
  const b = String(blockText).trim();
  const tryPatterns = [/EXAM\s+PRACTICE/i, /SUMMARY/i];

  for (const rx of tryPatterns) {
    const str = rx.source;
    const full = new RegExp(
      `(?:^|\\n)(?=\\d+\\s*[—\\-–]\\s+[^\\n]*(?:${str}))`,
      "mi"
    );
    let idx = t.search(full);
    if (idx !== -1) {
      if (idx > 0 && t[idx] === "\n") idx += 1;
      return (
        t.slice(0, idx).trimEnd() +
        "\n\n" +
        b +
        "\n\n" +
        t.slice(idx)
      );
    }
  }

  return t.trimEnd() + "\n\n" + b + "\n\n";
}

function countLessonObjectiveStrength(blockText = "") {
  const liMatches = blockText.match(/<li\b/gi);
  const liCount = liMatches ? liMatches.length : 0;
  const bullets = blockText
    .split("\n")
    .filter((l) => /^[-•*]\s+\S/.test(l.trim())).length;
  return Math.max(liCount, bullets);
}

function countPriorKnowledgeStrength(blockText = "") {
  return countLessonObjectiveStrength(blockText);
}

function blockPasteLine(blockText = "") {
  const m = /^Paste into:\s*(.+)$/im.exec(blockText);
  return m ? m[1].trim().toLowerCase() : "";
}

function isCheckpointBlockPaste(pasteLine) {
  return (
    pasteLine.includes("checkpoint block") ||
    pasteLine.includes("quick check")
  );
}

function checkpointWellFormed(body = "") {
  const b = norm(body);
  return (
    /Question\s*:/i.test(b) &&
    /Option\s*1\s*:/i.test(b) &&
    /Option\s*2\s*:/i.test(b) &&
    /Option\s*3\s*:/i.test(b) &&
    /Option\s*4\s*:/i.test(b) &&
    /Answer\s*:/i.test(b)
  );
}

function checkpointBody(topicLabel, preset = "main") {
  const t = sanitizeTopic(topicLabel);
  if (preset === "quick") {
    return [
      "Question:",
      "What should a strong exam answer usually include?",
      "",
      "Option 1:",
      "Only a keyword",
      "",
      "Option 2:",
      "A cause → effect explanation",
      "",
      "Option 3:",
      "Only a diagram",
      "",
      "Option 4:",
      "A guess without evidence",
      "",
      "Answer:",
      "A cause → effect explanation",
    ].join("\n");
  }
  return [
    "Question:",
    "Which statement best matches this topic?",
    "",
    "Option 1:",
    `A correct statement about ${t}`,
    "",
    "Option 2:",
    "An unrelated statement",
    "",
    "Option 3:",
    "A common misconception",
    "",
    "Option 4:",
    "A vague statement without explanation",
    "",
    "Answer:",
    `A correct statement about ${t}`,
  ].join("\n");
}

function splitBlockHeaderPasteBody(blockText) {
  const lines = norm(blockText).split("\n");
  let pasteIdx = lines.findIndex((l) => /^Paste into:/i.test(l));
  if (pasteIdx === -1) pasteIdx = 0;
  const header = lines.slice(0, pasteIdx + 1);
  const body = lines.slice(pasteIdx + 1).join("\n");
  return { headerLines: header, body };
}

function repairCheckpointBlocks(text, topic, fixes) {
  const chunks = lessonChunks(text);
  let changed = false;

  const next = chunks.map((c) => {
    if (c.kind !== "block") return c;
    const paste = blockPasteLine(c.text);
    if (!isCheckpointBlockPaste(paste)) return c;

    const { headerLines, body } = splitBlockHeaderPasteBody(c.text);
    if (checkpointWellFormed(body)) return c;

    const preset =
      paste.includes("quick check") ||
      /\bquick\s+check\b/i.test(headerLines[0] || "")
        ? "quick"
        : "main";

    changed = true;
    const newText =
      headerLines.join("\n") +
      "\n\n" +
      checkpointBody(topic, preset) +
      "\n";

    fixes.push(`Repaired malformed checkpoint/quick-check block (${headerLines[0] || "?"}).`);
    return { kind: "block", text: newText.trimEnd() };
  });

  if (!changed) return text;
  return rebuildLesson(next);
}

function countCheckpointPastes(fullText = "") {
  const t = norm(fullText);
  const re =
    /^Paste into:\s*(?:Checkpoint block|Quick check \(\s*checkpoint\s*\))/gim;
  return (t.match(re) || []).length;
}

function templateCheckpointMain(topic, _n) {
  return [
    "0 — CHECKPOINT",
    "Paste into: Checkpoint block",
    "",
    checkpointBody(topic, "main"),
    "",
  ].join("\n");
}

function templateCheckpointQuick(topic) {
  return [
    "0 — QUICK CHECK",
    "Paste into: Quick check (checkpoint)",
    "",
    checkpointBody(topic, "quick"),
    "",
  ].join("\n");
}

function injectTwoCheckpoints(text, topic, fixes) {
  const t = norm(text);
  const need = 2 - countCheckpointPastes(t);
  if (need <= 0) return t;

  const pieces = [];
  for (let i = 0; i < need; i++) {
    pieces.push(i % 2 === 0 ? templateCheckpointMain(topic) : templateCheckpointQuick(topic));
  }

  fixes.push(`Added ${need} checkpoint-style block(s) (need ≥2 total).`);

  return insertBeforeSection(t, /EXAM\s+PRACTICE/i, pieces.join("\n\n"));
}

function stripKeyInsightBlocks(text, fixes) {
  const chunks = lessonChunks(text);
  const kiIndices = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    if (c.kind !== "block") continue;
    const firstLine = c.text.split("\n")[0] || "";
    if (
      /💡\s*Key Insight/i.test(c.text) ||
      /\bKEY\s*INSIGHT\b/i.test(firstLine)
    ) {
      kiIndices.push(i);
    }
  }

  if (kiIndices.length <= 1) return text;

  let keepIdx = kiIndices.find((i) =>
    blockPasteLine(chunks[i].text).includes("final memory rule")
  );
  if (keepIdx === undefined) keepIdx = kiIndices[0];

  const remove = new Set(kiIndices.filter((i) => i !== keepIdx));
  const filtered = chunks.filter((c, i) => {
    if (!remove.has(i)) return true;
    fixes.push(`Removed duplicate Key Insight block (${(c.text.split("\n")[0] || "").trim()}).`);
    return false;
  });

  return rebuildLesson(filtered);
}

function ensureSingleKeyInsight(text, topic, fixes) {
  let t = norm(text);
  t = stripKeyInsightBlocks(t, fixes);

  if (/\b💡\s*Key Insight\b/i.test(t)) return t;

  const tl = sanitizeTopic(topic);
  const block = [
    "0 — KEY INSIGHT",
    "Paste into: Final memory rule (key idea)",
    "",
    "<p><strong>💡 Key Insight</strong></p>",
    `<p><strong>👉</strong> The most important idea is that <strong>${tl}</strong> links clear cause → effect reasoning to how examiners award marks.</p>`,
    "",
  ].join("\n");

  let out = insertBeforeSection(t, /KEY\s+WORDS|KEYWORDS|SUMMARY/i, block);
  if (!/\b💡\s*Key Insight\b/i.test(norm(out))) {
    out = insertBeforeSection(t, /EXAM\s+PRACTICE/i, block);
  }
  fixes.push("Inserted exactly one 💡 Key Insight block (Final memory rule).");
  return out;
}

function insertBeforeFirstMatchingLine(text = "", predicate, blockText = "") {
  const lines = norm(text).split("\n");
  const idx = lines.findIndex((l) => predicate(l.trim()));
  if (idx === -1)
    return norm(text).trimEnd() + "\n\n" + String(blockText).trim() + "\n";
  return (
    lines.slice(0, idx).join("\n").trimEnd() +
    "\n\n" +
    String(blockText).trim() +
    "\n\n" +
    lines.slice(idx).join("\n")
  );
}

const OBJECTIVES_BLOCK = (topic) => {
  const t = sanitizeTopic(topic);
  return [
    "0 — REVISION OBJECTIVES",
    "Paste into: Text (concept)",
    "",
    "<p><strong>👉 🎯 Revision Objectives</strong></p>",
    "<p>At the end of this lesson, you should be able to:</p>",
    "<ul>",
    `<li><strong>👉</strong> Describe <strong>${t}</strong> using correct subject vocabulary.</li>`,
    "<li><strong>👉</strong> Explain the main process or idea using cause → effect.</li>",
    "<li><strong>👉</strong> Identify common mistakes and correct them.</li>",
    "<li><strong>👉</strong> Apply the idea to exam-style questions.</li>",
    "</ul>",
    "",
  ].join("\n");
};

const PRIOR_BLOCK = () =>
  [
    "0 — PRIOR KNOWLEDGE",
    "Paste into: Text (concept)",
    "",
    "<p><strong>👉 🧠 Prior Knowledge</strong></p>",
    "<p>Before we start, you should already know:</p>",
    "<ul>",
    "<li><strong>👉</strong> Basic subject vocabulary linked to this topic.</li>",
    "<li><strong>👉</strong> How to describe simple cause → effect relationships.</li>",
    "<li><strong>👉</strong> How to use keywords in exam answers.</li>",
    "<li><strong>👉</strong> That exam answers need explanation, not just naming.</li>",
    "</ul>",
    "",
  ].join("\n");

function ensureObjectives(text, topic, fixes) {
  let t = norm(text);
  const chunks = lessonChunks(t);
  const objIx = chunks.findIndex(
    (c) =>
      c.kind === "block" &&
      /\blesson\s+objectives\b|\bobjectives\b/i.test(
        (c.text.split("\n")[0] || "").toLowerCase()
      )
  );

  const tmpl = OBJECTIVES_BLOCK(topic);

  if (objIx >= 0) {
    if (countLessonObjectiveStrength(chunks[objIx].text) < 3) {
      chunks[objIx] = { kind: "block", text: tmpl };
      fixes.push("Replaced Revision Objectives (too few bullets or list items).");
      return rebuildLesson(chunks);
    }
    return t;
  }

  const pageIx = chunks.findIndex((c) => c.kind === "page");
  if (pageIx >= 0) {
    chunks.splice(pageIx + 1, 0, { kind: "block", text: tmpl });
  } else {
    chunks.unshift({ kind: "block", text: tmpl });
  }
  fixes.push("Inserted Revision Objectives block (PAGE 1 or start).");
  return rebuildLesson(chunks);
}

function ensurePriorKnowledge(text, fixes) {
  let t = norm(text);
  const chunks = lessonChunks(t);
  const ix = chunks.findIndex((c) => {
    if (c.kind !== "block") return false;
    const head = (c.text.split("\n")[0] || "").toLowerCase();
    return /\bprior\s+knowledge\b/.test(head) || /\bprior\b.*\bknowledge\b/.test(head);
  });

  const tmpl = PRIOR_BLOCK();

  if (ix >= 0) {
    if (countPriorKnowledgeStrength(chunks[ix].text) < 3) {
      chunks[ix] = { kind: "block", text: tmpl };
      fixes.push("Replaced Prior Knowledge (too few bullets or list items).");
      return rebuildLesson(chunks);
    }
    return t;
  }

  let objIx = chunks.findIndex(
    (c) =>
      c.kind === "block" &&
      /\b(?:LESSON|REVISION)\s+OBJECTIVES\b/i.test(c.text.split("\n")[0] || "")
  );

  let insertAfter = chunks.findIndex(
    (c) =>
      c.kind === "block" &&
      /\b(?:revision|lesson)\s+objectives\b/i.test((c.text.split("\n")[0] || "").toLowerCase())
  );
  const pos =
    insertAfter >= 0
      ? insertAfter + 1
      : objIx >= 0
      ? objIx + 1
      : chunks.findIndex((c) => c.kind === "page") + 1;

  chunks.splice(Math.max(pos, 0), 0, { kind: "block", text: tmpl });
  fixes.push("Inserted Prior Knowledge block.");
  return rebuildLesson(chunks);
}

function templateTeacherSpeak() {
  return [
    "0 — TEACHER FOCUS",
    "Paste into: What to notice (key idea)",
    "",
    "<p><strong>👉</strong> Think like an examiner: do not just name the idea — explain how it causes an effect.</p>",
    "",
  ].join("\n");
}

function ensureTeacherSpeak(text, fixes) {
  if (/👉/.test(norm(text))) return text;

  fixes.push('Inserted 👉 cue block (“Teacher Focus”).');

  const t = norm(text);
  return insertBeforeFirstMatchingLine(
    t,
    (l) => /^Paste into:/i.test(l) && /checkpoint/i.test(l),
    templateTeacherSpeak()
  );
}

function ensureWhyThisMatters(text, fixes) {
  const t = norm(text);
  if (/🌍\s*Why this matters/i.test(t)) return t;

  const block = [
    "0 — WHY THIS MATTERS",
    "Paste into: What to notice (key idea)",
    "",
    "<p><strong>🌍 Why this matters</strong></p>",
    "<p><strong>👉</strong> This topic matters because it explains real situations and helps you answer unfamiliar exam questions.</p>",
    "",
  ].join("\n");

  fixes.push("Inserted 🌍 Why this matters block.");
  return insertBeforeSection(t, /EXAM\s+PRACTICE/i, block);
}

function ensurePremiumExamTip(text, fixes) {
  const t = norm(text);
  if (/🎯\s*Premium\s+Exam\s+Tip/i.test(t)) return t;

  const block = [
    "0 — PREMIUM EXAM TIP",
    "Paste into: Exam tip (concept)",
    "",
    "<p><strong>🎯 Premium Exam Tip</strong></p>",
    "<p><strong>👉</strong> For top-band answers, link the key idea to a clear cause → effect → outcome chain.</p>",
    "",
  ].join("\n");

  fixes.push("Inserted 🎯 Premium Exam Tip block.");
  return insertBeforeSection(t, /EXAM\s+PRACTICE/i, block);
}

function templateDragDrop() {
  return [
    "0 — DRAG AND DROP MATCH",
    "Paste into: Drag and drop match",
    "",
    "Instruction:",
    "Match each item to the correct description.",
    "",
    "Items to drag:",
    "- Key term",
    "- Process",
    "- Cause",
    "- Effect",
    "",
    "Drop zones:",
    "- Important vocabulary → ______",
    "- Sequence of events → ______",
    "- Reason something happens → ______",
    "- Result or outcome → ______",
    "",
    "Answer key:",
    "<details>",
    "<summary>Reveal Answer</summary>",
    "",
    "- Important vocabulary → Key term",
    "- Sequence of events → Process",
    "- Reason something happens → Cause",
    "- Result or outcome → Effect",
    "",
    "</details>",
    "",
  ].join("\n");
}

function templateInteractiveDiagram() {
  return [
    "0 — INTERACTIVE DIAGRAM",
    "Paste into: Interactive diagram",
    "",
    "Instruction:",
    "Label the diagram using the correct terms.",
    "",
    "Labels to use:",
    "- Key structure",
    "- Process",
    "- Cause",
    "- Effect",
    "",
    "Hotspots / parts:",
    "- A → ______",
    "- B → ______",
    "- C → ______",
    "- D → ______",
    "",
    "Answer key:",
    "<details>",
    "<summary>Reveal Answer</summary>",
    "",
    "- A → Key structure",
    "- B → Process",
    "- C → Cause",
    "- D → Effect",
    "",
    "</details>",
    "",
  ].join("\n");
}

function templateDiagramConcept(topic) {
  const t = sanitizeTopic(topic);
  return [
    "0 — DIAGRAM (CONCEPT)",
    "Paste into: Diagram (concept)",
    "",
    "Placement:",
    "Main teaching wall",
    "",
    "Type:",
    `${t} concept schematic`,
    "",
    "What It Should Show:",
    "Clearly labelled structures that support the explanation.",
    "",
    "Why It Helps:",
    'Turns vocabulary into something you can "see" in the exam.',
    "",
  ].join("\n");
}

function templateStepByStep(topic) {
  const t = sanitizeTopic(topic);
  return [
    "0 — STEP-BY-STEP PROCESS",
    "Paste into: Step-by-step diagram (process)",
    "",
    `<p><strong>Process (${t})</strong></p>`,
    "<p>How to build a strong exam explanation</p>",
    "",
    "Step 1:",
    "Identify the key idea.",
    "",
    "↓",
    "",
    "Step 2:",
    "Explain what happens.",
    "",
    "↓",
    "",
    "Step 3:",
    "Link the cause to the effect.",
    "",
    "↓",
    "",
    "Step 4:",
    "State the final outcome clearly.",
    "",
    "Exam link:",
    "Use this structure when the question says explain.",
    "",
  ].join("\n");
}

function pasteLineExists(t, substring) {
  const sub = substring.toLowerCase();
  return norm(t)
    .split("\n")
    .some(
      (l) =>
        /^Paste into:/i.test(l.trim()) &&
        l.toLowerCase().includes(sub)
    );
}

function ensurePasteBlockAbsent(text, pasteSubstring, templateFn, fixes, msg) {
  const t = norm(text);
  if (pasteLineExists(t, pasteSubstring)) return t;

  fixes.push(msg);
  return insertBeforeSection(t, /EXAM\s+PRACTICE/i, templateFn());
}

function buildKeywordContext({ topic = "", topicKey = "", subject = "Biology" } = {}) {
  return {
    topic: sanitizeTopic(topic),
    topicKey: String(topicKey || "").trim(),
    subject: String(subject || "Biology").trim(),
    usedGenericFallback: false,
  };
}

function resolveKeywordRows(keywordContext, count, lessonText, fixes) {
  const result = profileAwareKeywordFallback({
    topic: keywordContext.topic,
    topicKey: keywordContext.topicKey,
    subject: keywordContext.subject,
    lessonText: lessonText || "",
    count,
  });
  if (result.usedGenericFallback) {
    keywordContext.usedGenericFallback = true;
    if (result.warning && fixes) {
      fixes.push(`WARNING: ${result.warning}`);
    }
  }
  return result.rows;
}

function padKeywordRows(existingRows, keywordContext, lessonText, targetCount, fixes) {
  const rows = [...existingRows];
  const seen = new Set(rows.map((r) => String(r.term).trim().toLowerCase()));
  const pool = resolveKeywordRows(keywordContext, 20, lessonText, fixes);
  for (const row of pool) {
    if (rows.length >= targetCount) break;
    const key = String(row.term).trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows.slice(0, targetCount);
}

function ensureExactlyTenKeywords(text, keywordContext, fixes) {
  const chunks = lessonChunks(norm(text));
  const firstLine = (c) => (c.text.split("\n")[0] || "").toLowerCase();

  let kwIx = chunks.findIndex(
    (c) =>
      c.kind === "block" &&
      (/key\s+words|keywords\b/.test(firstLine(c)) ||
        /\bKEYWORDS\b/.test((c.text.split("\n")[0] || "").toUpperCase()))
  );

  const pasteIx = chunks.findIndex(
    (c) =>
      c.kind === "block" &&
      /\bPaste into:\s*key\s+words\b/i.test(c.text.split("\n").slice(0, 4).join("\n"))
  );
  if (kwIx < 0 && pasteIx >= 0) kwIx = pasteIx;

  const rowsToLines = (rows) =>
    rows.map((r) => `<strong>${r.term}</strong> – ${r.def}`).join("\n");

  if (kwIx < 0) {
    const reconciled = reconcileKeywordRows({
      existingRows: [],
      topic: keywordContext.topic,
      topicKey: keywordContext.topicKey,
      subject: keywordContext.subject,
      lessonText: text,
      count: 10,
    });
    if (reconciled.usedGenericFallback) {
      keywordContext.usedGenericFallback = true;
      if (reconciled.warning && fixes) {
        fixes.push(`WARNING: ${reconciled.warning}`);
      }
    }
    const rows = reconciled.rows;
    const block = [
      "0 — KEY WORDS",
      "Paste into: Key words",
      "",
      '<p><strong>👉 Keywords</strong></p>',
      rowsToLines(rows),
      "",
    ].join("\n");

    fixes.push(reconciled.fixMessage || "Inserted Keywords block with exactly 10 terms.");
    return insertBeforeSection(rebuildLesson(chunks), /EXAM\s+PRACTICE/i, block);
  }

  let rows = extractKeywordLines(chunks[kwIx].text).slice(0, 10);
  rows = rows.map((r) => ({ term: String(r.term).trim(), def: String(r.def).trim() }));

  const reconciled = reconcileKeywordRows({
    existingRows: rows,
    topic: keywordContext.topic,
    topicKey: keywordContext.topicKey,
    subject: keywordContext.subject,
    lessonText: text,
    count: 10,
  });
  rows = reconciled.rows;
  if (reconciled.usedGenericFallback) {
    keywordContext.usedGenericFallback = true;
    if (reconciled.warning && fixes) {
      fixes.push(`WARNING: ${reconciled.warning}`);
    }
  }
  if (reconciled.replaced) {
    fixes.push(reconciled.fixMessage);
  }

  rows = rows.slice(0, 10);

  const linesArr = chunks[kwIx].text.split("\n");
  let pasteIdx = linesArr.findIndex((l) => /^Paste into:/i.test(l));
  if (pasteIdx < 0) pasteIdx = 1;

  const headerLines = linesArr.slice(0, pasteIdx + 1);
  const rebuiltBlock =
    headerLines.join("\n") +
    "\n\n" +
    "<p><strong>👉 Keywords</strong></p>\n" +
    rowsToLines(rows);

  if (!fixes.some((f) => /Keywords/i.test(f))) {
    fixes.push("Normalised Keywords to exactly 10 term–definition lines.");
  }
  chunks[kwIx] = { kind: "block", text: rebuiltBlock };
  return rebuildLesson(chunks);
}

function topicSuggestsBacteriaModelling(topicLabel) {
  const s = String(topicLabel || "").toLowerCase();
  return (
    /bacter|pathogen|communicable|toxin|antibiot/.test(s) ||
    (/infection/.test(s) && (/response|disease|sepsis/).test(s))
  );
}

function escapeHtmlInline(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildAnswerQualityModellingBlock(topicLabel) {
  const tRaw = sanitizeTopic(topicLabel);
  const tSafe = escapeHtmlInline(tRaw);
  const useBacteriaExample = topicSuggestsBacteriaModelling(tRaw);

  if (useBacteriaExample) {
    return [
      "0 — ANSWER QUALITY MODELLING",
      "Paste into: Exam tip (concept)",
      "",
      "<h2><strong>🎯 Answer Quality Modelling</strong></h2>",
      "<p>👉 This is how to move from a basic answer to a full-mark explanation.</p>",
      "",
      "<h3><strong>Weak answer:</strong></h3>",
      "<p>Bacteria make people ill.</p>",
      "",
      "<h3><strong>Better answer:</strong></h3>",
      "<p>Bacteria reproduce in the body and release toxins.</p>",
      "",
      "<h3><strong>Full-mark answer:</strong></h3>",
      "<p>Bacteria enter the body, reproduce rapidly, and release toxins. These toxins damage cells and tissues, causing symptoms such as fever, inflammation, diarrhoea, or cramps.</p>",
      "",
      "<h3><strong>Why the full-mark answer is stronger:</strong></h3>",
      "<ul>",
      "<li>It gives a clear cause → effect chain.</li>",
      "<li>It links pathogen growth to toxin release.</li>",
      "<li>It explains how symptoms are caused.</li>",
      "</ul>",
      "",
    ].join("\n");
  }

  return [
    "0 — ANSWER QUALITY MODELLING",
    "Paste into: Exam tip (concept)",
    "",
    "<h2><strong>🎯 Answer Quality Modelling</strong></h2>",
    "<p>👉 This is how to move from a basic answer to a full-mark explanation.</p>",
    "",
    "<h3><strong>Weak answer:</strong></h3>",
    `<p>A very short statement about <strong>${tSafe}</strong> that does not explain <em>why</em> it happens.</p>`,
    "",
    "<h3><strong>Better answer:</strong></h3>",
    `<p>Adds a <strong>because</strong> and links two ideas so the examiner can see basic reasoning about <strong>${tSafe}</strong>.</p>`,
    "",
    "<h3><strong>Full-mark answer:</strong></h3>",
    `<p>Uses precise terminology, orders ideas as cause → effect, and explains the mechanism for <strong>${tSafe}</strong> so marks can be awarded for both knowledge and explanation.</p>`,
    "",
    "<h3><strong>Why the full-mark answer is stronger:</strong></h3>",
    "<ul>",
    "<li>It gives a clear cause → effect chain.</li>",
    "<li>It links evidence to outcomes an examiner expects.</li>",
    "<li>It avoids vague wording that could describe any topic.</li>",
    "</ul>",
    "",
  ].join("\n");
}

/**
 * Ensures Weak / Better / Full-mark answer modelling exists for SS1 validation.
 * @param {string} text
 * @param {string} topic
 * @param {string[]|null} [fixesApplied] When provided, receives the fix message when insertion runs.
 * @returns {string}
 */
export function ensureAnswerQualityModelling(text = "", topic = "", fixesApplied = null) {
  const t = norm(text);
  const plain = stripHtmlToPlain(t);
  const hasWeak = /\bWeak answer\s*:/i.test(plain);
  const hasBetter = /\bBetter answer\s*:/i.test(plain);
  const hasFull = /\bFull-mark answer\s*:/i.test(plain);
  if (hasWeak && hasBetter && hasFull) return t;

  if (fixesApplied) {
    fixesApplied.push("Inserted answer-quality modelling block.");
  }

  const block = buildAnswerQualityModellingBlock(sanitizeTopic(topic || "this topic"));
  return insertBeforeExamPracticeOrSummary(t, block);
}

function bodyFromTemplate(makeBlock) {
  const raw = makeBlock();
  return splitBlockHeaderPasteBody(raw).body.trim();
}

function templateExamTipCompositeBody(topicLabel) {
  const aq = bodyFromTemplate(() => buildAnswerQualityModellingBlock(topicLabel));
  return [
    `<h2><strong>🌍 Why this matters</strong></h2>`,
    `<p><strong>👉</strong> This topic matters because it explains real situations and helps you answer unfamiliar exam questions.</p>`,
    "",
    `<h2><strong>🎯 Premium Exam Tip</strong></h2>`,
    `<p><strong>👉</strong> For top-band answers, link the key idea to a clear cause → effect → outcome chain.</p>`,
    "",
    aq,
  ].join("\n");
}

function templateCommonMistake(topic) {
  const t = escapeHtmlInline(sanitizeTopic(topic));
  return [
    "0 — COMMON MISTAKE",
    "Paste into: Common mistake",
    "",
    `<h2><strong>A common mistake</strong></h2>`,
    `<p><strong>👉</strong> Naming <strong>${t}</strong> without explaining <em>why</em> it leads to a specific outcome.</p>`,
    "<p>A better approach: add a clear <strong>because</strong> and link cause → effect.</p>",
    "",
  ].join("\n");
}

function templateHookDefault(topic) {
  const t = escapeHtmlInline(sanitizeTopic(topic));
  return [
    `<h2><strong>Right, let's look at this…</strong></h2>`,
    `<p>👉 Imagine a typical question about <strong>${t}</strong> that sounds easy until you have to explain <em>why</em> it matters.</p>`,
    "<p>This is where we slow down and talk it through like you're <em>in the room</em>.</p>",
  ].join("\n");
}

function templateTeacherFirstScenarioDefault(topic) {
  const t = escapeHtmlInline(sanitizeTopic(topic));
  return [
    `<h2><strong>Apply the model</strong></h2>`,
    `<p>👉 <strong>One short example that illustrates the core model for ${t} — after the definition and pathway are already clear.</strong></p>`,
  ].join("\n");
}

function templateDefinitionDefault(topic) {
  const t = escapeHtmlInline(sanitizeTopic(topic));
  return [
    `<h2><strong>Definition</strong></h2>`,
    `<p>👉 <strong>[Clear GCSE definition of ${t} — no story]</strong></p>`,
  ].join("\n");
}

function templateWhyItMattersDefault(topic) {
  return [
    `<h2><strong>Why it matters</strong></h2>`,
    "<p>👉 <strong>[One sentence on why this concept matters in biology or exams]</strong></p>",
  ].join("\n");
}

function templateCoreModelDefault(topic) {
  const t = escapeHtmlInline(sanitizeTopic(topic));
  return [
    `<h2><strong>Core model</strong></h2>`,
    `<p>👉 <strong>[The key GCSE model or pathway for ${t}]</strong></p>`,
  ].join("\n");
}

function templateKeyExamplesDefault(topic) {
  const t = escapeHtmlInline(sanitizeTopic(topic));
  return [
    `<h2><strong>Key examples</strong></h2>`,
    "<ul>",
    `<li>[example 1 for ${t}]</li>`,
    "<li>[example 2]</li>",
    "<li>[example 3]</li>",
    "</ul>",
  ].join("\n");
}

function templateExamVocabularyDefault() {
  return [
    `<h2><strong>Exam vocabulary</strong></h2>`,
    "<p><strong>[term 1]</strong>, <strong>[term 2]</strong>, <strong>[term 3]</strong>, <strong>[term 4]</strong>, <strong>[term 5]</strong></p>",
  ].join("\n");
}

function templateCoreRuleDefault(topic) {
  const t = escapeHtmlInline(sanitizeTopic(topic));
  return [
    `<h2><strong>The rule we're building today</strong></h2>`,
    `<p>👉 The key idea for <strong>${t}</strong> is the headline rule you will apply in every exam explanation.</p>`,
    "<p>Everything else in this lesson hangs off that idea.</p>",
  ].join("\n");
}

function templateCoreTeachingDefault(topic) {
  const t = escapeHtmlInline(sanitizeTopic(topic));
  return [
    `<h2><strong>Teaching: ${t}</strong></h2>`,
    "<p>👉 Let's build this step by step in clear classroom language.</p>",
    "<h3><strong>Key idea:</strong></h3>",
    `<p>One sentence that names what <strong>${t}</strong> is really about.</p>`,
    "<h3><strong>Process → effect:</strong></h3>",
    "<ul>",
    "<li>What happens first.</li>",
    "<li>What changes as a result.</li>",
    "</ul>",
    "<h3><strong>Think like an examiner:</strong></h3>",
    "<p>👉 Reward comes from explaining <em>why</em>, not only naming.</p>",
  ].join("\n");
}

function templateWorkedExampleDefault(topic) {
  const t = escapeHtmlInline(sanitizeTopic(topic));
  return [
    "Question:",
    `Explain one key idea about ${sanitizeTopic(topic)} using a cause → effect chain.`,
    "",
    "Answer:",
    "<details>",
    "<summary>Reveal Answer</summary>",
    "",
    `<p>Name the mechanism, add <strong>because</strong>, and state the outcome for <strong>${t}</strong>.</p>`,
    "",
    "</details>",
    "",
  ].join("\n");
}

function templateSynthesisDefault(topic) {
  const t = escapeHtmlInline(sanitizeTopic(topic));
  return [
    `<h2><strong>Synthesis: pulling it together</strong></h2>`,
    `<p>👉 <strong>${t}</strong> is strongest when you link idea → evidence → exam outcome in one clean chain.</p>`,
    "<ul>",
    "<li>Start from the definition you would write in an exam.</li>",
    "<li>Add one cause → effect sentence.</li>",
    "<li>End with what the examiner rewards.</li>",
    "</ul>",
  ].join("\n");
}

function templateSelfCheckDefault(topic) {
  const t = escapeHtmlInline(sanitizeTopic(topic));
  return [
    `<p><strong>Self-check:</strong> can you explain <strong>${t}</strong> without only naming terms?</p>`,
    "<details>",
    "<summary>Reveal Answer</summary>",
    "",
    "<p>Yes if you can say <em>because</em> and link to a measurable effect.</p>",
    "",
    "</details>",
  ].join("\n");
}

function templateExamPracticeDefault(topic) {
  const t = escapeHtmlInline(sanitizeTopic(topic));
  return [
    "<h2><strong>Exam practice</strong></h2>",
    "<p><strong>Q1 (1 mark)</strong></p>",
    `<p>State one precise fact about <strong>${t}</strong>.</p>`,
    "<p><strong>Q2 (2 marks)</strong></p>",
    `<p>Describe how <strong>${t}</strong> links to an outcome.</p>`,
    "<p><strong>Q3 (3 marks)</strong></p>",
    `<p>Explain a cause → effect chain for <strong>${t}</strong>.</p>`,
    "<details><summary>Reveal Model Answer</summary>",
    "<p>Use labelled steps: key idea → because → therefore → outcome.</p>",
    "</details>",
    "<p><strong>Q4 (4 marks)</strong></p>",
    `<p>Extended explain question on <strong>${t}</strong>.</p>`,
    "<details><summary>Reveal Model Answer</summary>",
    "<p>Paragraph with precise terms and a clear chain.</p>",
    "</details>",
  ].join("\n");
}

function templateSummaryDefault(topic) {
  const t = escapeHtmlInline(sanitizeTopic(topic));
  return [
    "<h2><strong>Summary</strong></h2>",
    "<ul>",
    `<li>Core idea for <strong>${t}</strong>: know it in your own words.</li>`,
    "<li>Always link cause → effect in explain questions.</li>",
    "<li>Use the diagram labels as vocabulary cues.</li>",
    "<li>Fix misconceptions as soon as you spot them.</li>",
    "<li>In the exam, write mechanism: not just names.</li>",
    "</ul>",
    "<p><strong>Remember:</strong> 👉 one strong chain beats ten vague facts.</p>",
  ].join("\n");
}

function templateFinalMemoryKeyInsight(topicLabel) {
  const t = escapeHtmlInline(sanitizeTopic(topicLabel));
  return [
    "<h2><strong>💡 Key Insight</strong></h2>",
    `<p><strong>👉</strong> The most important idea is that <strong>${t}</strong> links clear cause → effect reasoning to how examiners award marks.</p>`,
  ].join("\n");
}

function templateKeywordsDefault(topicLabel, keywordContext, lessonText) {
  const byKey = indexModelBlockBodiesBySlotKey(
    lessonChunks(norm(lessonText))
      .filter((c) => c.kind === "block")
      .map((c) => c.text)
  );
  const preserved = byKey.keywords || "";
  if (keywordsBodyIsSubstantive(preserved)) {
    const lines = extractKeywordLines(preserved)
      .slice(0, 10)
      .map(
        (r) =>
          `<strong>${escapeHtmlInline(r.term)}</strong> – ${escapeHtmlInline(String(r.def || "").trim() || "Key term for this topic.")}`
      )
      .join("\n");
    return [`<p><strong>👉 Keywords</strong></p>`, lines].join("\n");
  }

  const reconciled = reconcileKeywordRows({
    existingRows: extractKeywordLines(preserved),
    topic: keywordContext.topic,
    topicKey: keywordContext.topicKey,
    subject: keywordContext.subject,
    lessonText,
    count: 10,
  });
  const lines = reconciled.rows
    .map((r) => `<strong>${escapeHtmlInline(r.term)}</strong> – ${r.def}`)
    .join("\n");
  return [`<p><strong>👉 Keywords</strong></p>`, lines].join("\n");
}

function defaultBodyForSlot(i, topicLabel, keywordContext, lessonText) {
  const key = slotKeyForIndex(i);
  switch (key) {
    case "objectives":
      return bodyFromTemplate(() => OBJECTIVES_BLOCK(topicLabel));
    case "priorKnowledge":
      return bodyFromTemplate(PRIOR_BLOCK);
    case "definition":
      return templateDefinitionDefault(topicLabel);
    case "whyItMatters":
      return templateWhyItMattersDefault(topicLabel);
    case "coreModel":
      return templateCoreModelDefault(topicLabel);
    case "keyExamples":
      return templateKeyExamplesDefault(topicLabel);
    case "examVocabulary":
      return templateExamVocabularyDefault();
    case "scenario":
      return isTeacherFirstSs1Enabled()
        ? templateTeacherFirstScenarioDefault(topicLabel)
        : templateHookDefault(topicLabel);
    case "coreRule":
      return templateCoreRuleDefault(topicLabel);
    case "coreTeaching":
      return templateCoreTeachingDefault(topicLabel);
    case "checkpoint":
      return bodyFromTemplate(() => templateCheckpointMain(topicLabel));
    case "dragDrop":
      return bodyFromTemplate(templateDragDrop);
    case "commonMistake":
      return bodyFromTemplate(() => templateCommonMistake(topicLabel));
    case "diagram":
      return bodyFromTemplate(() => templateDiagramConcept(topicLabel));
    case "stepByStep":
      return bodyFromTemplate(() => templateStepByStep(topicLabel));
    case "interactiveDiagram":
      return bodyFromTemplate(templateInteractiveDiagram);
    case "examTip":
      return templateExamTipCompositeBody(topicLabel);
    case "workedExample":
      return templateWorkedExampleDefault(topicLabel);
    case "quickCheck":
      return bodyFromTemplate(() => templateCheckpointQuick(topicLabel));
    case "synthesis":
      return templateSynthesisDefault(topicLabel);
    case "selfCheck":
      return templateSelfCheckDefault(topicLabel);
    case "finalMemoryRule":
      return templateFinalMemoryKeyInsight(topicLabel);
    case "examPractice":
      return templateExamPracticeDefault(topicLabel);
    case "summary":
      return templateSummaryDefault(topicLabel);
    case "keywords":
      return templateKeywordsDefault(topicLabel, keywordContext, lessonText);
    default:
      return "<p><strong>👉</strong> Add teaching content here.</p>";
  }
}

function isThinBodyForSlot(body, slotIndex) {
  const b = String(body || "").trim();
  if (!b) return true;
  const key = slotKeyForIndex(slotIndex);
  const plainLen = stripHtmlToPlain(b).length;

  if (key === "checkpoint" || key === "quickCheck") return !checkpointWellFormed(b);
  if (key === "dragDrop") {
    return !/Items to drag:/i.test(b) || !/Drop zones:/i.test(b) || !/Answer key:/i.test(b);
  }
  if (key === "diagram") return !/Placement:/i.test(b) || plainLen < 50;
  if (key === "stepByStep") return !/Step\s*1:/i.test(b) || !/Exam link:/i.test(b);
  if (key === "interactiveDiagram") {
    return !/Hotspots/i.test(b) || !/Labels to use:/i.test(b) || !/Answer key:/i.test(b);
  }
  if (key === "examTip") {
    const plain = stripHtmlToPlain(b);
    if (plain.length < 120) return true;
    if (!/🌍\s*why this matters/i.test(b)) return true;
    if (!/🎯\s*premium\s+exam\s+tip/i.test(b)) return true;
    if (!/\bweak answer\s*:/i.test(plain)) return true;
    if (!/\bbetter answer\s*:/i.test(plain)) return true;
    if (!/\bfull-mark answer\s*:/i.test(plain)) return true;
    return false;
  }
  if (key === "workedExample") {
    return (
      !/Question\s*:/i.test(b) ||
      !/Answer\s*:/i.test(b) ||
      (!/<details/i.test(b) && plainLen < 40)
    );
  }
  if (key === "finalMemoryRule") {
    if (!/💡|key insight/i.test(b)) return true;
    return plainLen < 35;
  }
  if (key === "examPractice") return !/\bQ1\b/i.test(b) || !/\bQ4\b/i.test(b);
  if (key === "summary") return plainLen < 80;
  if (key === "keywords") {
    if (keywordsBodyIsSubstantive(b)) return false;
    return plainLen < 120;
  }
  if (key === "objectives" || key === "priorKnowledge") return plainLen < 80;
  if (key === "commonMistake") return plainLen < 50;
  if (key === "scenario" && isTeacherFirstSs1Enabled()) {
    return /\bimagine\b/i.test(b) || /\bquestion to carry\b/i.test(b) || plainLen < 30;
  }
  return plainLen < 22;
}

/**
 * Forces canonical SS1 blocks (20 classic / 24 teacher-first) with titles + Paste into lines.
 * Preserves prelude/PAGE chunks; maps model block bodies by position; pads thin slots from templates.
 */
function normalizeToCanonicalSs1Shell(text, topicLabel, fixes, keywordContext) {
  const canonicalSlots = resolveSs1CanonicalSlots();
  const coreTeachingOverflowIndex = getCoreTeachingOverflowSlotIndex();
  const chunks = lessonChunks(text);
  const prelude = [];
  const modelBlocks = [];
  for (const c of chunks) {
    if (c.kind === "block") modelBlocks.push(c.text);
    else prelude.push(c);
  }

  const hasPage = prelude.some((c) => c.kind === "page");
  let structuralChange = !hasPage || modelBlocks.length !== canonicalSlots.length;
  if (!hasPage) prelude.unshift({ kind: "page", text: "PAGE 1" });

  let mergedOverflow = "";
  const bodiesBySlotKey = indexModelBlockBodiesBySlotKey(modelBlocks);
  if (modelBlocks.length > canonicalSlots.length) {
    structuralChange = true;
    mergedOverflow = modelBlocks
      .slice(canonicalSlots.length)
      .filter((blockText) => !slotKeyFromBlockHeader(blockText))
      .map((blockText) => splitBlockHeaderPasteBody(blockText).body.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  let thinReplaced = false;
  const outBlocks = [];

  for (let i = 0; i < canonicalSlots.length; i++) {
    const slot = canonicalSlots[i];
    const num = i + 1;
    const header = `${num} — ${slot.title}\nPaste into: ${slot.paste}`;

    let body = bodiesBySlotKey[slot.key] || "";
    if (!body && modelBlocks[i]) {
      const positionalKey = slotKeyFromBlockHeader(modelBlocks[i]);
      if (!positionalKey || positionalKey === slot.key) {
        body = splitBlockHeaderPasteBody(modelBlocks[i]).body.trim();
      }
    }

    if (i === coreTeachingOverflowIndex && mergedOverflow) {
      body = body ? `${body}\n\n${mergedOverflow}` : mergedOverflow;
      mergedOverflow = "";
      structuralChange = true;
    }

    if (isThinBodyForSlot(body, i)) {
      body = defaultBodyForSlot(i, topicLabel, keywordContext, text);
      thinReplaced = true;
    }

    outBlocks.push({
      kind: "block",
      text: `${header}\n\n${body.trim()}`.trimEnd(),
    });
  }

  const merged = rebuildLesson([...prelude, ...outBlocks]);
  if ((structuralChange || thinReplaced) && fixes) {
    fixes.push(
      `Applied canonical SS1 block shell (${canonicalSlots.length} blocks, headers, paste targets).`
    );
  }
  return merged;
}

/**
 * Public entry: canonical shell only (same merge as auto-fix step 0).
 */
export function normalizeLessonToCanonicalSs1(text = "", topic = "", subject = "Biology", topicKey = "") {
  const fixesApplied = [];
  const topicLabel = sanitizeTopic(topic || subject || "This topic");
  const keywordContext = buildKeywordContext({ topic: topicLabel, topicKey, subject });
  const t = norm(text).trimEnd();
  if (!t) return { text: "", fixesApplied };
  return {
    text: normalizeToCanonicalSs1Shell(t, topicLabel, fixesApplied, keywordContext),
    fixesApplied,
  };
}

const MAX_TEACHING_P_LEN = 220;

function splitPlainIntoSentences(plain) {
  const trimmed = String(plain || "").trim();
  if (!trimmed) return [];
  const parts = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  return parts ? parts.map((s) => s.trim()).filter(Boolean) : [trimmed];
}

function groupSentencesForChunking(sentences, maxLen) {
  const out = [];
  let buf = "";
  for (const s of sentences) {
    const next = buf ? `${buf} ${s}` : s;
    if (next.length > maxLen && buf) {
      out.push(buf);
      buf = s;
    } else {
      buf = next;
    }
  }
  if (buf) out.push(buf);
  return out;
}

/** Split very long <p> / <li> into shorter pieces (≈3 lines max). */
function chunkTeachingHtml(html) {
  let out = String(html || "");

  out = out.replace(/<p(\s[^>]*)?>([\s\S]*?)<\/p>/gi, (full, _attrs, inner) => {
    if (/<(ul|ol|table|h\d)\b/i.test(inner)) return full;
    const plain = stripHtmlToPlain(inner).trim();
    if (plain.length <= MAX_TEACHING_P_LEN) return full;
    const sentences = splitPlainIntoSentences(plain);
    const groups = groupSentencesForChunking(sentences, MAX_TEACHING_P_LEN);
    if (groups.length <= 1) return full;
    if (groups.length >= 4) {
      const first = groups[0];
      const last = groups[groups.length - 1];
      const mid = groups.slice(1, -1);
      return (
        `<p>${escapeHtmlInline(first)}</p>\n` +
        `<ul>\n${mid.map((g) => `<li>${escapeHtmlInline(g)}</li>`).join("\n")}\n</ul>\n` +
        `<p>${escapeHtmlInline(last)}</p>`
      );
    }
    return groups.map((g) => `<p>${escapeHtmlInline(g)}</p>`).join("\n");
  });

  out = out.replace(/<li(\s[^>]*)?>([\s\S]*?)<\/li>/gi, (full, _attrs, inner) => {
    if (/<(ul|ol|p|h\d)\b/i.test(inner)) return full;
    const plain = stripHtmlToPlain(inner).trim();
    if (plain.length <= MAX_TEACHING_P_LEN) return full;
    const sentences = splitPlainIntoSentences(plain);
    const groups = groupSentencesForChunking(sentences, MAX_TEACHING_P_LEN);
    if (groups.length <= 1) return full;
    return groups.map((g) => `<li>${escapeHtmlInline(g)}</li>`).join("\n");
  });

  return out;
}

function teachingBlockFirstLineExcludesTextConcept(firstLine = "") {
  const fl = String(firstLine || "").toLowerCase();
  return (
    /\blesson\s+objectives\b/.test(fl) ||
    /\bprior\s+knowledge\b/.test(fl) ||
    /\bexam\s+practice\b/.test(fl) ||
    /(^|\s)summary(\s|$)/i.test(fl)
  );
}

function isCoreTeachingPasteTarget(pasteLine = "", firstLine = "") {
  const p = String(pasteLine || "").toLowerCase();
  if (isCheckpointBlockPaste(p)) return false;
  if (/\bkey\s+words\b/.test(p)) return false;
  if (p.includes("hook (text)")) return false;
  if (p.includes("exam tip")) return false;
  if (p.includes("final memory rule")) return false;
  if (p.includes("synthesis (key idea)")) return false;
  if (p.includes("self-check")) return false;
  if (p.includes("common mistake")) return false;
  if (p.includes("worked example")) return false;
  if (p.includes("diagram (concept)")) return false;
  if (p.includes("step-by-step")) return false;
  if (p.includes("interactive diagram")) return false;
  if (p.includes("drag and drop")) return false;

  if (p.includes("core rule (key idea)") || /\bcore\s+rule\b/.test(p)) return true;
  if (p.includes("what to notice") || /what\s+to\s+notice/.test(p)) return true;
  if (p.includes("deeper knowledge")) return true;
  if (p.includes("text (concept)")) {
    if (teachingBlockFirstLineExcludesTextConcept(firstLine)) return false;
    return true;
  }
  return false;
}

function countFingerPointers(html) {
  return (String(html).match(/👉/g) || []).length;
}

function upgradeTeachingBlockBody(body) {
  const raw = String(body || "").trim();
  if (!stripHtmlToPlain(raw)) return body;

  let html = norm(raw);
  const before = norm(raw);

  html = chunkTeachingHtml(html);

  if (!/let's build this step by step\.?/i.test(html)) {
    html = `<p>Let's build this step by step.</p>\n\n${html}`;
  }

  if (!/let's think/i.test(html)) {
    html = `${html}\n\n<p>Let's think about how this idea connects to what examiners reward.</p>`;
  }
  if (!/notice that/i.test(html)) {
    html = `${html}\n\n<p>Notice that a strong answer names the idea <em>and</em> explains it.</p>`;
  }
  if (!/this is important because/i.test(html)) {
    html = `${html}\n\n<p>This is important because the marks are in the explanation chain, not the headline.</p>`;
  }

  if (!/so what does this mean in an exam\??/i.test(html)) {
    html = `${html}\n\n<p>👉 So what does this mean in an exam?</p>`;
  }

  if (!/think\s+like\s+an\s+examiner/i.test(html)) {
    html = `${html}\n\n<h3><strong>Think like an examiner:</strong></h3>\n<p>👉 A full-mark answer must clearly link cause → process → effect.</p>`;
  }

  let n = countFingerPointers(html);
  const extras = [
    "<p>👉 Say it aloud like you're teaching a partner: cause, then process, then effect.</p>",
    "<p>👉 If you're stuck, start with one clear \"because…\" and build outward.</p>",
    "<p>👉 Tick the link: did you connect the mechanism to the outcome?</p>",
  ];
  let ex = 0;
  while (n < 3 && ex < extras.length) {
    html = `${html}\n\n${extras[ex]}`;
    ex++;
    n = countFingerPointers(html);
  }

  if (norm(html) === before) return body;
  return html;
}

/**
 * Enforces classroom-style delivery in Text (concept) teaching, Core rule, Deeper knowledge, What to Notice.
 * Skips checkpoints, keywords, diagrams, and interactives by paste target.
 */
function ensureStructuredTeachingBlocks(text, fixes) {
  const chunks = lessonChunks(norm(text));
  let anyChanged = false;

  const next = chunks.map((c) => {
    if (c.kind !== "block") return c;
    const lines = c.text.split("\n");
    const firstLine = (lines[0] || "").trim();
    const paste = blockPasteLine(c.text);
    if (!isCoreTeachingPasteTarget(paste, firstLine)) return c;

    const { headerLines, body } = splitBlockHeaderPasteBody(c.text);
    const upgraded = upgradeTeachingBlockBody(body);
    if (norm(upgraded) === norm(body)) return c;

    anyChanged = true;
    const newText =
      headerLines.join("\n") + (upgraded.trim() ? "\n\n" + upgraded.trim() : "") + "\n";
    return { kind: "block", text: newText.trimEnd() };
  });

  if (!anyChanged) return text;
  fixes.push("Upgraded explanation to teacher-delivery style.");
  return rebuildLesson(next);
}

/** Main entry */
export function deterministicAutoFixLesson({
  text = "",
  subject = "Biology",
  keyStage: _ks = "",
  examBoard: _eb = "",
  topic = "",
  topicKey = "",
} = {}) {
  const fixesApplied = [];

  let working = norm(text).trimEnd();
  if (!working.trim()) return { text: "", fixesApplied: ["Empty draft — nothing to fix."] };

  const topicLabel = sanitizeTopic(topic || subject || "This topic");
  const keywordContext = buildKeywordContext({ topic: topicLabel, topicKey, subject });

  working = normalizeToCanonicalSs1Shell(working, topicLabel, fixesApplied, keywordContext);

  working = repairCheckpointBlocks(working, topicLabel, fixesApplied);
  working = injectTwoCheckpoints(working, topicLabel, fixesApplied);
  working = repairCheckpointBlocks(working, topicLabel, fixesApplied);

  working = ensureObjectives(working, topicLabel, fixesApplied);
  working = ensurePriorKnowledge(working, fixesApplied);

  const scopeFix = ensureObjectiveScopeCompliance(
    working,
    { topic: topicLabel, topicKey, subTopic: topicLabel },
    fixesApplied
  );
  working = scopeFix.text;

  const checkpointFix = ensureCheckpointScopeCompliance(
    working,
    { topic: topicLabel, topicKey, subTopic: topicLabel },
    fixesApplied
  );
  working = checkpointFix.text;

  const examFix = ensureExamPracticeScopeCompliance(
    working,
    { topic: topicLabel, topicKey, subTopic: topicLabel },
    fixesApplied
  );
  working = examFix.text;

  const summaryFix = ensureSummaryScopeCompliance(
    working,
    { topic: topicLabel, topicKey, subTopic: topicLabel },
    fixesApplied
  );
  working = summaryFix.text;

  working = ensureSingleKeyInsight(working, topicLabel, fixesApplied);

  const memoryRuleFix = ensureMemoryRuleScopeCompliance(
    working,
    { topic: topicLabel, topicKey, subTopic: topicLabel },
    fixesApplied
  );
  working = memoryRuleFix.text;

  working = ensureTeacherSpeak(working, fixesApplied);
  working = ensureWhyThisMatters(working, fixesApplied);
  working = ensurePremiumExamTip(working, fixesApplied);

  working = ensurePasteBlockAbsent(
    working,
    "drag and drop match",
    templateDragDrop,
    fixesApplied,
    "Inserted Drag and drop match block."
  );

  working = ensurePasteBlockAbsent(
    working,
    "interactive diagram",
    templateInteractiveDiagram,
    fixesApplied,
    "Inserted Interactive diagram block."
  );

  working = ensurePasteBlockAbsent(
    working,
    "diagram (concept)",
    () => templateDiagramConcept(topicLabel),
    fixesApplied,
    "Inserted Diagram (concept) block for diagram count."
  );

  working = ensurePasteBlockAbsent(
    working,
    "step-by-step diagram (process)",
    () => templateStepByStep(topicLabel),
    fixesApplied,
    "Inserted Step-by-step diagram block."
  );

  working = ensureExactlyTenKeywords(working, keywordContext, fixesApplied);

  working = ensureAnswerQualityModelling(working, topicLabel, fixesApplied);

  working = ensureStructuredTeachingBlocks(working, fixesApplied);

  working = renumberBlocks(working);
  fixesApplied.push("Renumbered all numbered SS1 blocks sequentially.");

  const examFixFinal = ensureExamPracticeScopeCompliance(
    working,
    { topic: topicLabel, topicKey, subTopic: topicLabel },
    fixesApplied
  );
  working = examFixFinal.text;

  const keyWordsGate = evaluateKeyWordsAuthorityGate(working, {
    usedGenericFallback: keywordContext.usedGenericFallback,
  });

  const objectivesGate = evaluateObjectivesAuthorityGate(working, {
    topic: topicLabel,
    topicKey,
    subTopic: topicLabel,
    subTopicProfile: scopeFix.profile,
    usedScopeAutofix: Boolean(scopeFix.profile),
    scopeAutofixChanged: scopeFix.changed,
  });

  const checkpointGate = evaluateCheckpointAuthorityGate(working, {
    topic: topicLabel,
    topicKey,
    subTopic: topicLabel,
    subTopicProfile: checkpointFix.profile || scopeFix.profile,
  });

  const examPracticeGate = evaluateExamPracticeAuthorityGate(working, {
    topic: topicLabel,
    topicKey,
    subTopic: topicLabel,
    subTopicProfile: examFixFinal.profile || examFix.profile || scopeFix.profile,
  });

  const summaryGate = evaluateSummaryAuthorityGate(working, {
    topic: topicLabel,
    topicKey,
    subTopic: topicLabel,
    subTopicProfile: summaryFix.profile || scopeFix.profile,
  });

  const memoryRuleGate = evaluateMemoryRuleAuthorityGate(working, {
    topic: topicLabel,
    topicKey,
    subTopic: topicLabel,
    subTopicProfile: memoryRuleFix.profile || scopeFix.profile,
  });

  return {
    text: working.trim(),
    fixesApplied,
    keyWordsGate,
    objectivesGate,
    checkpointGate,
    examPracticeGate,
    summaryGate,
    memoryRuleGate,
  };
}
