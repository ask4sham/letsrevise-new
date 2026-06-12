/**
 * Phase 3b.3f.9 — Educational refinement for Required Practical: Reaction Time.
 * Augments existing RP blocks in place; does not change the 19-block SS1 shell.
 */

const { isReactionTimePractical } = require("./requiredPracticalMode");

const EXAMINER_THINKING_MARKER = /students often lose marks|the examiner is looking for|a full-mark answer should|avoid saying|say this instead/i;
const GRADE79_MARKER = /practice effect|valid measure of intelligence|caffeine.*synaptic|excluding anomalies.*bias|grade\s*7[\s–-]*9/i;
const RETRIEVAL_MARKER = /quick check|before (method|analysis|evaluation|conclusion):/i;
const PATTERN_MARKER = /repeat\s*\+\s*mean|fair test\s*\+\s*control|unusual result\s*=|method improvement must link/i;
const SUMMARY_MARKER = /three things to remember/i;
const WORKED_ANOMALY_MARKER = /0\.65|excluding the anomaly|identify the anomaly/i;
const REAL_WORLD_HOOK_MARKER = /driving reaction distance|sport reaction time|gaming|visual response speed/i;
const PRACTICAL_WHY_MARKER = /why repeat measurements\?|why calculate a mean\?|why control variables\?|why identify anomalies\?|why use the same ruler height/i;

function blockText(block) {
  return `${String(block?.title || "")} ${String(block?.content || "")} ${String(block?.prompt || "")} ${String(block?.explanation || "")}`;
}

function findBlock(blocks, specs = []) {
  if (!Array.isArray(blocks)) return null;
  for (const spec of specs) {
    const hit = blocks.find((b) => {
      const role = String(b?.role || "").toLowerCase();
      const title = String(b?.title || "").toLowerCase();
      if (spec.role && role === spec.role.toLowerCase()) return true;
      if (spec.titleRe && spec.titleRe.test(title)) return true;
      return false;
    });
    if (hit) return hit;
  }
  return null;
}

function appendIfMissing(block, marker, section) {
  if (!block || !section) return false;
  const content = String(block.content || "").trim();
  if (marker.test(content)) return false;
  block.content = content ? `${content}\n\n${section.trim()}` : section.trim();
  return true;
}

const EXAMINER_THINKING_SECTION = [
  "**Examiner thinking**",
  "- **Students often lose marks because** they confuse reaction time with reflex action — reaction time is the interval between stimulus and response; a reflex arc is the pathway, not the time itself.",
  "- **The examiner is looking for** linked ideas: reliability (repeat + mean), validity (fair test + control variables), and accuracy (closer to true value).",
  "- **A full-mark answer should** name the anomaly, justify excluding it, show the mean calculation, and link an improvement to a specific source of error.",
  "- **Avoid saying:** \"the experiment was inaccurate\" without naming reliability, validity, or a control variable.",
  "- **Say this instead:** \"Repeating five times and calculating a mean improves reliability; keeping the same ruler height controls a variable for validity.\"",
].join("\n");

const GRADE79_SECTION = [
  "**Grade 7–9 reasoning**",
  "- Explain why improved reaction time after repeated attempts may show a **practice effect** (learning the drop pattern), not a faster nervous system.",
  "- Evaluate whether reaction time is a **valid measure of intelligence** — it measures stimulus–response speed, not overall cognitive ability.",
  "- Explain how **caffeine** may increase alertness and affect **synaptic transmission**, potentially shortening reaction time.",
  "- Explain why **excluding anomalies** can improve reliability but may introduce **bias** if results are removed without justification.",
].join("\n");

const PATTERN_RECOGNITION_SECTION = [
  "**Exam pattern rules**",
  "- **repeat + mean + range** → reliability",
  "- **fair test + control variables** → validity",
  "- **true value / calibrated equipment** → accuracy",
  "- **unusual result** → anomaly (justify before excluding)",
  "- **method improvement** must link to the **source of error** (e.g. anticipation → random release intervals)",
].join("\n");

const REAL_WORLD_HOOKS_SECTION = [
  "**Real-world links (GCSE exam tone)**",
  "- **Driving:** reaction distance depends on reaction time before braking.",
  "- **Sport:** athletes train to reduce response time to a starting signal.",
  "- **Gaming / visual response:** screen-based tasks measure how quickly the nervous system responds to a stimulus.",
  "- **Caffeine and alertness:** stimulants may affect synaptic transmission and measured reaction time.",
].join("\n");

const PRACTICAL_WHY_SECTION = [
  "**Practical understanding — why?**",
  "- **Why repeat measurements?** To reduce the effect of random error and improve reliability.",
  "- **Why calculate a mean?** To summarise typical results when individual readings vary.",
  "- **Why control variables?** So only the independent variable changes — a fair test for validity.",
  "- **Why identify anomalies?** An unusual result may skew the mean; exclude only with evidence (e.g. ruler slipped, anticipated drop).",
  "- **Why use the same ruler height?** So the stimulus and starting position stay constant.",
  "- **Why compare the same participant before/after caffeine?** To control for individual differences and isolate the effect of caffeine.",
].join("\n");

const RETRIEVAL_METHOD = "**Quick check (before method):** What is a stimulus? *(A change in the environment detected by a receptor.)*";
const RETRIEVAL_ANALYSIS = "**Quick check (before analysis):** Why repeat measurements? *(To improve reliability and reduce random error.)*";
const RETRIEVAL_EVALUATION = "**Quick check (before evaluation):** What is a control variable? *(A factor kept the same so the test is fair.)*";
const RETRIEVAL_CONCLUSION = "**Quick check (before conclusion):** What does a shorter reaction time mean? *(The nervous system responded faster to the stimulus.)*";

const WORKED_ANOMALY_SECTION = [
  "**Worked example — anomaly and mean (exam standard)**",
  "",
  "**Question:** A student's reaction times are: **0.24 s, 0.22 s, 0.65 s, 0.23 s, 0.21 s**. Calculate the mean reaction time, **excluding the anomaly**.",
  "",
  "**Step 1 — Identify the anomaly:** 0.65 s is much higher than the other readings (likely anticipation, distraction, or mis-catch).",
  "**Step 2 — Remove the anomaly:** Use 0.24, 0.22, 0.23, 0.21 s only.",
  "**Step 3 — Calculate:** (0.24 + 0.22 + 0.23 + 0.21) ÷ 4 = **0.90 ÷ 4 = 0.225 s**",
  "**Step 4 — Final answer:** Mean reaction time = **0.23 s** (2 d.p.) excluding the anomaly.",
  "",
  "**Examiner reasoning:** Examiners reward identifying *why* 0.65 s is anomalous, showing the calculation, and stating that excluding unjustified results improves reliability but must be fair.",
].join("\n");

const SUMMARY_UPGRADE = [
  "**Three Things To Remember:**",
  "1. **Reaction time** measures how quickly the nervous system responds to a stimulus.",
  "2. **Repeating measurements** and calculating a **mean** improves reliability.",
  "3. **Caffeine or practice** may affect reaction time, but conclusions must be based on **valid evidence** and fair control of variables.",
].join("\n");

/**
 * @param {object} draft
 * @param {{ topic?: string, topicKey?: string, subTopic?: string }} ctx
 */
function ensureReactionTimeEducationalRefinement(draft, ctx = {}) {
  if (!draft?.pages?.length || !isReactionTimePractical(ctx)) return draft;

  for (const page of draft.pages) {
    const blocks = page.blocks;
    if (!Array.isArray(blocks)) continue;

    const scientificBackground = findBlock(blocks, [
      { role: "scientificBackground" },
      { titleRe: /scientific background/i },
    ]);
    const practicalPurpose = findBlock(blocks, [
      { role: "practicalPurpose" },
      { titleRe: /practical purpose/i },
    ]);
    const method = findBlock(blocks, [{ role: "method" }, { titleRe: /^method$/i }]);
    const processing = findBlock(blocks, [
      { role: "processingResults" },
      { titleRe: /processing results/i },
    ]);
    const analysis = findBlock(blocks, [{ role: "analysis" }, { titleRe: /^analysis$/i }]);
    const evaluationGrid = findBlock(blocks, [
      { role: "evaluationGrid" },
      { titleRe: /evaluation grid/i },
    ]);
    const commonMistake = findBlock(blocks, [
      { role: "commonMistake" },
      { titleRe: /common mistakes/i },
    ]);
    const examTip = findBlock(blocks, [
      { role: "examTechnique" },
      { titleRe: /exam technique/i },
    ]);
    const examPractice = findBlock(blocks, [
      { role: "examPractice" },
      { titleRe: /required practical exam practice/i },
      { titleRe: /exam practice/i },
    ]);
    const summary = findBlock(blocks, [{ role: "synthesis" }, { titleRe: /^summary$/i }]);
    const variables = findBlock(blocks, [{ role: "variables" }, { titleRe: /^variables$/i }]);

    if (scientificBackground && !REAL_WORLD_HOOK_MARKER.test(blockText(scientificBackground))) {
      appendIfMissing(scientificBackground, REAL_WORLD_HOOK_MARKER, REAL_WORLD_HOOKS_SECTION);
    } else if (practicalPurpose && !REAL_WORLD_HOOK_MARKER.test(blockText(practicalPurpose))) {
      appendIfMissing(practicalPurpose, REAL_WORLD_HOOK_MARKER, REAL_WORLD_HOOKS_SECTION);
    }

    if (method) {
      appendIfMissing(method, RETRIEVAL_MARKER, RETRIEVAL_METHOD);
      appendIfMissing(method, PRACTICAL_WHY_MARKER, PRACTICAL_WHY_SECTION);
    }

    if (variables && !/why control variables/i.test(blockText(variables))) {
      appendIfMissing(variables, /why control variables/i, RETRIEVAL_EVALUATION);
    }

    if (processing) {
      appendIfMissing(processing, WORKED_ANOMALY_MARKER, WORKED_ANOMALY_SECTION);
    }

    if (analysis) {
      appendIfMissing(analysis, RETRIEVAL_MARKER, RETRIEVAL_ANALYSIS);
    }

    if (evaluationGrid) {
      appendIfMissing(evaluationGrid, RETRIEVAL_MARKER, RETRIEVAL_EVALUATION);
    }

    if (commonMistake) {
      appendIfMissing(commonMistake, EXAMINER_THINKING_MARKER, EXAMINER_THINKING_SECTION);
      appendIfMissing(commonMistake, PATTERN_MARKER, PATTERN_RECOGNITION_SECTION);
    } else if (examTip) {
      appendIfMissing(examTip, EXAMINER_THINKING_MARKER, EXAMINER_THINKING_SECTION);
      appendIfMissing(examTip, PATTERN_MARKER, PATTERN_RECOGNITION_SECTION);
    }

    if (examTip && !EXAMINER_THINKING_MARKER.test(blockText(examTip))) {
      appendIfMissing(examTip, EXAMINER_THINKING_MARKER, EXAMINER_THINKING_SECTION);
    }

    if (examPractice) {
      appendIfMissing(examPractice, GRADE79_MARKER, GRADE79_SECTION);
      if (!WORKED_ANOMALY_MARKER.test(blockText(examPractice)) && !WORKED_ANOMALY_MARKER.test(blockText(processing))) {
        appendIfMissing(examPractice, WORKED_ANOMALY_MARKER, WORKED_ANOMALY_SECTION);
      }
    }

    if (summary) {
      appendIfMissing(summary, RETRIEVAL_MARKER, RETRIEVAL_CONCLUSION);
      if (!SUMMARY_MARKER.test(blockText(summary))) {
        const existing = String(summary.content || "").trim();
        summary.content = existing ? `${existing}\n\n${SUMMARY_UPGRADE}` : SUMMARY_UPGRADE;
      }
    }
  }

  return draft;
}

module.exports = {
  ensureReactionTimeEducationalRefinement,
  EXAMINER_THINKING_MARKER,
  GRADE79_MARKER,
  RETRIEVAL_MARKER,
  PATTERN_MARKER,
  SUMMARY_MARKER,
  WORKED_ANOMALY_MARKER,
  REAL_WORLD_HOOK_MARKER,
  PRACTICAL_WHY_MARKER,
};
