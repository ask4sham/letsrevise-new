/**
 * Phase 3H.1.8a acceptance — baseline vs upgrade prompt comparison (no autofix).
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

async function generateLesson({ topic, upgradeOn }) {
  process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
  process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = upgradeOn ? "1" : "0";

  const { buildPrompt } = await import("../../lib/buildPrompt.js");
  const { deterministicAutoFixLesson } = await import("../../lib/deterministicAutoFixLesson.js");
  const { evaluateTeachingQualityUpgrade } = await import(
    "../../lib/teacherBrain/teachingQualityUpgrade.js"
  );

  const prompt = buildPrompt({
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic,
    tier: "Higher Tier",
  });

  const promptHasReasoning = prompt.includes("GCSE REASONING CHAIN ENGINE");
  const promptHasExaminer = prompt.includes("EXAMINER LANGUAGE ENGINE");

  const start = Date.now();
  const raw = await callOpenAiSs1(prompt);
  const { text: fixedText } = deterministicAutoFixLesson({
    text: raw,
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic,
  });

  const titles = parseSs1BlockTitles(fixedText, 10);
  const opening = checkOpeningOrder(titles);
  const quality = evaluateTeachingQualityUpgrade(fixedText, { topic });

  return {
    generationSeconds: ((Date.now() - start) / 1000).toFixed(1),
    promptHasReasoning,
    promptHasExaminer,
    first10Titles: titles,
    opening,
    quality,
    snippets: {
      coreModel: extractBlockSnippet(fixedText, /core\s+model/i),
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
    "# Phase 3H.1.8a — Manual Review Pack",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Flags (upgrade path): `TEACHER_BRAIN_TEACHER_FIRST_OPENING=1`, `TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE=1`",
    "",
    "**Decision gate:** Review lesson quality before starting 3H.1.8b (Grade Extension, Core Learning Progression, Teaching Quality Autofix).",
    "",
  ];

  for (const r of results) {
    lines.push(`## ${r.name}`, "");
    lines.push("### Opening order (upgrade)", "");
    lines.push(`- Pass: **${r.upgraded.opening.pass ? "YES" : "NO"}**`);
    lines.push(`- Scenario at block: ${r.upgraded.opening.scenarioIndex}`);
    lines.push(`- First 10 titles: ${r.upgraded.first10Titles.join(" → ")}`, "");

    lines.push("### Quality scores", "");
    lines.push("| Metric | Baseline | Upgrade |");
    lines.push("|--------|----------|---------|");
    lines.push(
      `| Reasoning pass | ${r.baseline.quality.reasoning.pass} | ${r.upgraded.quality.reasoning.pass} |`
    );
    lines.push(
      `| Examiner pass | ${r.baseline.quality.examiner.pass} | ${r.upgraded.quality.examiner.pass} |`
    );
    lines.push(
      `| Arrow chains | ${r.baseline.quality.reasoning.arrowChainMatches} | ${r.upgraded.quality.reasoning.arrowChainMatches} |`
    );
    lines.push(
      `| Examiner patterns | ${r.baseline.quality.examiner.distinctPatterns} | ${r.upgraded.quality.examiner.distinctPatterns} |`,
      ""
    );

    lines.push("### Before — Core Model (baseline, no upgrade flag)", "");
    lines.push("```");
    lines.push(r.baseline.snippets.coreModel || "(empty)");
    lines.push("```", "");

    lines.push("### After — Core Model (upgrade ON)", "");
    lines.push("```");
    lines.push(r.upgraded.snippets.coreModel || "(empty)");
    lines.push("```", "");

    lines.push("### Reasoning chain example (upgrade — Core Teaching)", "");
    lines.push("```");
    lines.push(r.upgraded.snippets.coreTeaching || "(empty)");
    lines.push("```", "");

    lines.push("### Examiner language examples (upgrade)", "");
    lines.push("**Common Mistake:**", "```");
    lines.push(r.upgraded.snippets.commonMistake || "(empty)");
    lines.push("```", "");
    lines.push("**Exam Tip:**", "```");
    lines.push(r.upgraded.snippets.examTip || "(empty)");
    lines.push("```", "");
    lines.push("**Worked Example:**", "```");
    lines.push(r.upgraded.snippets.workedExample || "(empty)");
    lines.push("```", "");
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
  <div class="meta">
    Opening: ${r.upgraded.opening.pass ? "PASS" : "FAIL"} |
    Reasoning: ${r.upgraded.quality.reasoning.pass ? "PASS" : "FAIL"} |
    Examiner: ${r.upgraded.quality.examiner.pass ? "PASS" : "FAIL"}
  </div>
  <div class="grid">
    <div class="panel before">
      <h3>Before — Core Model</h3>
      <pre>${esc(r.baseline.snippets.coreModel)}</pre>
    </div>
    <div class="panel after">
      <h3>After — Core Model</h3>
      <pre>${esc(r.upgraded.snippets.coreModel)}</pre>
    </div>
  </div>
  <div class="panel full">
    <h3>Reasoning chain — Core Teaching</h3>
    <pre>${esc(r.upgraded.snippets.coreTeaching)}</pre>
  </div>
  <div class="grid three">
    <div class="panel"><h3>Common Mistake</h3><pre>${esc(r.upgraded.snippets.commonMistake)}</pre></div>
    <div class="panel"><h3>Exam Tip</h3><pre>${esc(r.upgraded.snippets.examTip)}</pre></div>
    <div class="panel"><h3>Worked Example</h3><pre>${esc(r.upgraded.snippets.workedExample)}</pre></div>
  </div>
</section>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Phase 3H.1.8a Manual Review</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; background: #f6f7f9; color: #1a1a1a; }
    h1 { margin-bottom: 0.25rem; }
    .subtitle { color: #555; margin-bottom: 2rem; }
    .topic { background: #fff; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .meta { color: #666; margin-bottom: 1rem; font-size: 0.95rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
    .grid.three { grid-template-columns: 1fr 1fr 1fr; }
    .panel { background: #fafbfc; border: 1px solid #e2e5ea; border-radius: 8px; padding: 1rem; }
    .panel.before { border-left: 4px solid #c0392b; }
    .panel.after { border-left: 4px solid #27ae60; }
    .panel.full { margin-bottom: 1rem; }
    pre { white-space: pre-wrap; word-break: break-word; font-size: 0.85rem; line-height: 1.45; margin: 0; }
    h3 { margin-top: 0; font-size: 1rem; }
  </style>
</head>
<body>
  <h1>Phase 3H.1.8a — Manual Review</h1>
  <p class="subtitle">Teacher-First + Teaching Quality Upgrade | Screenshot this page for review records</p>
  ${cards}
</body>
</html>`;
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("OPENAI_API_KEY missing from backend/.env");
    process.exit(1);
  }

  console.log("\n=== Phase 3H.1.8a Acceptance (baseline vs upgrade) ===\n");

  const results = [];

  for (const cfg of LESSONS) {
    console.log(`--- ${cfg.name} ---`);

    console.log("  Baseline (teacher-first ON, upgrade OFF)…");
    const baseline = await generateLesson({ topic: cfg.topic, upgradeOn: false });

    console.log("  Upgrade (teacher-first ON, upgrade ON)…");
    const upgraded = await generateLesson({ topic: cfg.topic, upgradeOn: true });

    const improved =
      upgraded.quality.reasoning.pass &&
      upgraded.quality.examiner.pass &&
      (!baseline.quality.reasoning.pass || !baseline.quality.examiner.pass);

    console.log(`  Baseline reasoning pass: ${baseline.quality.reasoning.pass}`);
    console.log(`  Upgrade reasoning pass:  ${upgraded.quality.reasoning.pass}`);
    console.log(`  Baseline examiner pass:  ${baseline.quality.examiner.pass}`);
    console.log(`  Upgrade examiner pass:   ${upgraded.quality.examiner.pass}`);
    console.log(`  Opening order (upgrade): ${upgraded.opening.pass ? "PASS" : "FAIL"}`);

    results.push({
      name: cfg.name,
      topic: cfg.topic,
      topicKey: cfg.topicKey,
      baseline: {
        first10Titles: baseline.first10Titles,
        opening: baseline.opening,
        quality: baseline.quality,
        snippets: baseline.snippets,
        promptHasReasoning: baseline.promptHasReasoning,
        promptHasExaminer: baseline.promptHasExaminer,
        generationSeconds: baseline.generationSeconds,
      },
      upgraded: {
        first10Titles: upgraded.first10Titles,
        opening: upgraded.opening,
        quality: upgraded.quality,
        snippets: upgraded.snippets,
        promptHasReasoning: upgraded.promptHasReasoning,
        promptHasExaminer: upgraded.promptHasExaminer,
        generationSeconds: upgraded.generationSeconds,
        fixedTextPath: null,
      },
      regression: {
        openingOrderUnchanged:
          JSON.stringify(baseline.first10Titles) === JSON.stringify(upgraded.first10Titles) ||
          upgraded.opening.pass,
        openingPass: upgraded.opening.pass,
      },
      improved,
      pass:
        upgraded.opening.pass &&
        upgraded.promptHasReasoning &&
        upgraded.promptHasExaminer &&
        upgraded.quality.reasoning.pass &&
        upgraded.quality.examiner.pass,
    });

    const lessonOutDir = path.join(root, "docs", "design", "validation", "3H18a");
    fs.mkdirSync(lessonOutDir, { recursive: true });
    const lessonFile = path.join(
      lessonOutDir,
      `${cfg.topicKey.split(":").pop()}-upgrade.txt`
    );
    fs.writeFileSync(lessonFile, upgraded.fixedText, "utf8");
    results[results.length - 1].upgraded.fixedTextPath = lessonFile;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "3H.1.8a",
    flags: {
      TEACHER_BRAIN_TEACHER_FIRST_OPENING: "1",
      baselineUpgrade: "0",
      upgradedUpgrade: "1",
    },
    results,
    summary: {
      allPass: results.every((r) => r.pass),
      allOpeningPass: results.every((r) => r.regression.openingPass),
      improvedCount: results.filter((r) => r.improved).length,
    },
  };

  const reportPath = path.join(__dirname, "manualAcceptance3H18a-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const reviewDir = path.join(root, "docs", "design", "validation", "3H18a");
  fs.mkdirSync(reviewDir, { recursive: true });
  const mdPath = path.join(reviewDir, "MANUAL_REVIEW.md");
  const htmlPath = path.join(reviewDir, "MANUAL_REVIEW.html");
  fs.writeFileSync(mdPath, buildReviewMarkdown(results), "utf8");
  fs.writeFileSync(htmlPath, buildReviewHtml(results), "utf8");

  console.log("\nReport written:", reportPath);
  console.log("Review pack:", mdPath);
  console.log("Review HTML (open for screenshots):", htmlPath);
  console.log("\n=== SUMMARY ===");
  results.forEach((r) =>
    console.log(`  ${r.pass ? "PASS" : "FAIL"} — ${r.topic} (improved vs baseline: ${r.improved})`)
  );

  process.exit(report.summary.allPass && report.summary.allOpeningPass ? 0 : 2);
}

main().catch((err) => {
  console.error("\nAcceptance failed:", err.message || err);
  process.exit(1);
});
