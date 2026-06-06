/**
 * Offline Step 2 verification — re-autofix Step 1 robustness raw artifacts.
 * Usage: node backend/scripts/offlineStep2Verify.mjs
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const require = createRequire(import.meta.url);

const STEP1_DIR = path.join(root, "docs", "design", "validation", "3H18b1-robustness");
const NS_CFG = {
  id: "nervous-system",
  topic: "Structure and function of the nervous system",
  topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
  driftTerms: [
    "cerebellum", "cortex", "medulla", "thermoregulation", "hypothalamus",
    "accommodation", "retina", "iris", "pupil", "lens",
    "vasodilation", "vasoconstriction", "sweating", "shivering",
  ],
};

function findDriftTerms(text, termList) {
  const hay = String(text || "").toLowerCase();
  return termList.filter((t) => hay.includes(t.toLowerCase()));
}

function extractSection(text, headingRe) {
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

function scan(text, oa) {
  const checkpoints = [
    extractSection(text, /\bCHECKPOINT\b/i),
    extractSection(text, /\bQUICK\s+CHECK\b/i),
    extractSection(text, /\bDRAG\s+AND\s+DROP\b/i),
  ].join("\n");
  const examPractice = extractSection(text, /\bEXAM\s+PRACTICE\b/i);
  const summary = extractSection(text, /\bSUMMARY\b/i);
  const downstream = [checkpoints, examPractice, summary].join("\n");
  return {
    checkpointDrift: findDriftTerms(checkpoints, NS_CFG.driftTerms),
    examDrift: findDriftTerms(examPractice, NS_CFG.driftTerms),
    summaryDrift: findDriftTerms(summary, NS_CFG.driftTerms),
    totalDownstream: findDriftTerms(downstream, NS_CFG.driftTerms).length,
    checkpointGate: require("../../lib/teacherBrain/checkpointAuthority.js").evaluateCheckpointAuthorityGate(text, NS_CFG),
    examGate: require("../../lib/teacherBrain/examPracticeAuthority.js").evaluateExamPracticeAuthorityGate(text, NS_CFG),
    objectivesGate: oa.evaluateObjectivesAuthorityGate(text, NS_CFG),
  };
}

async function main() {
  process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
  process.env.TEACHER_BRAIN_OBJECTIVES_AUTHORITY = "1";
  process.env.TEACHER_BRAIN_CHECKPOINT_AUTHORITY = "1";
  process.env.TEACHER_BRAIN_EXAM_PRACTICE_AUTHORITY = "1";

  const { deterministicAutoFixLesson } = await import("../../lib/deterministicAutoFixLesson.js");
  const oa = require("../../lib/teacherBrain/objectivesAuthority.js");

  for (const run of [1, 4, 5]) {
    const rawPath = path.join(STEP1_DIR, `nervous-system-run${run}-raw.txt`);
    const raw = fs.readFileSync(rawPath, "utf8");
    const before = scan(raw, oa);
    const { text: fixed, fixesApplied, checkpointGate, examPracticeGate } = deterministicAutoFixLesson({
      text: raw,
      subject: "Biology",
      topic: NS_CFG.topic,
      topicKey: NS_CFG.topicKey,
    });
    const after = scan(fixed, oa);
    console.log(`\n=== NS run ${run} ===`);
    console.log("before:", {
      cp: before.checkpointDrift.length,
      exam: before.examDrift.length,
      sum: before.summaryDrift.length,
      total: before.totalDownstream,
    });
    console.log("after:", {
      cp: after.checkpointDrift.length,
      exam: after.examDrift.length,
      sum: after.summaryDrift.length,
      total: after.totalDownstream,
      checkpointGate: checkpointGate?.pass,
      examGate: examPracticeGate?.pass,
    });
    console.log("assessment fixes:", fixesApplied.filter((f) => /Checkpoint scope|Exam practice scope/i.test(f)));
    if (after.checkpointDrift.length) console.log("  cp terms:", after.checkpointDrift);
    if (after.examDrift.length) console.log("  exam terms:", after.examDrift);
    if (after.summaryDrift.length) console.log("  sum terms:", after.summaryDrift);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
