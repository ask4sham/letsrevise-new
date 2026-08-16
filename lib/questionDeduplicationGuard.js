/**
 * Question deduplication guard — generator-only (SS1 lesson text).
 * Prevents duplicate / near-duplicate / repeated generic questions across checkpoints,
 * quick checks, self-checks, worked examples, and exam-practice MCQs.
 */

const { replaceBlockAtSpan } = require("./teacherBrain/scopeBlockUtils.js");

const GENERIC_STEM_PATTERNS = [
  /^which statement best (explains|matches)/i,
  /^explain one key idea about/i,
  /^what should a strong exam answer usually include/i,
  /^which statement best matches this topic/i,
  /^which statement is correct\??$/i,
  /^what is the correct answer\??$/i,
  /^which option is most accurate/i,
  /^which option is most accurate about/i,
  /^a correct statement about/i,
  /^self[\-\s]?check:\s*can you explain .+ without only naming terms/i,
  /precise cause\s*→\s*effect explanation linked to the topic/i,
  /unrelated process from another topic/i,
  /vague name with no mechanism/i,
];

/** Cross-role (e.g. selfCheck ↔ checkpoint) near-duplicate threshold. */
const CROSS_ROLE_NEAR_DUP_THRESHOLD = 0.72;
/** Same-role / default near-duplicate threshold. */
const SAME_ROLE_NEAR_DUP_THRESHOLD = 0.82;
/** Option-set similarity threshold. */
const OPTION_SET_NEAR_DUP_THRESHOLD = 0.85;

const BLOOD_GLUCOSE_MCQS = [
  {
    question: "When blood glucose rises above the set point, which hormone does the pancreas release?",
    options: [
      "Glucagon",
      "Insulin",
      "Adrenaline",
      "Thyroxine",
    ],
    answer: "Insulin",
  },
  {
    question: "When blood glucose falls below the set point, which hormone is released to raise it?",
    options: [
      "Insulin",
      "Glucagon",
      "ADH",
      "Oestrogen",
    ],
    answer: "Glucagon",
  },
  {
    question: "Where is excess glucose stored in the body when insulin is active?",
    options: [
      "Kidney as urea",
      "Liver as glycogen",
      "Lungs as carbon dioxide",
      "Skin as sweat",
    ],
    answer: "Liver as glycogen",
  },
  {
    question: "When blood glucose returns to normal, what happens to insulin secretion?",
    options: [
      "It increases further",
      "It decreases through negative feedback",
      "It stops permanently",
      "It is replaced by glucagon only",
    ],
    answer: "It decreases through negative feedback",
  },
  {
    question: "Which organ detects changes in blood glucose concentration?",
    options: [
      "Liver",
      "Pancreas",
      "Brain",
      "Heart",
    ],
    answer: "Pancreas",
  },
  {
    question: "Which statement best describes the roles of insulin and glucagon?",
    options: [
      "Both hormones raise blood glucose",
      "Insulin lowers blood glucose; glucagon raises it",
      "Both hormones lower blood glucose",
      "Glucagon stores glucose as glycogen in muscle only",
    ],
    answer: "Insulin lowers blood glucose; glucagon raises it",
  },
];

const BLOOD_GLUCOSE_SELF_CHECKS = [
  "<p><strong>Self-check:</strong> explain how <strong>insulin</strong> lowers blood glucose after a meal.</p>",
  "<p><strong>Self-check:</strong> explain when <strong>glucagon</strong> is released and how it affects glycogen in the liver.</p>",
  "<p><strong>Self-check:</strong> describe <strong>negative feedback</strong> when blood glucose returns to the set point.</p>",
];

const BLOOD_GLUCOSE_WORKED = [
  "Explain how the pancreas uses insulin and glucagon to control blood glucose (4 marks).",
  "Describe what happens when blood glucose rises after eating a meal (3 marks).",
  "Explain why negative feedback reduces hormone secretion when blood glucose is normal (3 marks).",
];

function stripHtml(html = "") {
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeQuestionStem(text = "") {
  return stripHtml(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fingerprint normalisation ÔÇö must match frontend questionStemSimilarity.ts exactly. */
function normalizeQuestionStemForFingerprint(text = "") {
  return stripHtml(text)
    .toLowerCase()
    .replace(/[.,?!;:'"()[\]{}\-ÔÇôÔÇö]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mcqFingerprintFromStemAndAnswer(stem = "", answer = "") {
  return `${normalizeQuestionStemForFingerprint(stem)}|${normalizeQuestionStemForFingerprint(answer)}`;
}

function tokenSet(stem) {
  return new Set(
    normalizeQuestionStem(stem)
      .split(" ")
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a, b) {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (!sa.size && !sb.size) return 1;
  let inter = 0;
  for (const w of sa) {
    if (sb.has(w)) inter++;
  }
  const union = sa.size + sb.size - inter;
  return union ? inter / union : 0;
}

function isGenericPlaceholderStem(stem = "") {
  const plain = stripHtml(stem).trim();
  if (!plain) return false;
  return GENERIC_STEM_PATTERNS.some((re) => re.test(plain));
}

function questionsAreNearDuplicate(a, b, threshold = SAME_ROLE_NEAR_DUP_THRESHOLD) {
  const na = normalizeQuestionStem(a);
  const nb = normalizeQuestionStem(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 20 && nb.length >= 20) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  const t = typeof threshold === "number" ? threshold : SAME_ROLE_NEAR_DUP_THRESHOLD;
  return jaccardSimilarity(na, nb) >= t;
}

function extractMcqQuestionLine(body = "") {
  const m = /^Question:\s*(.+)$/im.exec(String(body));
  return m ? m[1].trim() : "";
}

function extractQuestionStemFromBlock(body = "", kind = "") {
  const b = String(body || "");
  const mcqQ = extractMcqQuestionLine(b);
  if (mcqQ) return mcqQ;

  if (kind === "workedExample") {
    const wm = /^Question:\s*(.+)$/im.exec(b);
    if (wm) return wm[1].trim();
  }

  const plain = stripHtml(b);
  if (kind === "selfCheck" && /self[\-\s]?check/i.test(plain)) {
    return plain;
  }

  if (kind === "examPractice") {
    const qMatch = plain.match(/Q\d+\s*\(\d+\s*mark[s]?\)\s*(.+?)(?=Q\d+|$)/i);
    if (qMatch) return qMatch[1].trim().slice(0, 200);
  }

  return plain.slice(0, 240);
}

function formatMcqBody({ question, options, answer }) {
  const lines = ["Question:", question, ""];
  options.forEach((opt, i) => {
    lines.push(`Option ${i + 1}:`, opt, "");
  });
  lines.push("Answer:", answer);
  return lines.join("\n");
}

function isBloodGlucoseTopic(topic = "", topicKey = "") {
  const hay = `${topic} ${topicKey}`.toLowerCase();
  return (
    /blood\s*glucose|glucose\s*control|control\s+of\s+body\s+temperature|homeostasis|insulin|glucagon|glycogen|osmoregulation|thermoregulation/.test(
      hay
    ) && !/nervous\s+system|neurone|reflex|stimulus/.test(hay)
  );
}

function genericMcqAlternatives(topicLabel) {
  const t = String(topicLabel || "this topic").trim();
  return [
    {
      question: `Which idea best explains a key step in ${t}?`,
      options: [
        "A named mechanism with a clear outcome",
        "A response with no biological mechanism",
        "Only naming keywords without explanation",
        "Unrelated process from another topic",
      ],
      answer: "A named mechanism with a clear outcome",
    },
    {
      question: `What should a strong GCSE answer about ${t} include?`,
      options: [
        "Only a single keyword",
        "Named mechanism linked with because / therefore",
        "A diagram with no words",
        "A guess without evidence",
      ],
      answer: "Named mechanism linked with because / therefore",
    },
    {
      question: `Which statement about ${t} is exam-ready?`,
      options: [
        "Vague description with no mechanism",
        "Precise terms in a clear cause → effect sequence",
        "Unrelated example from another unit",
        "Only a definition with no application",
      ],
      answer: "Precise terms in a clear cause → effect sequence",
    },
  ];
}

function getTopicMcqPool(topicLabel, topicKey) {
  if (isBloodGlucoseTopic(topicLabel, topicKey)) return BLOOD_GLUCOSE_MCQS.slice();
  return genericMcqAlternatives(topicLabel);
}

function getTopicSelfCheckPool(topicLabel, topicKey) {
  if (isBloodGlucoseTopic(topicLabel, topicKey)) return BLOOD_GLUCOSE_SELF_CHECKS.slice();
  const t = String(topicLabel || "this topic").trim();
  return [
    `<p><strong>Self-check:</strong> explain one <strong>cause → effect</strong> link for <strong>${t}</strong>.</p>`,
    `<p><strong>Self-check:</strong> name one common mistake students make about <strong>${t}</strong> and correct it.</p>`,
  ];
}

function getTopicWorkedPool(topicLabel, topicKey) {
  if (isBloodGlucoseTopic(topicLabel, topicKey)) return BLOOD_GLUCOSE_WORKED.slice();
  const t = String(topicLabel || "this topic").trim();
  return [
    `Explain a key process linked to ${t} using cause → effect (3 marks).`,
    `Describe how ${t} links to an exam-style outcome (2 marks).`,
  ];
}

function splitBlockHeaderBody(blockText = "") {
  const lines = String(blockText).split("\n");
  const pasteIdx = lines.findIndex((l) => /^Paste into:/i.test(l.trim()));
  if (pasteIdx < 0) {
    return { header: lines.slice(0, 1).join("\n"), body: lines.slice(1).join("\n") };
  }
  return {
    header: lines.slice(0, pasteIdx + 1).join("\n"),
    body: lines.slice(pasteIdx + 1).join("\n"),
  };
}

function listQuestionBlocksInLesson(lessonText = "") {
  const lines = String(lessonText || "").split("\n");
  const blocks = [];

  for (let i = 0; i < lines.length; i++) {
    if (!/^(\d+)\s*[—\-–]\s+/i.test(lines[i])) continue;
    const head = lines[i];
    let kind = null;
    if (/\bCHECKPOINT\b/i.test(head) && !/QUICK/i.test(head)) kind = "checkpoint";
    else if (/\bQUICK\s+CHECK\b/i.test(head)) kind = "quickCheck";
    else if (/\bSELF[\-\s]?CHECK\b/i.test(head)) kind = "selfCheck";
    else if (/\bWORKED\s+EXAMPLE\b/i.test(head)) kind = "workedExample";
    else if (/\bEXAM\s+PRACTICE\b/i.test(head)) kind = "examPractice";

    if (!kind) continue;

    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^(\d+)\s*[—\-–]\s+/i.test(lines[j]) || /^PAGE\s+\d/i.test(lines[j].trim())) {
        end = j;
        break;
      }
    }

    const text = lines.slice(i, end).join("\n");
    const { body } = splitBlockHeaderBody(text);
    const stem = extractQuestionStemFromBlock(body, kind);

    blocks.push({
      kind,
      start: i,
      end,
      headerLine: head,
      text,
      body,
      stem,
    });
    i = end - 1;
  }

  return blocks;
}

function pickReplacementBody(kind, topicLabel, topicKey, usedStems, altIndex) {
  if (kind === "selfCheck") {
    const pool = getTopicSelfCheckPool(topicLabel, topicKey);
    for (let n = 0; n < pool.length; n++) {
      const candidate = pool[(altIndex + n) % pool.length];
      if (![...usedStems].some((s) => questionsAreNearDuplicate(s, candidate))) {
        return (
          candidate +
          "\n<details>\n<summary>Reveal Answer</summary>\n\n<p>Use a because → therefore chain with precise terms.</p>\n\n</details>\n"
        );
      }
    }
    return pool[altIndex % pool.length];
  }

  if (kind === "workedExample") {
    const pool = getTopicWorkedPool(topicLabel, topicKey);
    const question = pool[altIndex % pool.length];
    const t = String(topicLabel || "this topic").trim();
    return [
      "Question:",
      question,
      "",
      "Answer:",
      "<details>",
      "<summary>Reveal Answer</summary>",
      "",
      `<p>Link detection → hormone or mechanism → effect on <strong>${t}</strong> with precise GCSE vocabulary.</p>`,
      "",
      "</details>",
      "",
    ].join("\n");
  }

  const pool = getTopicMcqPool(topicLabel, topicKey);
  for (let n = 0; n < pool.length; n++) {
    const mcq = pool[(altIndex + n) % pool.length];
    if (![...usedStems].some((s) => questionsAreNearDuplicate(s, mcq.question))) {
      return formatMcqBody(mcq);
    }
  }
  return formatMcqBody(pool[altIndex % pool.length]);
}

function isDuplicateAgainstSeen(stem, seenStems, genericCount) {
  if (!stem || stem.length < 8) return false;

  if (isGenericPlaceholderStem(stem)) {
    return genericCount >= 1;
  }

  for (const prev of seenStems) {
    if (questionsAreNearDuplicate(stem, prev)) return true;
  }
  return false;
}

/**
 * @param {string} lessonText
 * @param {{ topic?: string, topicKey?: string }} ctx
 * @returns {{ text: string, changed: boolean, fixes: string[], duplicatesResolved: number }}
 */
function applyQuestionDeduplicationGuard(lessonText = "", ctx = {}) {
  const topicLabel = String(ctx.topic || ctx.subTopic || "This topic").trim();
  const topicKey = String(ctx.topicKey || "").trim();
  const blocks = listQuestionBlocksInLesson(lessonText);

  if (blocks.length < 2) {
    return { text: lessonText, changed: false, fixes: [], duplicatesResolved: 0 };
  }

  const seenStems = [];
  let genericCount = 0;
  let altIndex = 0;
  const toReplace = [];

  for (const block of blocks) {
    const stem = block.stem;
    const duplicate = isDuplicateAgainstSeen(stem, seenStems, genericCount);

    if (!duplicate) {
      if (stem) seenStems.push(stem);
      if (isGenericPlaceholderStem(stem)) genericCount++;
      continue;
    }

    const newBody = pickReplacementBody(block.kind, topicLabel, topicKey, seenStems, altIndex);
    altIndex++;
    const { header } = splitBlockHeaderBody(block.text);
    const newBlock = `${header}\n\n${newBody.trim()}\n`;
    const newStem = extractQuestionStemFromBlock(newBody, block.kind);

    toReplace.push({ block, newBlock, newStem, oldStem: stem });
    if (newStem) seenStems.push(newStem);
    if (isGenericPlaceholderStem(newStem)) genericCount++;
  }

  if (!toReplace.length) {
    return { text: lessonText, changed: false, fixes: [], duplicatesResolved: 0, replacements: [] };
  }

  let working = lessonText;
  const replacements = [];
  toReplace
    .sort((a, b) => b.block.start - a.block.start)
    .forEach(({ block, newBlock, newStem, oldStem }) => {
      working = replaceBlockAtSpan(working, block, newBlock);
      replacements.push({ kind: block.kind, from: oldStem.slice(0, 80), to: newStem.slice(0, 80) });
    });

  const fixes = [
    `Question deduplication: replaced ${replacements.length} duplicate or generic repeated question(s).`,
  ];

  return {
    text: working,
    changed: true,
    fixes,
    duplicatesResolved: replacements.length,
    replacements,
  };
}

function classifyJsonBlockRole(block) {
  const role = String(block?.role || "").toLowerCase();
  const type = String(block?.type || "").toLowerCase();
  if (type === "selfcheck") return "selfCheck";
  if (type === "pagequiz" || type === "page-quiz") return "pageQuiz";
  if (type === "examquestion" || type === "exam-question") return "examQuestion";
  if (role === "quickcheck") return "quickCheck";
  if (role === "workedexample") return "workedExample";
  if (role === "exampractice" || /exam practice/i.test(String(block?.content || ""))) {
    return "examPractice";
  }
  if (type === "checkpoint") return "checkpoint";
  return null;
}

function extractStemFromJsonBlock(block, role) {
  if (!block) return "";
  if (role === "examPractice") {
    const plain = stripHtml(block.content || "");
    const m = plain.match(/(?:exam practice|q\d+)\s*(?:\([^)]*\))?\s*[:.]?\s*(.+?)(?=model answer|mark scheme|$)/i);
    if (m) return m[1].trim().slice(0, 240);
    return plain.slice(0, 240);
  }
  const stem =
    block.prompt ||
    block.question ||
    block.stem ||
    (typeof block.content === "string" && !/<details/i.test(block.content)
      ? stripHtml(block.content).slice(0, 240)
      : "");
  return String(stem || "").trim();
}

function normalizeOptionsKey(options = []) {
  return (Array.isArray(options) ? options : [])
    .map((o) => normalizeQuestionStem(o))
    .filter(Boolean)
    .sort()
    .join("|");
}

function extractActivityQuestionsFromJsonBlock(block) {
  const out = [];
  if (!block || typeof block !== "object") return out;
  if (Array.isArray(block.questions) && block.questions.length) {
    for (const q of block.questions) {
      if (!q || typeof q !== "object") continue;
      const stem = String(q.prompt || q.question || q.stem || q.questionText || "").trim();
      const answer = String(q.correctAnswer || q.answer || "").trim();
      const options = Array.isArray(q.options)
        ? q.options.map((o) => String(o ?? "")).filter(Boolean)
        : [];
      if (stem) out.push({ stem, answer, options });
    }
    if (out.length) return out;
  }
  const stem = String(block.prompt || block.question || block.stem || "").trim();
  const answer = String(block.correctAnswer || block.answer || "").trim();
  const options = Array.isArray(block.options)
    ? block.options.map((o) => String(o ?? "")).filter(Boolean)
    : [];
  if (stem) out.push({ stem, answer, options });
  return out;
}

function extractExamPracticeSectionsFromHtml(content = "") {
  const raw = String(content || "");
  const headerRe = /<p>\s*<strong>\s*Q\d+\s*\([^)]*\)\s*<\/strong>\s*<\/p>/gi;
  const headers = [];
  let match = headerRe.exec(raw);
  while (match !== null) {
    headers.push({ index: match.index });
    match = headerRe.exec(raw);
  }
  const sections = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index;
    const end = i + 1 < headers.length ? headers[i + 1].index : raw.length;
    const sectionHtml = raw.slice(start, end);
    const stemMatch = sectionHtml.match(/<\/p>\s*<p>([^<]+)<\/p>/i);
    const stem = stemMatch ? stripHtml(stemMatch[1]).trim() : "";
    const modelMatch = sectionHtml.match(/Model answer:<\/strong><\/p>\s*<p>([^<]+)/i);
    const answer = modelMatch ? stripHtml(modelMatch[1]).trim() : "";
    if (stem) sections.push({ stem, answer, options: [] });
  }
  return sections;
}

const INLINE_ACTIVITY_ROLES = new Set(["pageQuiz", "selfCheck", "checkpoint", "quickCheck"]);

/**
 * Collect stem+answer fingerprints from inline activity blocks across lesson pages.
 * Used by attach-page-quiz-from-bank idempotent dedup (does not mutate lesson JSON).
 */
function collectInlineActivityFingerprintsFromPages(pages = []) {
  const seen = new Set();
  const list = Array.isArray(pages) ? pages : [];
  for (const page of list) {
    const legacyCp = page?.checkpoint;
    if (legacyCp && typeof legacyCp === "object") {
      for (const q of extractActivityQuestionsFromJsonBlock({ type: "checkpoint", ...legacyCp })) {
        const fp = mcqFingerprintFromStemAndAnswer(q.stem, q.answer);
        if (fp !== "|") seen.add(fp);
        const ns = normalizeQuestionStemForFingerprint(q.stem);
        if (ns) seen.add(`stem:${ns}`);
      }
    }
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    for (const block of blocks) {
      const role = classifyJsonBlockRole(block);
      if (!role || !INLINE_ACTIVITY_ROLES.has(role)) continue;
      for (const q of extractActivityQuestionsFromJsonBlock(block)) {
        const fp = mcqFingerprintFromStemAndAnswer(q.stem, q.answer);
        if (fp !== "|") seen.add(fp);
        const ns = normalizeQuestionStemForFingerprint(q.stem);
        if (ns) seen.add(`stem:${ns}`);
      }
    }
  }
  return seen;
}

/**
 * Collect question-like items from JSON lesson pages.
 * @returns {Array<{ pageIndex: number, blockIndex: number, role: string, stem: string, options: string[], optionsKey: string, block: object }>}
 */
function extractQuestionsFromLessonPages(pages = []) {
  const out = [];
  const list = Array.isArray(pages) ? pages : [];
  for (let pi = 0; pi < list.length; pi++) {
    const blocks = Array.isArray(list[pi]?.blocks) ? list[pi].blocks : [];
    for (let bi = 0; bi < blocks.length; bi++) {
      const block = blocks[bi];
      const role = classifyJsonBlockRole(block);
      if (!role) continue;

      if (role === "examPractice") {
        const sections = extractExamPracticeSectionsFromHtml(block.content || "");
        for (const sec of sections) {
          if (!sec.stem || sec.stem.length < 8) continue;
          out.push({
            pageIndex: pi,
            blockIndex: bi,
            role,
            stem: sec.stem,
            options: sec.options || [],
            optionsKey: normalizeOptionsKey(sec.options || []),
            block,
          });
        }
        continue;
      }

      if (INLINE_ACTIVITY_ROLES.has(role)) {
        const activityQs = extractActivityQuestionsFromJsonBlock(block);
        if (activityQs.length) {
          for (const aq of activityQs) {
            if (!aq.stem || aq.stem.length < 8) continue;
            out.push({
              pageIndex: pi,
              blockIndex: bi,
              role,
              stem: aq.stem,
              options: aq.options,
              optionsKey: normalizeOptionsKey(aq.options),
              block,
            });
          }
          continue;
        }
      }

      const stem = extractStemFromJsonBlock(block, role);
      if (!stem || stem.length < 8) continue;
      const options = Array.isArray(block.options) ? block.options.map((o) => String(o ?? "")) : [];
      out.push({
        pageIndex: pi,
        blockIndex: bi,
        role,
        stem,
        options,
        optionsKey: normalizeOptionsKey(options),
        block,
      });
    }
  }
  return out;
}

function rolesNeedCrossCheck(a, b) {
  const pair = new Set([a, b]);
  if (a === b) return true;
  if (pair.has("selfCheck") && (pair.has("checkpoint") || pair.has("quickCheck"))) return true;
  if (pair.has("checkpoint") && pair.has("quickCheck")) return true;
  if (pair.has("pageQuiz") && (pair.has("checkpoint") || pair.has("selfCheck") || pair.has("quickCheck"))) {
    return true;
  }
  if (pair.has("examQuestion") && (pair.has("checkpoint") || pair.has("selfCheck") || pair.has("quickCheck"))) {
    return true;
  }
  if (pair.has("examPractice") && (pair.has("checkpoint") || pair.has("selfCheck"))) return true;
  if (pair.has("examPractice") && pair.has("pageQuiz")) return true;
  return false;
}

/**
 * Audit JSON lesson pages for duplicate / near-duplicate / generic / option-set clashes.
 * @returns {{ clean: boolean, issues: Array, questions: Array }}
 */
function auditLessonPagesDuplication(pages = [], _ctx = {}) {
  const questions = extractQuestionsFromLessonPages(pages);
  const issues = [];
  let genericSeen = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (isGenericPlaceholderStem(q.stem)) {
      genericSeen += 1;
      if (genericSeen > 1) {
        issues.push({
          kind: "generic_placeholder",
          path: `pages[${q.pageIndex}].blocks[${q.blockIndex}]`,
          role: q.role,
          stem: q.stem.slice(0, 120),
          blockIndex: q.blockIndex,
          pageIndex: q.pageIndex,
        });
      }
    }

    for (let j = 0; j < i; j++) {
      const prev = questions[j];
      const cross = rolesNeedCrossCheck(q.role, prev.role);
      const threshold =
        q.role !== prev.role ? CROSS_ROLE_NEAR_DUP_THRESHOLD : SAME_ROLE_NEAR_DUP_THRESHOLD;
      if (cross && questionsAreNearDuplicate(q.stem, prev.stem, threshold)) {
        issues.push({
          kind: "near_duplicate_stem",
          path: `pages[${q.pageIndex}].blocks[${q.blockIndex}]`,
          role: q.role,
          otherRole: prev.role,
          stem: q.stem.slice(0, 120),
          otherStem: prev.stem.slice(0, 120),
          blockIndex: q.blockIndex,
          pageIndex: q.pageIndex,
          otherBlockIndex: prev.blockIndex,
          otherPageIndex: prev.pageIndex,
        });
      }
      if (
        q.optionsKey &&
        prev.optionsKey &&
        q.optionsKey === prev.optionsKey &&
        q.options.length >= 2
      ) {
        issues.push({
          kind: "duplicate_option_set",
          path: `pages[${q.pageIndex}].blocks[${q.blockIndex}]`,
          role: q.role,
          otherRole: prev.role,
          stem: q.stem.slice(0, 80),
          blockIndex: q.blockIndex,
          pageIndex: q.pageIndex,
        });
      }
    }
  }

  return { clean: issues.length === 0, issues, questions };
}

function applyJsonReplacementToBlock(block, role, topicLabel, topicKey, usedStems, altIndex) {
  if (role === "selfCheck") {
    const pool = getTopicSelfCheckPool(topicLabel, topicKey);
    let candidate = pool[altIndex % pool.length];
    for (let n = 0; n < pool.length; n++) {
      const c = pool[(altIndex + n) % pool.length];
      if (![...usedStems].some((s) => questionsAreNearDuplicate(s, c, CROSS_ROLE_NEAR_DUP_THRESHOLD))) {
        candidate = c;
        break;
      }
    }
    const plain = stripHtml(candidate);
    block.type = "selfCheck";
    block.prompt = plain;
    block.question = plain;
    block.questionType = "short";
    block.options = [];
    block.content =
      candidate +
      ( /<details/i.test(candidate)
        ? ""
        : "\n<details>\n<summary>Reveal Answer</summary>\n\n<p>Use a because → therefore chain with precise terms.</p>\n\n</details>\n");
    block.explanation = block.content;
    return plain;
  }

  const pool = getTopicMcqPool(topicLabel, topicKey);
  let mcq = pool[altIndex % pool.length];
  for (let n = 0; n < pool.length; n++) {
    const c = pool[(altIndex + n) % pool.length];
    if (![...usedStems].some((s) => questionsAreNearDuplicate(s, c.question, CROSS_ROLE_NEAR_DUP_THRESHOLD))) {
      mcq = c;
      break;
    }
  }
  block.prompt = mcq.question;
  block.question = mcq.question;
  block.questionType = "mcq";
  block.options = mcq.options.slice();
  block.correctAnswer = mcq.answer;
  if (role === "quickCheck") block.role = "quickCheck";
  if (role === "workedExample") block.role = "workedExample";
  if (role === "checkpoint" && block.role && !/quickcheck|workedexample/i.test(String(block.role))) {
    delete block.role;
  }
  return mcq.question;
}

/**
 * Repair duplicate questions in JSON pages (mutates pages). Replaces only flagged blocks.
 * @returns {{ changed: boolean, repaired: number, remainingIssues: Array, issuesBefore: Array }}
 */
function repairLessonPagesDuplication(pages = [], ctx = {}) {
  const topicLabel = String(ctx.topic || ctx.subTopic || "This topic").trim();
  const topicKey = String(ctx.topicKey || "").trim();
  const plan = Array.isArray(ctx.plan) ? ctx.plan : [];

  const before = auditLessonPagesDuplication(pages, ctx);
  if (before.clean) {
    return { changed: false, repaired: 0, remainingIssues: [], issuesBefore: [] };
  }

  const usedStems = before.questions.map((q) => q.stem);
  const flagged = new Map();
  for (const issue of before.issues) {
    const key = `${issue.pageIndex}:${issue.blockIndex}`;
    if (!flagged.has(key)) flagged.set(key, issue);
  }

  let repaired = 0;
  let altIndex = 0;
  const list = Array.isArray(pages) ? pages : [];

  for (const [, issue] of flagged) {
    const page = list[issue.pageIndex];
    if (!page || !Array.isArray(page.blocks)) continue;
    const block = page.blocks[issue.blockIndex];
    if (!block) continue;
    const role = classifyJsonBlockRole(block) || issue.role || "checkpoint";
    const banned = usedStems.filter(
      (s) => !questionsAreNearDuplicate(s, issue.stem, CROSS_ROLE_NEAR_DUP_THRESHOLD)
    );

    // Prefer assessment-journey exemplar for this slot when it does not clash with kept stems.
    const planItem = plan.find((p) => p.slot === role);
    if (planItem?.exemplar?.question) {
      const ex = planItem.exemplar;
      const candidateStem = String(ex.question);
      const clashes = banned.some((s) =>
        questionsAreNearDuplicate(s, candidateStem, CROSS_ROLE_NEAR_DUP_THRESHOLD)
      );
      if (!clashes && !isGenericPlaceholderStem(candidateStem)) {
        if (role === "selfCheck") {
          block.type = "selfCheck";
          block.prompt = candidateStem;
          block.question = candidateStem;
          block.questionType = "short";
          block.options = [];
          block.correctAnswer = ex.answer || "";
          block.content = `<p>${candidateStem}</p>`;
        } else {
          block.prompt = candidateStem;
          block.question = candidateStem;
          block.options = Array.isArray(ex.options) ? ex.options.slice() : block.options || [];
          block.correctAnswer = ex.answer || block.correctAnswer || "";
          block.questionType = block.options?.length >= 2 ? "mcq" : "short";
        }
        usedStems.push(candidateStem);
        repaired += 1;
        altIndex += 1;
        continue;
      }
    }

    const newStem = applyJsonReplacementToBlock(
      block,
      role,
      topicLabel,
      topicKey,
      banned,
      altIndex
    );
    altIndex += 1;
    if (newStem) usedStems.push(newStem);
    repaired += 1;
  }

  const after = auditLessonPagesDuplication(pages, ctx);
  return {
    changed: repaired > 0,
    repaired,
    remainingIssues: after.issues,
    issuesBefore: before.issues,
    clean: after.clean,
  };
}

/**
 * Run audit → repair → re-audit. Returns whether the draft is clean enough to save.
 */
function enforceQuestionDiversityOnDraft(draft, ctx = {}) {
  if (!draft || !Array.isArray(draft.pages)) {
    return { clean: true, repaired: 0, issues: [], audit: { clean: true, issues: [] } };
  }
  const first = auditLessonPagesDuplication(draft.pages, ctx);
  if (first.clean) {
    return { clean: true, repaired: 0, issues: [], audit: first };
  }
  const repair = repairLessonPagesDuplication(draft.pages, ctx);
  const second = auditLessonPagesDuplication(draft.pages, ctx);
  return {
    clean: second.clean,
    repaired: repair.repaired,
    issues: second.issues,
    audit: second,
    repair,
  };
}

module.exports = {
  normalizeQuestionStem,
  normalizeQuestionStemForFingerprint,
  mcqFingerprintFromStemAndAnswer,
  collectInlineActivityFingerprintsFromPages,
  isGenericPlaceholderStem,
  questionsAreNearDuplicate,
  extractQuestionStemFromBlock,
  listQuestionBlocksInLesson,
  applyQuestionDeduplicationGuard,
  getTopicMcqPool,
  isBloodGlucoseTopic,
  formatMcqBody,
  extractQuestionsFromLessonPages,
  auditLessonPagesDuplication,
  repairLessonPagesDuplication,
  enforceQuestionDiversityOnDraft,
  CROSS_ROLE_NEAR_DUP_THRESHOLD,
  SAME_ROLE_NEAR_DUP_THRESHOLD,
  jaccardSimilarity,
};
