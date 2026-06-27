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
  /^a correct statement about/i,
  /^self[\-\s]?check:\s*can you explain .+ without only naming terms/i,
];

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

function questionsAreNearDuplicate(a, b) {
  const na = normalizeQuestionStem(a);
  const nb = normalizeQuestionStem(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 20 && nb.length >= 20) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  return jaccardSimilarity(na, nb) >= 0.82;
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
      question: `Which cause → effect chain best explains ${t}?`,
      options: [
        "Stimulus → receptor → response with no control centre",
        "Change detected → corrective response → return toward set point",
        "Only naming keywords without explanation",
        "Unrelated process from another topic",
      ],
      answer: "Change detected → corrective response → return toward set point",
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

module.exports = {
  normalizeQuestionStem,
  isGenericPlaceholderStem,
  questionsAreNearDuplicate,
  extractQuestionStemFromBlock,
  listQuestionBlocksInLesson,
  applyQuestionDeduplicationGuard,
  getTopicMcqPool,
  isBloodGlucoseTopic,
  formatMcqBody,
};
