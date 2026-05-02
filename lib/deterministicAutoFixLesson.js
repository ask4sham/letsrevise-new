/**
 * Deterministic SS1 lesson repairs (no LLM).
 * Uses chunk-safe edits + sequential renumbering.
 */

function norm(text = "") {
  return String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function sanitizeTopic(topic) {
  const t = String(topic || "this topic").trim() || "this topic";
  return t.replace(/\s+/g, " ").slice(0, 120);
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

export function insertBeforeSection(text = "", sectionRegex, blockText) {
  const t = norm(text);
  const rx = sectionRegex;

  const str = rx instanceof RegExp ? rx.source : String(rx);
  const flags = rx instanceof RegExp ? rx.flags.replace("g", "") + "mi" : "mi";

  const full = new RegExp(`(?:^|\\n)(?=\\d+\\s*[—\\-–]\\s+[^\\n]*${str})`, flags);
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
  const filtered = chunks.filter((c) => {
    if (c.kind !== "block") return true;
    const firstLine = c.text.split("\n")[0] || "";
    if (/💡\s*Key Insight/i.test(c.text) || /\bKEY\s*INSIGHT\b/i.test(firstLine)) {
      fixes.push(`Removed Key Insight content from block (${firstLine.trim()}).`);
      return false;
    }
    return true;
  });

  let rebuilt = rebuildLesson(filtered);

  rebuilt = rebuilt.replace(
    /<p>\s*(?:<[^>]*>)*💡\s*Key Insight[\s\S]*?<\/p>\s*(?:\n|$)/gi,
    ""
  );
  rebuilt = rebuilt.replace(
    /<p[^>]*><strong[^>]*>💡\s*Key Insight<\/strong>[\s\S]*?<\/p>\s*/gi,
    ""
  );

  return rebuilt;
}

function ensureSingleKeyInsight(text, topic, fixes) {
  let t = norm(text);
  t = stripKeyInsightBlocks(t, fixes);

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
    "0 — LESSON OBJECTIVES",
    "Paste into: Text (concept)",
    "",
    "<p><strong>👉 🎯 Lesson Objectives</strong></p>",
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
      fixes.push("Replaced Lesson Objectives (too few bullets or list items).");
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
  fixes.push("Inserted Lesson Objectives block (PAGE 1 or start).");
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
      /\bLESSON\s+OBJECTIVES\b/i.test(c.text.split("\n")[0] || "")
  );

  let insertAfter = chunks.findIndex(
    (c) =>
      c.kind === "block" &&
      /\blesson\s+objectives\b/i.test((c.text.split("\n")[0] || "").toLowerCase())
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

function keywordFallbackRows(topic, count) {
  const t = sanitizeTopic(topic);
  const base = [
    { term: "Cause", def: "Why something happens in this topic." },
    { term: "Effect", def: "What changes as an outcome." },
    { term: "Structure", def: "How parts fit together visually or logically." },
    { term: "Function", def: "What something does during the process." },
    { term: "Keyword", def: "A precise term examiners reward when explained." },
    { term: "Explain", def: `Give reasoning, not just naming from ${t.slice(0, 40)}.` },
    {
      term: "Compare",
      def: "Identify similarities and differences linked to consequences.",
    },
    { term: "Evidence", def: "A reasoning step that proves the answer." },
    { term: "Misconception", def: "A common confusion corrected in clear prose." },
    { term: "Mark scheme", def: "Shows what examiners reward in your explanation." },
  ];

  const rows = [];
  for (let i = 0; i < count; i++) {
    const b = base[i % base.length];
    const termName = i < base.length ? b.term : `${b.term} (${i + 1})`;
    rows.push({ term: termName, def: b.def });
  }
  return rows;
}

function extractKeywordLines(htmlish = "") {
  const raw = norm(htmlish);
  const rows = [];

  raw.split(/\n/).forEach((line) => {
    let m =
      /<strong([^>]*)>([^<]+)<\/strong>\s*[–\-]\s*(.+)$/i.exec(line.trim()) ||
      /<strong([^>]*)>([^<]+)<\/strong>\s*-\s*(.+)$/i.exec(line.trim());
    if (!m && /\*{2}.+\*{2}/.test(line)) {
      m = /\*{2}\s*(.+?)\*{2}\s*[–\-]\s*(.+)$/i.exec(line.trim());
      if (m) rows.push({ term: m[1].trim(), def: m[2].trim() });
      return;
    }
    if (m) rows.push({ term: (m[2] || "").trim(), def: (m[3] || "").trim() });
    else {
      const plain = /^(.+?)\s*[–\-]\s*(.+)$/.exec(line.replace(/^-\s*/, "").trim());
      if (plain && plain[1].length < 60)
        rows.push({ term: plain[1].trim(), def: plain[2].trim() });
    }
  });

  if (rows.length === 0) {
    raw.replace(
      /<li[^>]*>([\s\S]*?)<\/li>/gi,
      (_, inner) => {
        const stripped = inner
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const dash = stripped.split(/\s*[–\-]\s*/);
        if (dash.length === 2) rows.push({ term: dash[0].trim(), def: dash[1].trim() });
        else if (stripped.length) rows.push({ term: stripped.slice(0, 40), def: stripped });
        return "";
      }
    );
  }

  return rows.slice(0, 12);
}

function ensureExactlyTenKeywords(text, topic, fixes) {
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
    const rows = keywordFallbackRows(topic, 10);
    const block = [
      "0 — KEY WORDS",
      "Paste into: Key words",
      "",
      '<p><strong>👉 Keywords</strong></p>',
      rowsToLines(rows),
      "",
    ].join("\n");

    fixes.push("Inserted Keywords block with exactly 10 terms.");
    return insertBeforeSection(rebuildLesson(chunks), /EXAM\s+PRACTICE/i, block);
  }

  let rows = extractKeywordLines(chunks[kwIx].text).slice(0, 10);
  rows = rows.map((r) => ({ term: String(r.term).trim(), def: String(r.def).trim() }));

  let fbIndex = 0;
  const pad = keywordFallbackRows(topic, 20);
  while (rows.length < 10) {
    rows.push({ term: pad[fbIndex].term, def: pad[fbIndex].def });
    fbIndex++;
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

  fixes.push("Normalised Keywords to exactly 10 term–definition lines.");
  chunks[kwIx] = { kind: "block", text: rebuiltBlock };
  return rebuildLesson(chunks);
}

/** Main entry */
export function deterministicAutoFixLesson({
  text = "",
  subject = "Biology",
  keyStage: _ks = "",
  examBoard: _eb = "",
  topic = "",
} = {}) {
  const fixesApplied = [];

  let working = norm(text).trimEnd();
  if (!working.trim()) return { text: "", fixesApplied: ["Empty draft — nothing to fix."] };

  const topicLabel = sanitizeTopic(topic || subject || "This topic");

  working = repairCheckpointBlocks(working, topicLabel, fixesApplied);
  working = injectTwoCheckpoints(working, topicLabel, fixesApplied);
  working = repairCheckpointBlocks(working, topicLabel, fixesApplied);

  working = ensureObjectives(working, topicLabel, fixesApplied);
  working = ensurePriorKnowledge(working, fixesApplied);

  working = ensureSingleKeyInsight(working, topicLabel, fixesApplied);

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

  working = ensureExactlyTenKeywords(working, topicLabel, fixesApplied);

  working = renumberBlocks(working);
  fixesApplied.push("Renumbered all numbered SS1 blocks sequentially.");

  return {
    text: working.trim(),
    fixesApplied,
  };
}
