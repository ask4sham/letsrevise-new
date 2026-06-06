/**
 * Phase 3H.1.8b.1 acceptance — Objectives scope authority (Nervous System only).
 * Usage: node backend/scripts/manualAcceptance3H18b1.mjs
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const NS = {
  name: "Structure and function of the nervous system",
  topic: "Structure and function of the nervous system",
  topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
};

const DRIFT_TERMS = [
  "cerebellum",
  "cortex",
  "medulla",
  "thermoregulation",
  "hypothalamus",
  "accommodation",
  "retina",
  "lens",
  "iris",
  "pupil",
];

function extractObjectivesSection(text) {
  const lines = String(text || "").split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^LESSON OBJECTIVE FIELD:/i.test(lines[i])) {
      start = i;
      break;
    }
  }
  let objBlockStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^(\d+)\s*[—\-–]\s+.*LESSON\s+OBJECTIVES/i.test(lines[i])) {
      objBlockStart = i;
      break;
    }
  }
  let objBlockEnd = lines.length;
  if (objBlockStart >= 0) {
    for (let i = objBlockStart + 1; i < lines.length; i++) {
      if (/^(\d+)\s*[—\-–]\s+/i.test(lines[i])) {
        objBlockEnd = i;
        break;
      }
    }
  }
  const fieldEnd =
    lines.findIndex((l, i) => i > 0 && /^SHORT SUMMARY FIELD:/i.test(l.trim())) >= 0
      ? lines.findIndex((l) => /^SHORT SUMMARY FIELD:/i.test(l.trim()))
      : objBlockStart >= 0
        ? objBlockStart
        : 20;
  const fieldSection =
    start >= 0 ? lines.slice(start, fieldEnd > start ? fieldEnd : start + 5).join("\n") : "";
  const blockSection =
    objBlockStart >= 0 ? lines.slice(objBlockStart, objBlockEnd).join("\n") : "";
  return `${fieldSection}\n${blockSection}`.trim();
}

function findDriftTerms(text) {
  const hay = String(text || "").toLowerCase();
  return DRIFT_TERMS.filter((t) => hay.includes(t));
}

function scanSection(text, headingRe) {
  const lines = String(text || "").split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^(\d+)\s*[—\-–]\s+/i.test(lines[i]) && headingRe.test(lines[i])) {
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

function downstreamDriftReport(text) {
  return {
    examPractice: findDriftTerms(scanSection(text, /EXAM\s+PRACTICE/i)),
    checkpoints: findDriftTerms(
      [scanSection(text, /CHECKPOINT/i), scanSection(text, /QUICK\s+CHECK/i)].join("\n")
    ),
    summary: findDriftTerms(scanSection(text, /SUMMARY/i)),
    memoryRule: findDriftTerms(
      scanSection(text, /FINAL\s+MEMORY\s+RULE|KEY\s+INSIGHT/i)
    ),
  };
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
  if (typeof data?.output_text === "string") return data.output_text;
  const parts = [];
  for (const item of data?.output || []) {
    for (const c of item?.content || []) {
      if (c.type === "output_text" && c.text) parts.push(c.text);
    }
  }
  return parts.join("\n");
}

async function main() {
  process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
  process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
  process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
  process.env.TEACHER_BRAIN_OBJECTIVES_AUTHORITY = "1";

  const { buildPrompt } = await import("../../lib/buildPrompt.js");
  const { deterministicAutoFixLesson } = await import("../../lib/deterministicAutoFixLesson.js");
  const { evaluateObjectivesAuthorityGate, scanDownstreamDrift } = await import(
    "../../lib/teacherBrain/objectivesAuthority.js"
  );

  const outDir = path.join(root, "docs", "design", "validation", "3H18b1");
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Generating: ${NS.name}…`);
  const prompt = buildPrompt({
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: NS.topic,
    topicKey: NS.topicKey,
    subTopic: NS.topic,
    tier: "Higher Tier",
  });

  const start = Date.now();
  const raw = await callOpenAiSs1(prompt);
  fs.writeFileSync(path.join(outDir, "nervous-system-raw.txt"), raw, "utf8");

  const objectivesBefore = extractObjectivesSection(raw);
  const driftBeforeObjectives = findDriftTerms(objectivesBefore);
  const downstreamBefore = scanDownstreamDrift(raw);

  const { text: fixedText, objectivesGate, fixesApplied } = deterministicAutoFixLesson({
    text: raw,
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: NS.topic,
    topicKey: NS.topicKey,
  });

  fs.writeFileSync(path.join(outDir, "structure-and-function-of-the-nervous-system.txt"), fixedText, "utf8");

  const objectivesAfter = extractObjectivesSection(fixedText);
  const driftAfterObjectives = findDriftTerms(objectivesAfter);
  const downstreamAfter = scanDownstreamDrift(fixedText);

  const pass = objectivesGate.pass;

  const report = {
    phase: "3H.1.8b.1",
    generatedAt: new Date().toISOString(),
    generationSeconds: ((Date.now() - start) / 1000).toFixed(1),
    pass,
    promptHasObjectivesMandate: prompt.includes("MANDATORY OBJECTIVES"),
    promptHasObjectiveBoundary: prompt.includes("OBJECTIVE BOUNDARY:"),
    objectivesBefore: {
      text: objectivesBefore.slice(0, 2000),
      driftTerms: driftBeforeObjectives,
    },
    objectivesAfter: {
      text: objectivesAfter.slice(0, 2000),
      driftTerms: driftAfterObjectives,
      gate: objectivesGate,
    },
    downstreamBefore,
    downstreamAfter,
    cascadeHypothesis: {
      objectivesCleaned: driftBeforeObjectives.length > 0 && driftAfterObjectives.length === 0,
      downstreamImprovedWithoutExtraAuthority:
        JSON.stringify(downstreamBefore) !== JSON.stringify(downstreamAfter),
      downstreamFullyClean:
        Object.values(downstreamAfter).every((arr) => arr.length === 0),
    },
    scopeFixesApplied: fixesApplied.filter((f) => /Objectives scope authority/i.test(f)),
    artifacts: {
      raw: "docs/design/validation/3H18b1/nervous-system-raw.txt",
      fixed: "docs/design/validation/3H18b1/structure-and-function-of-the-nervous-system.txt",
    },
  };

  fs.writeFileSync(
    path.join(outDir, "manualAcceptance3H18b1-report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(root, "backend", "scripts", "manualAcceptance3H18b1-report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log("\n=== 3H.1.8b.1 Acceptance ===");
  console.log(`PASS (objectives gate): ${pass}`);
  console.log(`Drift before objectives: ${driftBeforeObjectives.join(", ") || "none"}`);
  console.log(`Drift after objectives:  ${driftAfterObjectives.join(", ") || "none"}`);
  console.log("Downstream before:", JSON.stringify(downstreamBefore));
  console.log("Downstream after: ", JSON.stringify(downstreamAfter));
  console.log(`Report: ${path.join(outDir, "manualAcceptance3H18b1-report.json")}`);

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
