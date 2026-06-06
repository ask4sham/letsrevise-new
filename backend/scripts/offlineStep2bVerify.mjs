/**
 * Offline Step 2b verify — full authority stack on Step 2 NS failure artifacts.
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
};

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
  process.env.TEACHER_BRAIN_MEMORY_RULE_AUTHORITY = "1";

  const { deterministicAutoFixLesson } = await import("../../lib/deterministicAutoFixLesson.js");
  const { findClosingDriftTermsInText } = require("../../lib/teacherBrain/closingScopeUtils.js");

  console.log("=== Step 2 NS failure artifacts — full authority stack (2a + 2b) ===\n");

  for (const run of [2, 3, 4]) {
    const raw = fs.readFileSync(path.join(STEP2_DIR, `nervous-system-run${run}-raw.txt`), "utf8");
    const memBefore = extractSection(raw, /\bFINAL\s+MEMORY\s+RULE\b|\bKEY\s+INSIGHT\b/i);
    const sumBefore = extractSection(raw, /\bSUMMARY\b/i);

    const { text: fixed, fixesApplied, summaryGate, memoryRuleGate } = deterministicAutoFixLesson({
      text: raw,
      subject: "Biology",
      topic: NS_CFG.topic,
      topicKey: NS_CFG.topicKey,
    });

    const memAfter = extractSection(fixed, /\bFINAL\s+MEMORY\s+RULE\b|\bKEY\s+INSIGHT\b/i);
    const sumAfter = extractSection(fixed, /\bSUMMARY\b/i);
    const memDriftBefore = findClosingDriftTermsInText(memBefore);
    const memDriftAfter = findClosingDriftTermsInText(memAfter);
    const sumDriftAfter = findClosingDriftTermsInText(sumAfter);

    console.log(`Run ${run}:`);
    console.log(`  Memory Rule drift: ${memDriftBefore.length} → ${memDriftAfter.length}`, memDriftAfter);
    console.log(`  Summary drift after: ${sumDriftAfter.length}`);
    console.log(`  summaryGate: ${summaryGate?.pass}, memoryRuleGate: ${memoryRuleGate?.pass}`);
    console.log(`  fixes:`, fixesApplied.filter((f) => /Summary authority|Memory Rule authority/i.test(f)));
    console.log(`  lessonClean: ${memDriftAfter.length === 0 && sumDriftAfter.length === 0}`);
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
