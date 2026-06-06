/**
 * Phase 3H.1.8b.0 acceptance — Key Words authority patch.
 * Usage: node backend/scripts/manualAcceptance3H18b0.mjs
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const LESSONS = [
  {
    name: "Homeostasis",
    topic: "Homeostasis",
    topicKey: "aqa-gcse-biology:homeostasis",
  },
  {
    name: "Structure and function of the nervous system",
    topic: "Structure and function of the nervous system",
    topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
  },
  {
    name: "The eye",
    topic: "The eye",
    topicKey: "aqa-gcse-biology:the-eye",
  },
];

const EXPECTED_FIRST_10 = [
  "LESSON OBJECTIVES",
  "PRIOR KNOWLEDGE",
  "DEFINITION",
  "WHY IT MATTERS",
  "CORE MODEL",
  "KEY EXAMPLES",
  "EXAM VOCABULARY",
  "SCENARIO",
  "CORE TEACHING",
  "CHECKPOINT",
];

const FRAMEWORK_TERMS = [
  "cause",
  "effect",
  "structure",
  "function",
  "keyword",
  "explain",
  "compare",
  "evidence",
  "misconception",
  "mark scheme",
];

function parseSs1BlockTitles(text, limit = 10) {
  const titles = [];
  for (const line of String(text || "").split("\n")) {
    const m = line.match(/^(\d+)\s*[—\-–]\s+(.+)$/);
    if (!m || /^PAGE\s/i.test(m[2])) continue;
    titles.push(m[2].trim());
    if (titles.length >= limit) break;
  }
  return titles;
}

function extractKeywordsBlock(text) {
  const lines = String(text || "").split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^(\d+)\s*[—\-–]\s+.*KEY\s+WORDS/i.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^(\d+)\s*[—\-–]\s+/i.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function checkOpeningOrder(titles) {
  const ok = EXPECTED_FIRST_10.every((exp, i) => titles[i] === exp);
  return { ok, titles, expected: EXPECTED_FIRST_10 };
}

async function callOpenAiSs1(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing in backend/.env");
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: prompt }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || JSON.stringify(data));
  return extractOutputText(data);
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  const parts = [];
  for (const item of data?.output || []) {
    for (const c of item?.content || []) {
      if (c.type === "output_text" && c.text) parts.push(c.text);
    }
  }
  return parts.join("\n");
}

async function generateLesson(cfg) {
  process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
  process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";

  const { buildPrompt } = await import("../../lib/buildPrompt.js");
  const { deterministicAutoFixLesson } = await import("../../lib/deterministicAutoFixLesson.js");
  const { evaluateTeachingQualityUpgrade } = await import(
    "../../lib/teacherBrain/teachingQualityUpgrade.js"
  );

  const prompt = buildPrompt({
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: cfg.topic,
    topicKey: cfg.topicKey,
    subTopic: cfg.topic,
    tier: "Higher Tier",
  });

  const start = Date.now();
  const raw = await callOpenAiSs1(prompt);
  const keywordsBefore = extractKeywordsBlock(raw);

  const { text: fixedText, keyWordsGate, fixesApplied } = deterministicAutoFixLesson({
    text: raw,
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: cfg.topic,
    topicKey: cfg.topicKey,
  });

  const keywordsAfter = extractKeywordsBlock(fixedText);
  const titles = parseSs1BlockTitles(fixedText, 10);
  const opening = checkOpeningOrder(titles);
  const quality = evaluateTeachingQualityUpgrade(fixedText, {
    topic: cfg.topic,
    topicKey: cfg.topicKey,
    subTopic: cfg.topic,
  });

  const frameworkInAfter = (keyWordsGate.keywords || []).filter((t) =>
    FRAMEWORK_TERMS.includes(String(t).toLowerCase())
  );

  const pass =
    opening.ok &&
    keyWordsGate.pass &&
    !keyWordsGate.usedGenericFallback &&
    frameworkInAfter.length === 0 &&
    quality.gate?.pass !== false;

  return {
    pass,
    generationSeconds: ((Date.now() - start) / 1000).toFixed(1),
    promptHasKeywordsMandate: prompt.includes("MANDATORY KEY WORDS"),
    first10Titles: titles,
    opening,
    keyWordsGate,
    quality,
    keywordsBefore,
    keywordsAfter,
    frameworkInAfter,
    fixesApplied: fixesApplied.filter((f) => /keyword|Keyword|WARNING/i.test(f)),
    fixedText,
  };
}

async function main() {
  const outDir = path.join(root, "docs", "design", "validation", "3H18b0");
  fs.mkdirSync(outDir, { recursive: true });

  const results = [];
  for (const cfg of LESSONS) {
    console.log(`\nGenerating: ${cfg.name}…`);
    const result = await generateLesson(cfg);
    results.push({ ...cfg, ...result });

    const slug = cfg.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    fs.writeFileSync(path.join(outDir, `${slug}.txt`), result.fixedText, "utf8");

    console.log(`  pass=${result.pass} keywords=${result.keyWordsGate.keywords?.join(", ")}`);
    console.log(`  genericFallback=${result.keyWordsGate.usedGenericFallback}`);
    if (result.frameworkInAfter.length) {
      console.log(`  FRAMEWORK TERMS FOUND: ${result.frameworkInAfter.join(", ")}`);
    }
  }

  const report = {
    phase: "3H.1.8b.0",
    generatedAt: new Date().toISOString(),
    allPass: results.every((r) => r.pass),
    results: results.map((r) => ({
      name: r.name,
      topicKey: r.topicKey,
      pass: r.pass,
      generationSeconds: r.generationSeconds,
      promptHasKeywordsMandate: r.promptHasKeywordsMandate,
      openingOk: r.opening.ok,
      keyWordsGate: r.keyWordsGate,
      frameworkInAfter: r.frameworkInAfter,
      keywordsBeforeSnippet: r.keywordsBefore.slice(0, 500),
      keywordsAfterSnippet: r.keywordsAfter.slice(0, 800),
      fixesApplied: r.fixesApplied,
    })),
  };

  fs.writeFileSync(
    path.join(outDir, "manualAcceptance3H18b0-report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(root, "backend", "scripts", "manualAcceptance3H18b0-report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log(`\nReport: ${path.join(outDir, "manualAcceptance3H18b0-report.json")}`);
  console.log(`ALL PASS: ${report.allPass}`);
  process.exit(report.allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
