/**
 * Pre-push verification for milestone-teacher-first-v1-stable-patch1.
 * Usage: node backend/scripts/prePushPatch1Verify.mjs
 */
import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const generatorRoot = path.resolve(root, "..", "letsrevise-generator");

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: true });

process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING =
  process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING || "1";
process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION =
  process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION || "1";
process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY =
  process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY || "2";
process.env.TEACHER_BRAIN_PRIORITY_ENGINE =
  process.env.TEACHER_BRAIN_PRIORITY_ENGINE || "1";
process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE =
  process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE || "1";
process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE =
  process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE || "1";

const TOPIC_CFG = {
  name: "Respiration",
  topic: "Aerobic and anaerobic respiration",
  topicKey: "aqa-gcse-biology:respiration",
};

const INTRO_STEP_LINE_RE =
  /^(?:[-•*]\s*)?Step\s+(\d+)\s*([—–\-:])\s*(.+)$/i;
const INTRO_STEP_BLOB_RE =
  /(?:[-•*]\s*)?Step\s+(\d+)\s*([—–\-:])\s*([\s\S]*?)(?=(?:\s+(?:[-•*]\s*)?Step\s+\d+\s*(?:[—–\-:]))|$)/gi;

function parseIntroStepList(intro) {
  const raw = String(intro ?? "").trim();
  if (!raw || /<[a-z][\s\S]*>/i.test(raw)) return null;
  const lines = raw.split(/\r?\n/);
  const steps = [];
  let firstStepLineIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].trim().match(INTRO_STEP_LINE_RE);
    if (m) {
      if (firstStepLineIndex < 0) firstStepLineIndex = i;
      steps.push(`Step ${m[1]} — ${m[3].trim()}`);
    }
  }
  const markerCount = (raw.match(/(?:[-•*]\s*)?Step\s+\d+\s*(?:[—–\-:])/gi) || []).length;
  if (steps.length > 0 && steps.length >= markerCount) {
    const preamble = lines
      .slice(0, firstStepLineIndex)
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n\n");
    return { preamble, steps };
  }
  const blobSteps = [];
  let match;
  INTRO_STEP_BLOB_RE.lastIndex = 0;
  while ((match = INTRO_STEP_BLOB_RE.exec(raw)) !== null) {
    blobSteps.push(`Step ${match[1]} — ${String(match[3]).trim()}`);
  }
  if (!blobSteps.length) return null;
  const firstMatch = raw.search(/(?:[-•*]\s*)?Step\s+\d+\s*(?:[—–\-:])/i);
  return { preamble: firstMatch > 0 ? raw.slice(0, firstMatch).trim() : "", steps: blobSteps };
}

function mergeIntroFields(intro, content) {
  const a = String(intro ?? "").trim();
  const b = String(content ?? "").trim();
  if (!a) return b;
  if (!b) return a;
  return `${a}\n\n${b}`;
}

function ss1TextToPages(text) {
  const blocks = [];
  const chunks = String(text || "").split(/\n(?=\d+\s*[—\-–]\s+)/);
  for (const chunk of chunks) {
    const header = chunk.match(/^(\d+)\s*[—\-–]\s+([^\n]+)/);
    if (!header) continue;
    const title = header[2].trim();
    const body = chunk.replace(/^[^\n]+\n(?:Paste into:[^\n]+\n)?/, "").trim();
    blocks.push({ type: "text", title, content: body });
  }
  return blocks.length ? [{ blocks }] : [];
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text;
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

function headingTitles(blocks) {
  return blocks.map((b) => String(b.headingTitle || b.title || "").toUpperCase());
}

function validateBlockOrder(titles) {
  const defIdx = titles.indexOf("DEFINITION");
  const scenarioIdx = titles.findIndex((t) => t === "SCENARIO" || t.includes("HOOK"));
  const checks = {
    definitionIndex: defIdx,
    scenarioIndex: scenarioIdx,
    hasRevisionObjectives: titles.some((t) => t.includes("REVISION OBJECTIVES") || t.includes("LESSON OBJECTIVES")),
    hasSummary: titles.some((t) => t === "SUMMARY"),
    hasKeywords: titles.some((t) => t.includes("KEY WORDS")),
    hasSelfCheck: titles.some((t) => t.includes("SELF-CHECK") || t.includes("SELF CHECK")),
    hasExamPractice: titles.some((t) => t.includes("EXAM PRACTICE")),
    hasWorkedExample: titles.some((t) => t.includes("WORKED")),
    hasDragDrop: titles.some((t) => t.includes("DRAG")),
    hasInteractiveDiagram: titles.some(
      (t) => t.includes("INTERACTIVE DIAGRAM") || t.includes("DIAGRAM")
    ),
    hasStepByStep: titles.some(
      (t) => t.includes("STEP-BY-STEP") || t.includes("STEP BY STEP")
    ),
    definitionIsBlock3: defIdx === 2,
    scenarioIsBlock4: scenarioIdx === 3,
  };
  checks.pass =
    checks.definitionIsBlock3 &&
    checks.scenarioIsBlock4 &&
    checks.hasSummary &&
    checks.hasKeywords;
  return checks;
}

async function main() {
  const { buildPrompt } = await import(pathToFileURL(path.join(root, "lib/buildPrompt.js")).href);
  const { deterministicAutoFixLesson } = await import(
    pathToFileURL(path.join(root, "lib/deterministicAutoFixLesson.js")).href
  );
  const { buildGeneratorExportPayload } = await import(
    pathToFileURL(path.join(generatorRoot, "lib/buildGeneratorExportJson.js")).href
  );

  console.log("\n=== Pre-push patch1 verification ===");
  console.log(`Topic: ${TOPIC_CFG.name} (${TOPIC_CFG.topic})`);

  const prompt = buildPrompt({
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: TOPIC_CFG.topic,
    tier: "Higher Tier",
  });

  const genStart = Date.now();
  const raw = await callOpenAiSs1(prompt);
  const { text: fixedText } = deterministicAutoFixLesson({
    text: raw,
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: TOPIC_CFG.topic,
    topicKey: TOPIC_CFG.topicKey,
  });

  const doc = buildGeneratorExportPayload({
    title: TOPIC_CFG.topic,
    topic: TOPIC_CFG.topic,
    subject: "Biology",
    lessonText: fixedText,
  });

  const blocks = (doc.pages || []).flatMap((p) => p.blocks || []);
  const titles = headingTitles(blocks);
  const orderChecks = validateBlockOrder(titles);

  const seqBlock = blocks.find((b) => b.editorType === "interactiveSequence");
  const introRaw = mergeIntroFields(seqBlock?.payload?.intro, seqBlock?.payload?.content);
  const stepList = parseIntroStepList(introRaw);

  const report = {
    topic: TOPIC_CFG.name,
    generationSeconds: ((Date.now() - genStart) / 1000).toFixed(1),
    blockCount: blocks.length,
    firstTenTitles: titles.slice(0, 10),
    orderChecks,
    stepByStep: {
      found: Boolean(seqBlock),
      editorType: seqBlock?.editorType || null,
      introPreview: String(introRaw || "").slice(0, 400),
      stepCount: stepList?.steps?.length || 0,
      steps: stepList?.steps || [],
      rendersAsList: (stepList?.steps?.length || 0) >= 3,
      notSingleParagraph: (stepList?.steps?.length || 0) >= 3,
    },
    pass:
      orderChecks.pass &&
      (stepList?.steps?.length || 0) >= 3,
  };

  const outPath = path.join(__dirname, "prePushPatch1Verify-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));

  if (!report.pass) {
    console.error("\nVERIFICATION FAILED");
    process.exit(1);
  }
  console.log("\nVERIFICATION PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
