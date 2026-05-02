function cleanLine(line = "") {
  return String(line).replace(/\r/g, "").trim();
}

function isBlank(line) {
  return cleanLine(line) === "";
}

function stripHtmlTags(value = "") {
  return String(value).replace(/<[^>]*>/g, "").trim();
}

function decodeBasicEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normaliseText(value = "") {
  return decodeBasicEntities(stripHtmlTags(value))
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s+/, "")
    .trim();
}

function normalisePlainTitle(title = "") {
  return cleanLine(normaliseText(String(title))).toLowerCase();
}

function isBullet(line) {
  return /^[-•*]\s+/.test(cleanLine(line)) || /^<li>.*<\/li>$/i.test(cleanLine(line));
}

function stripBullet(line) {
  const value = cleanLine(line);

  if (/^<li>.*<\/li>$/i.test(value)) {
    return normaliseText(value.replace(/^<li>/i, "").replace(/<\/li>$/i, ""));
  }

  return value.replace(/^[-•*]\s+/, "").trim();
}

function isPageLine(line) {
  return /^PAGE\s+\d+/i.test(cleanLine(line));
}

function isNumberedBlockHeader(line) {
  return /^\d+\s*[—-]\s+.+$/i.test(cleanLine(line));
}

function parseNumberedBlockHeader(line) {
  const value = cleanLine(line);
  const match = value.match(/^(\d+)\s*[—-]\s+(.+)$/i);

  if (!match) return null;

  return {
    number: Number(match[1]),
    title: normaliseText(match[2]),
  };
}

function isPasteIntoLine(line) {
  return /^Paste into:/i.test(cleanLine(line));
}

function parsePasteTarget(line) {
  return cleanLine(line).replace(/^Paste into:/i, "").trim();
}

function isMetadataField(line) {
  return (
    /^LESSON OBJECTIVE FIELD:/i.test(cleanLine(line)) ||
    /^SHORT SUMMARY FIELD:/i.test(cleanLine(line))
  );
}

function isLegacyMainHeading(line) {
  const value = cleanLine(line);
  return /^\*\*.*\*\*$/.test(value) || /^#{1,6}\s+/.test(value);
}

function normalizeLegacyHeading(line) {
  return normaliseText(
    cleanLine(line)
      .replace(/^\*\*/, "")
      .replace(/\*\*$/, "")
      .replace(/^#{1,6}\s+/, "")
  );
}

function headingIncludes(line, text) {
  return normalizeLegacyHeading(line).toLowerCase().includes(text.toLowerCase());
}

function normaliseTargetKey(target = "") {
  return cleanLine(target)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const TARGET_TO_TYPE = {
  "hook (text)": "hook",
  "core rule (key idea)": "core-rule",
  "common mistake": "common-mistake",
  "pattern recognition (key idea)": "pattern-recognition",
  "diagram (concept)": "diagram",
  "what to notice (key idea)": "what-to-notice",
  "text (concept)": "text-concept",
  "exam tip (concept)": "exam-tip",
  "worked example (checkpoint)": "worked-example",
  "synthesis (key idea)": "synthesis",
  "quick check (checkpoint)": "quick-check",
  "self-check question": "self-check-question",
  "final memory rule (key idea)": "final-memory-rule",
  "key words": "keywords",
  "deeper knowledge (stretch)": "deeper-knowledge",
  "step-by-step diagram (process)": "step-by-step-diagram",
  "interactive diagram": "interactive-diagram",
  "drag and drop match": "drag-drop-match",
  "checkpoint block": "checkpoint",

  // Backwards compatibility
  "explanation block": "text-concept",
  checkpoint: "checkpoint",
};

function targetToType(target = "") {
  return TARGET_TO_TYPE[normaliseTargetKey(target)] || "text-concept";
}

/** Paste target + block title → checkpoint vs quick-check (SS1 interactive blocks). */
function resolveCheckpointType(pasteTarget = "", title = "", baseType = "text-concept") {
  const pt = normaliseTargetKey(pasteTarget);
  const tt = normalisePlainTitle(title);

  if (pt.includes("quick check")) return "quick-check";
  if (pt.includes("checkpoint block") || pt === "checkpoint") return "checkpoint";

  if (tt.includes("quick check") || (tt.includes("quick") && tt.includes("check"))) {
    return "quick-check";
  }
  if (tt.includes("checkpoint")) return "checkpoint";

  if (baseType === "checkpoint" || baseType === "quick-check") return baseType;

  return baseType;
}

function htmlToPlainText(value = "") {
  return decodeBasicEntities(
    String(value)
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
      .replace(/<summary[^>]*>/gi, "Reveal: ")
      .replace(/<\/summary>/gi, "\n")
      .replace(/<\/details>/gi, "\n")
      .replace(/<details[^>]*>/gi, "")
      .replace(/<[^>]*>/g, "")
  ).trim();
}

function removeDetailsTags(value = "") {
  return String(value)
    .replace(/<details>/gi, "")
    .replace(/<\/details>/gi, "")
    .replace(/<summary>.*?<\/summary>/gis, "")
    .trim();
}

function extractHiddenAnswer(value = "") {
  const match = String(value).match(
    /<details>\s*<summary>.*?<\/summary>\s*([\s\S]*?)\s*<\/details>/i
  );
  return match ? htmlToPlainText(match[1]) : "";
}

function splitContentLines(content = "") {
  return String(content).split("\n").map(cleanLine);
}

function collectUntilNextBlock(lines, startIndex) {
  const content = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = cleanLine(lines[i]);

    if (isPageLine(line) || isNumberedBlockHeader(line)) {
      break;
    }

    content.push(lines[i]);
    i++;
  }

  return {
    content: content.join("\n").trim(),
    nextIndex: i,
  };
}

function parseField(lines, startIndex, fieldName) {
  let i = startIndex;
  const line = cleanLine(lines[i]);
  const afterColon = line.replace(new RegExp(`^${fieldName}:`, "i"), "").trim();

  if (afterColon) {
    return {
      value: afterColon,
      nextIndex: i + 1,
    };
  }

  i++;
  while (i < lines.length && isBlank(lines[i])) i++;

  return {
    value: cleanLine(lines[i] || ""),
    nextIndex: i + 1,
  };
}

function parseListItemsFromContent(content = "") {
  const text = htmlToPlainText(content);
  const lines = splitContentLines(text);
  const items = [];

  for (const line of lines) {
    if (isBlank(line)) continue;

    if (
      /^At the end of this lesson/i.test(line) ||
      /^Before we start/i.test(line) ||
      /^You already know/i.test(line)
    ) {
      continue;
    }

    if (/^Paste into:/i.test(line)) continue;

    if (isBullet(line)) {
      items.push(stripBullet(line));
    } else if (/^-/.test(line)) {
      items.push(line.replace(/^-\s*/, "").trim());
    } else if (/^\d+\.\s+\S/.test(line)) {
      items.push(line.replace(/^\d+\.\s+/, "").trim());
    }
  }

  return items;
}

function parseKeywordLineFromPlain(line = "") {
  const cleaned = stripBullet(cleanLine(line));
  if (!cleaned) return null;

  const md = cleaned.match(/^\*{2}([^*]+)\*{2}\s*[–-]\s*(.+)$/);
  if (md) return { term: normaliseText(md[1]), definition: normaliseText(md[2]) };

  const plain = cleaned.match(/^(.+?)\s*[–-]\s*(.+)$/);
  if (plain) return { term: normaliseText(plain[1]), definition: normaliseText(plain[2]) };

  return null;
}

/** Flexible keywords: <strong>Term</strong> – def, **Term** – def, Term - definition. */
function parseKeywordsFromContent(content = "") {
  const rawLines = String(content).split("\n");
  const items = [];

  for (const raw of rawLines) {
    const line = cleanLine(raw);
    if (isBlank(line)) continue;

    if (/^Paste into:/i.test(line)) continue;

    let kw = null;
    const strongHtml = raw.match(
      /<strong[^>]*>([\s\S]*?)<\/strong>\s*[–-]\s*(.+)$/i
    );
    if (strongHtml) {
      kw = {
        term: normaliseText(strongHtml[1]),
        definition: normaliseText(strongHtml[2]),
      };
    } else {
      const plainLine = htmlToPlainText(raw);
      kw = parseKeywordLineFromPlain(plainLine);
    }

    if (kw) items.push(kw);
  }

  return items;
}

function parseLabelListAfter(lines, labelRegex) {
  const items = [];
  let started = false;

  for (const line of lines) {
    if (labelRegex.test(line)) {
      started = true;
      continue;
    }

    if (started) {
      if (/^[A-Z][A-Za-z /]+:/i.test(line) && !isBullet(line)) break;
      if (isBullet(line)) items.push(stripBullet(line));
    }
  }

  return items;
}

function parseKeyValueSections(content = "") {
  const lines = splitContentLines(htmlToPlainText(content));
  const data = {};
  let currentKey = null;

  for (const line of lines) {
    if (isBlank(line)) continue;

    const match = line.match(/^([A-Za-z /]+):\s*(.*)$/);

    if (match && !/^Q\d+/i.test(line)) {
      currentKey = match[1].trim().toLowerCase().replace(/\s+/g, "-");
      data[currentKey] = match[2] ? match[2].trim() : "";
      continue;
    }

    if (currentKey) {
      data[currentKey] += data[currentKey] ? `\n${line}` : line;
    }
  }

  return data;
}

/**
 * True if line looks like one MCQ option (flexible formatting).
 * @param optionsPhase - after first option, bullets count as continuation options.
 * @param prevBlank - bullet line after blank often starts option list without A/B prefixes.
 */
function isOptionLine(line, optionsPhase = false, prevBlank = false) {
  const raw = cleanLine(line);
  if (!raw) return false;
  const s = cleanLine(htmlToPlainText(raw));
  if (/^Question\s*:/i.test(s) || /^Answer\s*:/i.test(s)) return false;

  if (/^Option\s+\d+\s*:?\s?\S/i.test(s)) return true;

  if (/^\d+[\).\]]\s+\S/.test(s)) return true;

  if (/^[A-Za-z]\.\s+\S/.test(s)) return true;

  if (/^\([A-Za-z]\)\s+\S/.test(s)) return true;

  if (/^[A-Za-z]\)\s+\S/.test(s)) return true;

  if (/^[-•*]\s+\S/.test(s)) {
    return optionsPhase || prevBlank;
  }

  return false;
}

function cleanOptionText(line) {
  let s = cleanLine(htmlToPlainText(line));
  s = s.replace(/^Option\s+\d+\s*:\s*/i, "").trim();
  s = s.replace(/^\([A-Za-z]\)\s+/, "").trim();
  s = s.replace(/^[A-Za-z]\)\s+/, "").trim();
  s = s.replace(/^[A-Za-z]\.\s+/, "").trim();
  s = s.replace(/^\d+[\).\]]\s+/, "").trim();
  s = s.replace(/^[-•*]\s+/, "").trim();
  return s.trim();
}

function extractOptions(lines, startIndex = 0) {
  const out = [];
  let optionsPhase = false;
  let prevBlank = false;

  for (let k = startIndex; k < lines.length; k++) {
    const ln = lines[k];
    if (isBlank(ln)) {
      prevBlank = true;
      continue;
    }
    if (isOptionLine(ln, optionsPhase, prevBlank)) {
      optionsPhase = true;
      out.push(cleanOptionText(ln));
      if (out.length >= 4) break;
    }
    prevBlank = false;
  }

  return out;
}

/**
 * Align stored answer with one of the options when possible (letter index, Option N:, case, trim).
 */
function normaliseAnswer(answer, options = []) {
  if (answer == null || answer === "") return "";
  let a = removeDetailsTags(String(answer));
  a = htmlToPlainText(a).trim();
  a = a.replace(/^Answer\s*:\s*/i, "").trim();
  a = a.replace(/^Option\s+\d+\s*:\s*/i, "").trim();

  const opts = (options || []).map((o) => String(o || "").trim()).filter(Boolean);
  if (!a) return "";

  const exact = opts.find((o) => o === a);
  if (exact) return exact;

  const loose = opts.find((o) => o.toLowerCase() === a.toLowerCase());
  if (loose) return loose;

  const letter = a.match(/^([A-Da-d])[\).\s:]\s*(.*)$/);
  if (letter) {
    const idx = letter[1].toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
    const rest = (letter[2] || "").trim();
    if (idx >= 0 && idx < opts.length) {
      if (
        !rest ||
        opts[idx].toLowerCase() === rest.toLowerCase() ||
        opts[idx].toLowerCase().startsWith(rest.toLowerCase())
      ) {
        return opts[idx];
      }
    }
  }

  const num = a.match(/^(\d)[\).\s:]\s*(.*)$/);
  if (num) {
    const idx = parseInt(num[1], 10) - 1;
    const rest = (num[2] || "").trim();
    if (idx >= 0 && idx < opts.length) {
      if (
        !rest ||
        opts[idx].toLowerCase() === rest.toLowerCase() ||
        opts[idx].toLowerCase().startsWith(rest.toLowerCase())
      ) {
        return opts[idx];
      }
    }
  }

  const byContains = opts.find(
    (o) =>
      (a.length >= 3 && o.includes(a)) ||
      (a.length >= 3 && a.includes(o))
  );
  if (byContains) return byContains;

  return a;
}

/** Flexible checkpoint/quick-check parsing (aligned with tolerant SS1 authoring). */
function parseCheckpointContent(content = "") {
  const lines = splitContentLines(htmlToPlainText(String(content)));

  const answerIdx = lines.findIndex((l) => /^Answer\s*:/i.test(l));
  const bodyLines = answerIdx >= 0 ? lines.slice(0, answerIdx) : [...lines];

  let rawAnswer = "";
  if (answerIdx >= 0) {
    const firstAns = lines[answerIdx].replace(/^Answer\s*:/i, "").trim();
    const restAns = lines.slice(answerIdx + 1).join(" ").trim();
    rawAnswer = restAns ? `${firstAns} ${restAns}` : firstAns;
  }

  const qi = bodyLines.findIndex((l) => /^Question\s*:/i.test(l));
  let question = "";
  let optionScanFrom = 0;

  if (qi >= 0) {
    const qParts = [bodyLines[qi].replace(/^Question\s*:/i, "").trim()];
    let k = qi + 1;
    optionScanFrom = bodyLines.length;
    for (; k < bodyLines.length; k++) {
      const ln = bodyLines[k];
      if (!isBlank(ln) && isOptionLine(ln, false, false)) {
        optionScanFrom = k;
        break;
      }
      if (!isBlank(ln)) qParts.push(ln.trim());
    }
    question = qParts.join(" ").trim();
  }

  let options = extractOptions(bodyLines, optionScanFrom);

  if (options.length === 0 && qi < 0) {
    options = extractOptions(bodyLines, 0);
  }

  if (options.length === 0 && qi >= 0) {
    options = extractOptions(bodyLines, qi + 1);
  }

  if (!question.trim() && qi < 0 && options.length > 0) {
    const firstOpt = bodyLines.findIndex(
      (ln) => !isBlank(ln) && isOptionLine(ln, false, false)
    );
    if (firstOpt > 0) {
      question = bodyLines
        .slice(0, firstOpt)
        .filter((ln) => !isBlank(ln))
        .join(" ")
        .trim();
    }
  }

  let answer = removeDetailsTags(rawAnswer);
  answer = htmlToPlainText(answer).trim();

  answer = normaliseAnswer(answer, options);

  return {
    question: question.trim(),
    options,
    answer,
  };
}

function parseDragDropContent(content = "") {
  const text = htmlToPlainText(content);
  const lines = splitContentLines(text);

  const instruction = [];
  const items = [];
  const dropZones = [];
  const answerKey = [];

  let mode = "instruction";

  for (const line of lines) {
    if (isBlank(line)) continue;

    if (/^Instruction:/i.test(line)) {
      mode = "instruction";
      const value = line.replace(/^Instruction:/i, "").trim();
      if (value) instruction.push(value);
      continue;
    }

    if (/^Items to drag:/i.test(line)) {
      mode = "items";
      continue;
    }

    if (/^Drop zones:/i.test(line)) {
      mode = "drop-zones";
      continue;
    }

    if (/^Answer key:/i.test(line) || /^Reveal:/i.test(line)) {
      mode = "answer-key";
      continue;
    }

    if (mode === "items" && isBullet(line)) {
      items.push(stripBullet(line));
    } else if (mode === "drop-zones" && isBullet(line)) {
      dropZones.push(stripBullet(line));
    } else if (mode === "answer-key" && isBullet(line)) {
      answerKey.push(stripBullet(line));
    } else if (mode === "instruction") {
      instruction.push(line);
    }
  }

  return {
    type: "drag-drop-match",
    instruction: instruction.join("\n").trim(),
    items,
    dropZones,
    answerKey,
    hiddenAnswer: extractHiddenAnswer(content),
    text,
  };
}

function parseInteractiveDiagramContent(content = "") {
  const text = htmlToPlainText(content);
  const lines = splitContentLines(text);

  const instruction = [];
  const labels = [];
  const hotspots = [];
  const answerKey = [];
  let mode = "instruction";

  for (const line of lines) {
    if (isBlank(line)) continue;

    if (/^Instruction:/i.test(line)) {
      mode = "instruction";
      const value = line.replace(/^Instruction:/i, "").trim();
      if (value) instruction.push(value);
      continue;
    }

    if (/^Labels to use:/i.test(line)) {
      mode = "labels";
      continue;
    }

    if (/^Hotspots \/ parts:/i.test(line) || /^Hotspots:/i.test(line)) {
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
      hotspots.push(stripBullet(line));
    } else if (mode === "answer-key" && isBullet(line)) {
      answerKey.push(stripBullet(line));
    } else if (mode === "instruction") {
      instruction.push(line);
    }
  }

  return {
    type: "interactive-diagram",
    instruction: instruction.join("\n").trim(),
    labels,
    hotspots,
    answerKey,
    hiddenAnswer: extractHiddenAnswer(content),
    text,
  };
}

function parseStepDiagramContent(content = "") {
  const text = htmlToPlainText(content);
  const lines = splitContentLines(text);
  const steps = [];
  let examLink = "";
  let currentStep = null;
  let collectingExamLink = false;

  for (const line of lines) {
    if (isBlank(line) || line === "↓") continue;

    const stepMatch = line.match(/^Step\s+\d+:\s*(.*)$/i);

    if (stepMatch) {
      currentStep = stepMatch[1].trim();
      steps.push(currentStep);
      collectingExamLink = false;
      continue;
    }

    if (/^Exam link:/i.test(line)) {
      collectingExamLink = true;
      examLink = line.replace(/^Exam link:/i, "").trim();
      continue;
    }

    if (collectingExamLink) {
      examLink += examLink ? ` ${line}` : line;
    } else if (steps.length) {
      steps[steps.length - 1] += ` ${line}`;
    }
  }

  return {
    type: "step-by-step-diagram",
    steps,
    examLink,
    text,
  };
}

function parseDiagramContent(content = "", type = "diagram") {
  const data = parseKeyValueSections(content);

  return {
    type,
    placement: data.placement || "",
    diagramType: data.type || "",
    whatItShouldShow: data["what-it-should-show"] || "",
    keyLabels: data["key-labels-/-features"] || data["key-labels"] || "",
    whyItHelps: data["why-it-helps"] || "",
    brandStyle: data["brand/style"] || "",
    text: htmlToPlainText(content),
  };
}

function parseExamPracticeContent(content = "") {
  const text = htmlToPlainText(content);
  const lines = splitContentLines(text);
  const questions = [];
  let currentQuestion = null;
  let collectingModelAnswer = false;

  for (const line of lines) {
    if (isBlank(line)) continue;

    if (/^Q\d+\s*\(/i.test(line) || /^Q\d+\b/i.test(line)) {
      if (currentQuestion) questions.push(currentQuestion);

      currentQuestion = {
        question: line,
        modelAnswer: [],
      };

      collectingModelAnswer = false;
      continue;
    }

    if (/^Model Answer:/i.test(line) || /^Reveal Model Answer/i.test(line)) {
      collectingModelAnswer = true;
      continue;
    }

    if (!currentQuestion) continue;

    if (collectingModelAnswer) {
      currentQuestion.modelAnswer.push(isBullet(line) ? stripBullet(line) : line);
    } else {
      currentQuestion.question += `\n${isBullet(line) ? stripBullet(line) : line}`;
    }
  }

  if (currentQuestion) questions.push(currentQuestion);

  return {
    type: "exam-practice",
    questions,
    text,
  };
}

function titleHintsExamPractice(title = "") {
  const t = normalisePlainTitle(title);
  return t.includes("exam practice");
}

function titleHintsLessonObjective(title = "") {
  const t = normalisePlainTitle(title);
  return t.includes("lesson objective") || t.includes("objectives");
}

function titleHintsPriorKnowledge(title = "") {
  const t = normalisePlainTitle(title);
  return (
    t.includes("prior knowledge") ||
    t.includes("prior-knowledge") ||
    t.includes("what you already know")
  );
}

function titleHintsSummary(title = "") {
  return normalisePlainTitle(title).includes("summary");
}

function titleHintsKeywords(title = "") {
  const t = normalisePlainTitle(title);
  return t.includes("keywords") || t.includes("key words");
}

function titleHintsDiagram(title = "") {
  const t = normalisePlainTitle(title);
  return t.includes("diagram");
}

function buildGenericBlock({ type, title, pasteTarget, content, number }) {
  const plainText = htmlToPlainText(content);

  const base = {
    type,
    title,
    pasteTarget,
    number,
    html: content.trim(),
    text: plainText,
  };

  let effectiveType =
    type === "checkpoint" || type === "quick-check"
      ? resolveCheckpointType(pasteTarget, title, type)
      : type;

  if (effectiveType === "checkpoint" || effectiveType === "quick-check") {
    const cp = parseCheckpointContent(content);
    return {
      ...base,
      ...cp,
      type: effectiveType,
    };
  }

  if (type === "drag-drop-match") {
    return {
      ...base,
      ...parseDragDropContent(content),
    };
  }

  if (type === "interactive-diagram") {
    return {
      ...base,
      ...parseInteractiveDiagramContent(content),
    };
  }

  if (type === "step-by-step-diagram") {
    return {
      ...base,
      ...parseStepDiagramContent(content),
    };
  }

  if (type === "diagram") {
    return {
      ...base,
      ...parseDiagramContent(content, "diagram"),
    };
  }

  if (type === "worked-example") {
    return {
      ...base,
      hiddenAnswer: extractHiddenAnswer(content),
    };
  }

  if (type === "keywords") {
    return {
      ...base,
      items: parseKeywordsFromContent(content),
    };
  }

  const ti = normalisePlainTitle(title);

  if (
    titleHintsExamPractice(title) ||
    ti.includes("exam practice") ||
    ti.includes("practice questions")
  ) {
    return {
      ...base,
      ...parseExamPracticeContent(content),
    };
  }

  if (type === "text-concept" && titleHintsLessonObjective(title)) {
    return {
      ...base,
      type: "objectives",
      items: parseListItemsFromContent(content),
    };
  }

  if (type === "text-concept" && titleHintsPriorKnowledge(title)) {
    return {
      ...base,
      type: "prior-knowledge",
      items: parseListItemsFromContent(content),
    };
  }

  if (type === "text-concept" && titleHintsSummary(title)) {
    return {
      ...base,
      type: "summary",
      items: parseListItemsFromContent(content),
    };
  }

  if (
    type === "text-concept" &&
    (titleHintsKeywords(title) || /\bkey\s*words?\b/i.test(title || ""))
  ) {
    return {
      ...base,
      type: "keywords",
      items: parseKeywordsFromContent(content),
    };
  }

  if (type === "text-concept" && titleHintsDiagram(title)) {
    return {
      ...base,
      type: "diagram",
      ...parseDiagramContent(content, "diagram"),
    };
  }

  return base;
}

function parseModernBlocks(lines) {
  const blocks = [];
  const metadata = {};
  let i = 0;

  while (i < lines.length) {
    const line = cleanLine(lines[i]);

    if (isBlank(line)) {
      i++;
      continue;
    }

    if (/^LESSON OBJECTIVE FIELD:/i.test(line)) {
      const { value, nextIndex } = parseField(lines, i, "LESSON OBJECTIVE FIELD");
      metadata.lessonObjective = value;
      i = nextIndex;
      continue;
    }

    if (/^SHORT SUMMARY FIELD:/i.test(line)) {
      const { value, nextIndex } = parseField(lines, i, "SHORT SUMMARY FIELD");
      metadata.shortSummary = value;
      i = nextIndex;
      continue;
    }

    if (isPageLine(line)) {
      blocks.push({
        type: "page",
        text: line,
        page: Number(line.match(/\d+/)?.[0] || 1),
      });
      i++;
      continue;
    }

    if (isNumberedBlockHeader(line)) {
      const header = parseNumberedBlockHeader(line);
      let pasteTarget = "Text (concept)";
      let contentStart = i + 1;

      while (contentStart < lines.length && isBlank(lines[contentStart])) {
        contentStart++;
      }

      if (contentStart < lines.length && isPasteIntoLine(lines[contentStart])) {
        pasteTarget = parsePasteTarget(lines[contentStart]);
        contentStart++;
      }

      while (contentStart < lines.length && isBlank(lines[contentStart])) {
        contentStart++;
      }

      const { content, nextIndex } = collectUntilNextBlock(lines, contentStart);
      const baseType = targetToType(pasteTarget);

      blocks.push(
        buildGenericBlock({
          type: baseType,
          title: header.title,
          pasteTarget,
          content,
          number: header.number,
        })
      );

      i = nextIndex;
      continue;
    }

    blocks.push({
      type: "text",
      text: line,
      html: line,
    });

    i++;
  }

  return {
    metadata,
    blocks,
  };
}

// ---------- Legacy parser fallback ----------

function parseLegacyBulletSection(lines, startIndex, type) {
  const title = normalizeLegacyHeading(lines[startIndex]);
  const items = [];
  let i = startIndex + 1;

  while (i < lines.length) {
    const line = cleanLine(lines[i]);

    if (isBlank(line)) {
      i++;
      continue;
    }

    if (isLegacyMainHeading(line)) break;

    if (
      line === "At the end of this lesson, you should be able to:" ||
      line === "Before we start, you should already know:"
    ) {
      i++;
      continue;
    }

    items.push(isBullet(line) ? stripBullet(line) : normaliseText(line));
    i++;
  }

  return {
    block: { type, title, items },
    nextIndex: i,
  };
}

function parseLegacyTextSection(lines, startIndex, type) {
  const title = normalizeLegacyHeading(lines[startIndex]);
  const parts = [];
  let i = startIndex + 1;

  while (i < lines.length) {
    const line = cleanLine(lines[i]);

    if (isBlank(line)) {
      i++;
      continue;
    }

    if (isLegacyMainHeading(line)) break;

    parts.push(line);
    i++;
  }

  return {
    block: {
      type,
      title,
      text: htmlToPlainText(parts.join("\n")),
      html: parts.join("\n"),
    },
    nextIndex: i,
  };
}

function parseLegacyQuickThinkingCheck(lines, startIndex) {
  const { block, nextIndex } = parseLegacyTextSection(
    lines,
    startIndex,
    "quick-thinking-check"
  );
  return {
    block: {
      ...block,
      question: block.text,
      answer: extractHiddenAnswer(block.html),
    },
    nextIndex,
  };
}

function parseLegacyKeywords(lines, startIndex) {
  const { block, nextIndex } = parseLegacyTextSection(lines, startIndex, "keywords");

  return {
    block: {
      ...block,
      items: parseKeywordsFromContent(block.html),
    },
    nextIndex,
  };
}

function parseLegacyExamPractice(lines, startIndex) {
  const { block, nextIndex } = parseLegacyTextSection(lines, startIndex, "exam-practice");

  return {
    block: {
      ...block,
      ...parseExamPracticeContent(block.html),
      title: block.title,
    },
    nextIndex,
  };
}

function parseLegacyCheckpoint(lines, startIndex, blockType = "checkpoint") {
  const { block, nextIndex } = parseLegacyTextSection(lines, startIndex, blockType);
  const cp = parseCheckpointContent(block.html);

  return {
    block: {
      ...block,
      ...cp,
      type: blockType,
    },
    nextIndex,
  };
}

function parseLegacyTextBlock(lines, startIndex) {
  const parts = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = cleanLine(lines[i]);

    if (isBlank(line)) {
      i++;
      if (parts.length) break;
      continue;
    }

    if (isLegacyMainHeading(line)) break;

    parts.push(line);
    i++;
  }

  return {
    block: {
      type: "text",
      text: htmlToPlainText(parts.join("\n")),
      html: parts.join("\n"),
    },
    nextIndex: i,
  };
}

function parseLegacyLessonText(text = "") {
  const lines = text.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = cleanLine(lines[i]);

    if (isBlank(line)) {
      i++;
      continue;
    }

    if (isLegacyMainHeading(line)) {
      if (headingIncludes(line, "lesson objectives")) {
        const { block, nextIndex } = parseLegacyBulletSection(lines, i, "objectives");
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      if (headingIncludes(line, "prior knowledge")) {
        const { block, nextIndex } = parseLegacyBulletSection(lines, i, "prior-knowledge");
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      if (headingIncludes(line, "quick check")) {
        const { block, nextIndex } = parseLegacyCheckpoint(lines, i, "quick-check");
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      if (headingIncludes(line, "checkpoint")) {
        const { block, nextIndex } = parseLegacyCheckpoint(lines, i, "checkpoint");
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      if (headingIncludes(line, "exam practice")) {
        const { block, nextIndex } = parseLegacyExamPractice(lines, i);
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      if (headingIncludes(line, "summary")) {
        const { block, nextIndex } = parseLegacyBulletSection(lines, i, "summary");
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      if (headingIncludes(line, "keywords")) {
        const { block, nextIndex } = parseLegacyKeywords(lines, i);
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      if (headingIncludes(line, "diagram suggestion")) {
        const { block, nextIndex } = parseLegacyTextSection(lines, i, "diagram");
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      if (
        headingIncludes(line, "diagram") &&
        !headingIncludes(line, "exam practice")
      ) {
        const { block, nextIndex } = parseLegacyTextSection(lines, i, "diagram");
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      if (headingIncludes(line, "examiner tips")) {
        const { block, nextIndex } = parseLegacyBulletSection(lines, i, "examiner-tips");
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      if (headingIncludes(line, "final challenge")) {
        const { block, nextIndex } = parseLegacyTextSection(lines, i, "final-challenge");
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      if (headingIncludes(line, "explain without notes")) {
        const { block, nextIndex } = parseLegacyBulletSection(
          lines,
          i,
          "explain-without-notes"
        );
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      if (headingIncludes(line, "quick thinking check")) {
        const { block, nextIndex } = parseLegacyQuickThinkingCheck(lines, i);
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      if (headingIncludes(line, "why this matters")) {
        const { block, nextIndex } = parseLegacyTextSection(lines, i, "why-this-matters");
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      if (headingIncludes(line, "premium exam tip")) {
        const { block, nextIndex } = parseLegacyTextSection(lines, i, "premium-exam-tip");
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      if (headingIncludes(line, "key insight")) {
        const { block, nextIndex } = parseLegacyTextSection(lines, i, "key-insight");
        blocks.push(block);
        i = nextIndex;
        continue;
      }

      blocks.push({
        type: "heading",
        text: normalizeLegacyHeading(line),
      });
      i++;
      continue;
    }

    const { block, nextIndex } = parseLegacyTextBlock(lines, i);
    blocks.push(block);
    i = nextIndex;
  }

  return {
    metadata: {},
    blocks,
  };
}

function isKeyInsightBlock(block = {}) {
  const ttl = normalisePlainTitle(block.title || "");
  const tx = `${block.text || ""} ${block.html || ""}`.toLowerCase();
  return block.type === "key-insight" || ttl.includes("key insight") || tx.includes("key insight");
}

function normaliseLessonBlocks(blocks = []) {
  const keyInsightIndexes = [];

  blocks.forEach((b, i) => {
    if (isKeyInsightBlock(b)) keyInsightIndexes.push(i);
  });

  return blocks.map((block, index) => {
    let b = { ...block };

    if (b.type === "checkpoint" || b.type === "quick-check") {
      let opts = Array.isArray(b.options) ? [...b.options] : [];
      if (opts.length > 4) opts = opts.slice(0, 4);
      const answer =
        typeof b.answer === "string"
          ? normaliseAnswer(b.answer, opts)
          : b.answer || "";
      b = {
        ...b,
        options: opts,
        answer,
      };
    }

    if (keyInsightIndexes.length > 1 && keyInsightIndexes.includes(index)) {
      const pos = keyInsightIndexes.indexOf(index);
      if (pos > 0) {
        b = { ...b, duplicateKeyInsight: true };
      }
    }

    return b;
  });
}

function mapParsedBlocks(parsedBlocks = []) {
  return normaliseLessonBlocks(parsedBlocks).map((block, index) => ({
    id: block.id || `parsed-${index + 1}`,
    ...block,
  }));
}

export function parseLessonText(text = "") {
  const lines = String(text).split("\n");
  const hasModernBlockFormat =
    lines.some((line) => isNumberedBlockHeader(line)) &&
    lines.some((line) => isPasteIntoLine(line));

  const parsed = hasModernBlockFormat
    ? parseModernBlocks(lines)
    : parseLegacyLessonText(text);

  return mapParsedBlocks(parsed.blocks);
}

export function parseLessonTextWithMetadata(text = "") {
  const lines = String(text).split("\n");
  const hasModernBlockFormat =
    lines.some((line) => isNumberedBlockHeader(line)) &&
    lines.some((line) => isPasteIntoLine(line));

  const parsed = hasModernBlockFormat
    ? parseModernBlocks(lines)
    : parseLegacyLessonText(text);

  const blocks = normaliseLessonBlocks(parsed.blocks).map((block, index) => ({
    id: block.id || `parsed-${index + 1}`,
    ...block,
  }));

  return {
    metadata: parsed.metadata || {},
    blocks,
  };
}
