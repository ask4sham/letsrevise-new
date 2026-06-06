/**
 * Phase 3H.1.8a.1 acceptance — Layer 2 + placeholder gate (upgrade path only).
 * Usage: node backend/scripts/manualAcceptance3H18a.mjs
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

function extractBlockSnippet(text, titleRx, maxLen = 800) {
  const chunks = String(text || "").split(/\n(?=\d+\s*[—\-–]\s+)/);
  for (const chunk of chunks) {
    const header = chunk.match(/^\d+\s*[—\-–]\s+([^\n]+)/);
    if (!header || !titleRx.test(header[1])) continue;
    const body = chunk.replace(/^[^\n]+\n(?:Paste into:[^\n]+\n)?/i, "").trim();
    return body.length > maxLen ? `${body.slice(0, maxLen)}…` : body;
  }
  return "";
}

function checkOpeningOrder(titles) {
  const norm = titles.map((t) => t.toUpperCase());
  const pass =
    norm.length >= 10 &&
    norm.slice(0, 10).every((t, i) => {
      const exp = EXPECTED_FIRST_10[i];
      return t.includes(exp) || exp.split(" ").every((w) => t.includes(w));
    });
  return {
    pass,
    scenarioIndex: norm.findIndex((t) => t.includes("SCENARIO")) + 1,
    definitionIndex: norm.findIndex((t) => t.includes("DEFINITION")) + 1,
  };
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }
  for (const item of data?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && part?.text) return part.text;
      if (typeof part?.text === "string" && part.text.trim()) return part.text;
    }
  }
  return "";
}

async function callOpenAiSs1(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) throw new Error("Missing OPENAI_API_KEY");
  const model = process.env.OPENAI_GENERATE_MODEL || "gpt-4.1";
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
  const { text: fixedText } = deterministicAutoFixLesson({
    text: raw,
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: cfg.topic,
  });

  const titles = parseSs1BlockTitles(fixedText, 10);
  const opening = checkOpeningOrder(titles);
  const quality = evaluateTeachingQualityUpgrade(fixedText, {
    topic: cfg.topic,
    topicKey: cfg.topicKey,
    subTopic: cfg.topic,
  });

  return {
    generationSeconds: ((Date.now() - start) / 1000).toFixed(1),
    promptHasLayer2: prompt.includes("TEACHER-FIRST KNOWLEDGE DELIVERY"),
    promptHasMandatorySlots: prompt.includes("MANDATORY OPENING SLOTS"),
    promptHasAntiDuplication: prompt.includes("ANTI-DUPLICATION"),
    promptHasReasoning: prompt.includes("GCSE REASONING CHAIN ENGINE"),
    promptHasExaminer: prompt.includes("EXAMINER LANGUAGE ENGINE"),
    first10Titles: titles,
    opening,
    quality,
    snippets: {
      coreModel: extractBlockSnippet(fixedText, /core\s+model/i),
      keyExamples: extractBlockSnippet(fixedText, /key\s+examples/i),
      examVocabulary: extractBlockSnippet(fixedText, /exam\s+vocabulary/i),
      coreTeaching: extractBlockSnippet(fixedText, /core\s+teaching/i),
      commonMistake: extractBlockSnippet(fixedText, /common\s+mistake/i),
      examTip: extractBlockSnippet(fixedText, /exam\s+tip/i),
      workedExample: extractBlockSnippet(fixedText, /worked\s+example/i),
    },
    fixedText,
  };
}

function buildReviewMarkdown(results) {
  const lines = [
    "# Phase 3H.1.8a.1 — Manual Review Pack",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Flags: `TEACHER_BRAIN_TEACHER_FIRST_OPENING=1`, `TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE=1`",
    "",
  ];

  for (const r of results) {
    lines.push(`## ${r.name}`, "");
    lines.push(`- Opening order: **${r.opening.pass ? "PASS" : "FAIL"}**`);
    lines.push(`- Placeholder gate: **${r.quality.gate.placeholders.pass ? "PASS" : "FAIL"}**`);
    lines.push(`- Dual-output gate: **${r.quality.gate.dualOutput.pass ? "PASS" : "FAIL"}**`);
    lines.push(`- Opening slots: **${r.quality.gate.openingSlots.pass ? "PASS" : "FAIL"}**`);
    lines.push(`- Overall: **${r.pass ? "PASS" : "FAIL"}**`, "");

    lines.push("### Core Model (block 5)", "```", r.snippets.coreModel || "(empty)", "```", "");
    lines.push("### Key Examples (block 6)", "```", r.snippets.keyExamples || "(empty)", "```", "");
    lines.push(
      "### Exam Vocabulary (block 7)",
      "```",
      r.snippets.examVocabulary || "(empty)",
      "```",
      ""
    );
  }

  return lines.join("\n");
}

function buildReviewHtml(results) {
  const esc = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const cards = results
    .map(
      (r) => `
<section class="topic">
  <h2>${esc(r.name)}</h2>
  <div class="meta">${r.pass ? "PASS" : "FAIL"} | placeholders: ${r.quality.gate.placeholders.pass} | dual-output: ${r.quality.gate.dualOutput.pass} | slots: ${r.quality.gate.openingSlots.pass}</div>
  <div class="panel"><h3>Core Model</h3><pre>${esc(r.snippets.coreModel)}</pre></div>
  <div class="panel"><h3>Key Examples</h3><pre>${esc(r.snippets.keyExamples)}</pre></div>
  <div class="panel"><h3>Exam Vocabulary</h3><pre>${esc(r.snippets.examVocabulary)}</pre></div>
</section>`
    )
    .join("\n");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Phase 3H.1.8a.1 Review</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem;background:#f6f7f9}.topic{background:#fff;border-radius:12px;padding:1.5rem;margin-bottom:2rem;box-shadow:0 1px 4px rgba(0,0,0,.08)}.panel{background:#fafbfc;border:1px solid #e2e5ea;border-radius:8px;padding:1rem;margin:.75rem 0}pre{white-space:pre-wrap;font-size:.85rem;margin:0}</style>
</head><body><h1>Phase 3H.1.8a.1 Manual Review</h1>${cards}</body></html>`;
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("OPENAI_API_KEY missing from backend/.env");
    process.exit(1);
  }

  console.log("\n=== Phase 3H.1.8a.1 Acceptance (Layer 2 + quality gate) ===\n");

  const results = [];

  for (const cfg of LESSONS) {
    console.log(`--- ${cfg.name} ---`);
    const out = await generateLesson(cfg);

    const pass =
      out.opening.pass &&
      out.quality.pass &&
      out.quality.gate.placeholders.pass &&
      out.quality.gate.dualOutput.pass &&
      out.quality.gate.openingSlots.pass;

    console.log(`  Opening: ${out.opening.pass ? "PASS" : "FAIL"}`);
    console.log(`  Placeholders: ${out.quality.gate.placeholders.pass ? "PASS" : "FAIL"}`);
    console.log(`  Dual output: ${out.quality.gate.dualOutput.pass ? "PASS" : "FAIL"}`);
    console.log(`  Opening slots: ${out.quality.gate.openingSlots.pass ? "PASS" : "FAIL"}`);
    if (!out.quality.gate.openingSlots.pass && out.quality.gate.openingSlots.coreModel) {
      console.log("    missing core:", out.quality.gate.openingSlots.coreModel.missingTerms);
      console.log("    missing examples:", out.quality.gate.openingSlots.keyExamples?.missing);
      console.log("    missing vocab:", out.quality.gate.openingSlots.examVocabulary?.missing);
    }

    const slug = cfg.topicKey.split(":").pop();
    const lessonOutDir = path.join(root, "docs", "design", "validation", "3H18a");
    fs.mkdirSync(lessonOutDir, { recursive: true });
    const lessonFile = path.join(lessonOutDir, `${slug}-upgrade.txt`);
    fs.writeFileSync(lessonFile, out.fixedText, "utf8");

    results.push({
      name: cfg.name,
      topic: cfg.topic,
      topicKey: cfg.topicKey,
      generationSeconds: out.generationSeconds,
      first10Titles: out.first10Titles,
      opening: out.opening,
      quality: out.quality,
      snippets: out.snippets,
      pass,
      lessonFile,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "3H.1.8a.1",
    flags: {
      TEACHER_BRAIN_TEACHER_FIRST_OPENING: "1",
      TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE: "1",
    },
    results,
    summary: {
      allPass: results.every((r) => r.pass),
      allOpeningPass: results.every((r) => r.opening.pass),
      allPlaceholderPass: results.every((r) => r.quality.gate.placeholders.pass),
      allDualOutputPass: results.every((r) => r.quality.gate.dualOutput.pass),
      allOpeningSlotsPass: results.every((r) => r.quality.gate.openingSlots.pass),
    },
  };

  const reviewDir = path.join(root, "docs", "design", "validation", "3H18a");
  fs.mkdirSync(reviewDir, { recursive: true });
  const reportPath = path.join(__dirname, "manualAcceptance3H18a-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(reviewDir, "MANUAL_REVIEW.md"), buildReviewMarkdown(results), "utf8");
  fs.writeFileSync(
    path.join(reviewDir, "MANUAL_REVIEW.html"),
    buildReviewHtml(results),
    "utf8"
  );

  console.log("\nReport:", reportPath);
  console.log("\n=== SUMMARY ===");
  results.forEach((r) => console.log(`  ${r.pass ? "PASS" : "FAIL"} — ${r.name}`));

  process.exit(report.summary.allPass ? 0 : 2);
}

main().catch((err) => {
  console.error("\nAcceptance failed:", err.message || err);
  process.exit(1);
});
