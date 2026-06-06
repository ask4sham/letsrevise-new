/**
 * Offline Step 2a verify — re-autofix Step 2 NS failure artifacts with Summary Authority.
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const require = createRequire(import.meta.url);

const STEP2_DIR = path.join(root, "docs", "design", "validation", "3H18b1-robustness-step2");
const NS_CFG = {
  topic: "Structure and function of the nervous system",
  topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
  driftTerms: [
    "cerebellum", "cortex", "medulla", "thermoregulation", "hypothalamus",
    "retina", "sweating",
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

async function main() {
  process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
  process.env.TEACHER_BRAIN_OBJECTIVES_AUTHORITY = "1";
  process.env.TEACHER_BRAIN_CHECKPOINT_AUTHORITY = "1";
  process.env.TEACHER_BRAIN_EXAM_PRACTICE_AUTHORITY = "1";
  process.env.TEACHER_BRAIN_SUMMARY_AUTHORITY = "1";

  const { deterministicAutoFixLesson } = await import("../../lib/deterministicAutoFixLesson.js");
  const { findClosingDriftTermsInText } = require("../../lib/teacherBrain/summaryAuthority.js");

  for (const run of [2, 3, 4]) {
    const rawPath = path.join(STEP2_DIR, `nervous-system-run${run}-raw.txt`);
    const raw = fs.readFileSync(rawPath, "utf8");
    const summaryBefore = extractSection(raw, /\bSUMMARY\b/i);
    const memBefore = extractSection(raw, /\bFINAL\s+MEMORY\s+RULE\b|\bKEY\s+INSIGHT\b/i);

    const { text: fixed, fixesApplied, summaryGate } = deterministicAutoFixLesson({
      text: raw,
      subject: "Biology",
      topic: NS_CFG.topic,
      topicKey: NS_CFG.topicKey,
    });

    const summaryAfter = extractSection(fixed, /\bSUMMARY\b/i);
    const memAfter = extractSection(fixed, /\bFINAL\s+MEMORY\s+RULE\b|\bKEY\s+INSIGHT\b/i);

    const summaryDriftBefore = findClosingDriftTermsInText(summaryBefore);
    const summaryDriftAfter = findClosingDriftTermsInText(summaryAfter);
    const memDriftAfter = findDriftTerms(memAfter, NS_CFG.driftTerms);
    const lessonClean =
      summaryDriftAfter.length === 0 && findDriftTerms(memAfter, NS_CFG.driftTerms).length === 0;

    console.log(`\n=== NS run ${run} ===`);
    console.log("summary drift:", summaryDriftBefore.length, "→", summaryDriftAfter.length);
    console.log("memory rule drift after:", memDriftAfter);
    console.log("summaryGate:", summaryGate?.pass);
    console.log("lessonClean (summary+mem):", lessonClean);
    console.log("fixes:", fixesApplied.filter((f) => /Summary authority/i.test(f)));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
