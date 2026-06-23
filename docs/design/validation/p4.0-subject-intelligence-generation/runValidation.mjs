/**
 * Phase 4.0 generation validation — SI=0 vs SI=1 (evidence only, not product code).
 */
import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import dotenv from "dotenv";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..", "..");
const outDir = __dirname;
const require = createRequire(import.meta.url);

dotenv.config({ path: path.resolve(root, "backend", ".env"), override: true });

const TOPICS = [
  { slug: "photosynthesis", subject: "Biology", examBoard: "AQA", topic: "Photosynthesis", topicKey: "aqa-gcse-biology:photosynthesis" },
  { slug: "atomic-structure", subject: "Chemistry", examBoard: "AQA", topic: "Atomic Structure", topicKey: "aqa-gcse-chemistry:atomic-structure" },
  { slug: "forces", subject: "Physics", examBoard: "AQA", topic: "Forces", topicKey: "aqa-gcse-physics:forces" },
  { slug: "algebra", subject: "Maths", examBoard: "Edexcel", topic: "Algebra", topicKey: "edexcel-gcse-maths:algebra" },
  { slug: "causes-of-ww1", subject: "History", examBoard: "AQA", topic: "Causes of WW1", topicKey: "" },
];

const TARGET_RX = [
  { key: "coreTeaching", rx: /core\s+teaching|core\s+learning/i },
  { key: "commonMistake", rx: /common\s+mistake/i },
  { key: "examTechnique", rx: /exam\s+technique/i },
  { key: "workedExample", rx: /worked\s+example/i },
  { key: "examPractice", rx: /exam\s+practice/i },
];

function extractBlocks(text = "") {
  const lines = String(text || "").split("\n");
  const bodies = {};
  let i = 0;
  while (i < lines.length) {
    const header = lines[i].match(/^(\d+)\s*[—\-–]\s+(.+)$/i);
    if (!header) {
      i += 1;
      continue;
    }
    const title = header[2].trim();
    const match = TARGET_RX.find((p) => p.rx.test(title));
    if (match) {
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^(\d+)\s*[—\-–]\s+/i.test(lines[j]) || /^PAGE\s+\d/i.test(lines[j].trim())) {
          end = j;
          break;
        }
      }
      bodies[match.key] = lines.slice(i, end).join("\n");
    }
    i += 1;
  }
  return bodies;
}

function countRx(hay, rx, flags = "gi") {
  const m = String(hay || "").match(new RegExp(rx, flags));
  return m ? m.length : 0;
}

function analyzeLesson(text, meta, siOn) {
  const { resolveSubjectIntelligence } = require(path.join(root, "lib/teacherBrain/subjectIntelligenceResolver.js"));
  const resolved = resolveSubjectIntelligence(meta);
  const bodies = extractBlocks(text);
  const teachingHay = Object.values(bodies).join("\n");
  const fullHay = String(text || "");

  const examinerConnectives = countRx(
    teachingHay,
    "\\b(because|therefore|thus|as a result|leading to|resulting in|consequently|so that|whereas|however|in contrast)\\b"
  );
  const examinerFraming = countRx(
    teachingHay,
    "students often write|examiners expect|do not say|creditworthy|mark.?losing|in the exam, say"
  );

  const subjectTerms = (resolved.subjectProfile.commonMisconceptions || [])
    .concat(resolved.subjectProfile.assessmentPriorities || [])
    .concat(resolved.archetype.commonMisconceptions || [])
    .concat(resolved.archetype.progressionSteps || []);
  const subjectTermHits = subjectTerms.filter((t) =>
    fullHay.toLowerCase().includes(String(t).toLowerCase().slice(0, Math.min(20, String(t).length)))
  ).length;

  const skillWords = [
    "explain", "describe", "evaluate", "compare", "analyse", "analyze", "justify", "calculate", "interpret",
  ];
  const skillUsage = Object.fromEntries(
    skillWords.map((w) => [w, countRx(fullHay, `\\b${w}\\b`)])
  );
  const higherOrder =
    skillUsage.evaluate + skillUsage.compare + skillUsage.analyse + skillUsage.analyze + skillUsage.justify;

  const misconceptionBlock = bodies.commonMistake || "";
  const misconceptionSignals = countRx(
    misconceptionBlock,
    "misconception|confus|mistake|wrong|incorrect|instead|do not|avoid"
  );

  const dataInterp = countRx(
    fullHay,
    "graph|table|data shows|trend|interpret|from the (graph|table)|rate|gradient"
  );

  const challenge = countRx(
    fullHay,
    "evaluate|to what extent|assess|grade 8|grade 9|stretch|unfamiliar context|justify"
  );

  const depth = countRx(
    teachingHay,
    "\\b(mechanism|pathway|process|step|stage|because|therefore|leading to|results in|causes)\\b"
  );
  const arrowChains = countRx(fullHay, "→|->");

  return {
    siOn,
    subjectKey: resolved.subjectKey,
    archetypeKey: resolved.archetypeKey,
    primarySkill: resolved.primarySkillKey,
    examinerConnectives,
    examinerFraming,
    subjectTermHits,
    skillUsage,
    higherOrder,
    misconceptionSignals,
    dataInterp,
    challenge,
    explanationDepth: depth + arrowChains * 2,
    blockLengths: Object.fromEntries(
      Object.entries(bodies).map(([k, v]) => [k, String(v || "").length])
    ),
    teachingChars: teachingHay.length,
  };
}

function promptSiDelta(prompt) {
  return {
    hasSubjectIntelligenceMarker: /SUBJECT INTELLIGENCE V1 \(4\.0\)/.test(prompt),
    hasArchetypeFallback: /SUBJECT INTELLIGENCE FALLBACK|CONCEPT ARCHETYPE:/.test(prompt),
    siSectionChars: (prompt.match(/SUBJECT INTELLIGENCE V1[\s\S]*?(?=\n-{10,}|$)/) || [""])[0].length,
  };
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

async function main() {
  const report = { generatedAt: new Date().toISOString(), topics: [] };

  for (const cfg of TOPICS) {
    console.log(`\n=== ${cfg.topic} ===`);
    const topicReport = { ...cfg, off: null, on: null, promptDelta: null, metricsDelta: null };

    for (const siOn of [false, true]) {
      setFlags(siOn);
      const label = siOn ? "ON" : "OFF";
      console.log(`Generating SI=${label}…`);

      const { buildPrompt } = await import(pathToFileURL(path.join(root, "lib/buildPrompt.js")).href);
      const prompt = buildPrompt({
        subject: cfg.subject,
        keyStage: "KS4 - GCSE",
        examBoard: cfg.examBoard,
        topic: cfg.topic,
        topicKey: cfg.topicKey,
        subTopic: cfg.topic,
        tier: "Higher Tier",
      });

      if (!siOn) {
        topicReport.promptDelta = {
          off: promptSiDelta(prompt),
        };
      } else {
        topicReport.promptDelta.on = promptSiDelta(prompt);
        topicReport.promptDelta.extraChars =
          prompt.length - (topicReport._offPromptLen || prompt.length);
      }
      if (!siOn) topicReport._offPromptLen = prompt.length;

      const start = Date.now();
      const raw = await callOpenAi(prompt);
      const seconds = ((Date.now() - start) / 1000).toFixed(1);

      const file = path.join(outDir, `${cfg.slug}-si-${siOn ? "on" : "off"}.txt`);
      fs.writeFileSync(file, raw, "utf8");

      const meta = {
        topic: cfg.topic,
        subject: cfg.subject,
        topicKey: cfg.topicKey,
        subTopic: cfg.topic,
      };
      const metrics = analyzeLesson(raw, meta, siOn);
      metrics.generationSeconds = seconds;
      metrics.outputChars = raw.length;
      metrics.promptChars = prompt.length;

      if (siOn) topicReport.on = metrics;
      else topicReport.off = metrics;

      console.log(`  SI=${label} done (${seconds}s, ${raw.length} chars)`);
    }

    topicReport.promptDelta.extraChars =
      (topicReport.promptDelta.on?.siSectionChars || 0) > 0
        ? topicReport.promptDelta.on.siSectionChars
        : 0;

    topicReport.metricsDelta = {
      examinerConnectives: topicReport.on.examinerConnectives - topicReport.off.examinerConnectives,
      examinerFraming: topicReport.on.examinerFraming - topicReport.off.examinerFraming,
      subjectTermHits: topicReport.on.subjectTermHits - topicReport.off.subjectTermHits,
      higherOrder: topicReport.on.higherOrder - topicReport.off.higherOrder,
      misconceptionSignals: topicReport.on.misconceptionSignals - topicReport.off.misconceptionSignals,
      dataInterp: topicReport.on.dataInterp - topicReport.off.dataInterp,
      challenge: topicReport.on.challenge - topicReport.off.challenge,
      explanationDepth: topicReport.on.explanationDepth - topicReport.off.explanationDepth,
      teachingChars: topicReport.on.teachingChars - topicReport.off.teachingChars,
    };

    delete topicReport._offPromptLen;
    report.topics.push(topicReport);
  }

  fs.writeFileSync(path.join(outDir, "generation-report.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Phase 4.0 Generation Validation — SI OFF vs ON",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Prompt injection evidence",
    "",
    "| Topic | SI marker in prompt (OFF) | SI marker in prompt (ON) | Extra SI chars |",
    "|-------|---------------------------|--------------------------|----------------|",
    ...report.topics.map(
      (t) =>
        `| ${t.topic} | ${t.promptDelta.off.hasSubjectIntelligenceMarker} | ${t.promptDelta.on.hasSubjectIntelligenceMarker} | ${t.promptDelta.on.siSectionChars} |`
    ),
    "",
    "## Metrics delta (ON − OFF)",
    "",
    "| Topic | Examiner connectives | Framing | Subject terms | Higher-order | Misconception | Data interp | Challenge | Depth |",
    "|-------|---------------------|---------|---------------|--------------|---------------|-------------|-----------|-------|",
    ...report.topics.map((t) => {
      const d = t.metricsDelta;
      return `| ${t.topic} | ${d.examinerConnectives >= 0 ? "+" : ""}${d.examinerConnectives} | ${d.examinerFraming >= 0 ? "+" : ""}${d.examinerFraming} | ${d.subjectTermHits >= 0 ? "+" : ""}${d.subjectTermHits} | ${d.higherOrder >= 0 ? "+" : ""}${d.higherOrder} | ${d.misconceptionSignals >= 0 ? "+" : ""}${d.misconceptionSignals} | ${d.dataInterp >= 0 ? "+" : ""}${d.dataInterp} | ${d.challenge >= 0 ? "+" : ""}${d.challenge} | ${d.explanationDepth >= 0 ? "+" : ""}${d.explanationDepth} |`;
    }),
    "",
  ].join("\n");

  fs.writeFileSync(path.join(outDir, "GENERATION_VALIDATION_REPORT.md"), md);
  console.log("\nWrote report to", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
