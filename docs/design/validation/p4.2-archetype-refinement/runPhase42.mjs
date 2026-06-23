/**
 * Phase 4.1 — Archetype Educational Validation (SI OFF vs ON).
 * Evidence only — not product code.
 */
import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..", "..");
const outDir = __dirname;

dotenv.config({ path: path.resolve(root, "backend", ".env"), override: true });

const TOPICS = [
  { group: "maths", slug: "algebra", subject: "Maths", examBoard: "Edexcel", topic: "Algebra", archetype: "maths-algebra" },
  { group: "maths", slug: "simultaneous-equations", subject: "Maths", examBoard: "Edexcel", topic: "Simultaneous Equations", archetype: "maths-simultaneous" },
  { group: "maths", slug: "quadratics", subject: "Maths", examBoard: "Edexcel", topic: "Quadratics", archetype: "maths-quadratics" },
  { group: "maths", slug: "graphs", subject: "Maths", examBoard: "Edexcel", topic: "Graphs", archetype: "maths-graph" },
  { group: "maths", slug: "probability", subject: "Maths", examBoard: "Edexcel", topic: "Probability", archetype: "maths-probability" },
  { group: "maths", slug: "ratio", subject: "Maths", examBoard: "Edexcel", topic: "Ratio", archetype: "maths-ratio" },
  { group: "maths", slug: "trigonometry", subject: "Maths", examBoard: "Edexcel", topic: "Trigonometry", archetype: "maths-trigonometry" },
  { group: "physics", slug: "forces", subject: "Physics", examBoard: "AQA", topic: "Forces", archetype: "physics-force-system" },
  { group: "physics", slug: "energy", subject: "Physics", examBoard: "AQA", topic: "Energy", archetype: "physics-energy-transfer" },
  { group: "physics", slug: "electricity", subject: "Physics", examBoard: "AQA", topic: "Electricity", archetype: "physics-circuit" },
  { group: "physics", slug: "waves", subject: "Physics", examBoard: "AQA", topic: "Waves", archetype: "physics-wave" },
  { group: "history", slug: "causes", subject: "History", examBoard: "AQA", topic: "Causes of WW1", archetype: "history-cause" },
  { group: "history", slug: "consequences", subject: "History", examBoard: "AQA", topic: "Treaty of Versailles", archetype: "history-consequence" },
  { group: "history", slug: "significance", subject: "History", examBoard: "AQA", topic: "Significance of the Holocaust", archetype: "history-significance" },
  { group: "history", slug: "interpretations", subject: "History", examBoard: "AQA", topic: "Historians' interpretations of the Cold War", archetype: "history-interpretation" },
];

function setFlags(siOn) {
  process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
  process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
  process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2 = "1";
  process.env.TEACHER_BRAIN_GRADE89_CHALLENGE_V1 = "1";
  process.env.TEACHER_BRAIN_CORE_LEARNING_DISCIPLINE_V1 = "1";
  process.env.TEACHER_BRAIN_WORKED_REASONING_V2 = "1";
  process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
  process.env.TEACHER_BRAIN_OBJECTIVES_AUTHORITY = "1";
  process.env.TEACHER_BRAIN_SUBJECT_INTELLIGENCE_V1 = siOn ? "1" : "0";
}

async function callOpenAi(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
  const manifest = { generatedAt: new Date().toISOString(), topics: [] };

  for (const cfg of TOPICS) {
    console.log(`\n=== [${cfg.group}] ${cfg.topic} ===`);
    const entry = { ...cfg, files: {} };

    for (const siOn of [false, true]) {
      setFlags(siOn);
      const label = siOn ? "on" : "off";
      const { buildPrompt } = await import(pathToFileURL(path.join(root, "lib/buildPrompt.js")).href);
      const prompt = buildPrompt({
        subject: cfg.subject,
        keyStage: "KS4 - GCSE",
        examBoard: cfg.examBoard,
        topic: cfg.topic,
        subTopic: cfg.topic,
        tier: "Higher Tier",
      });

      const start = Date.now();
      const raw = await callOpenAi(prompt);
      const seconds = ((Date.now() - start) / 1000).toFixed(1);
      const file = path.join(outDir, `${cfg.group}-${cfg.slug}-si-${label}.txt`);
      fs.writeFileSync(file, raw, "utf8");
      entry.files[label] = { path: file, chars: raw.length, seconds, promptChars: prompt.length };
      console.log(`  SI=${label.toUpperCase()} ${seconds}s ${raw.length} chars`);
    }

    manifest.topics.push(entry);
  }

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("\nDone:", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
