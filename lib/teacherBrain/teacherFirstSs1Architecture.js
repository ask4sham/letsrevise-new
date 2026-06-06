/**
 * Phase 3H.1.5 — Teacher-first SS1 structural ordering.
 * When TEACHER_BRAIN_TEACHER_FIRST_OPENING=1, SS1 shell obeys knowledge-before-scenario.
 */

/** Locked opening order — do not change without explicit evidence (Phase 3H.1.6). */
const TEACHER_FIRST_OPENING_ORDER_VERSION = "3H.1.6-locked";

function isTeacherFirstOpeningEnabled() {
  return String(process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING || "0").trim() === "1";
}

/** Classic 20-block SS1 shell (scenario at block 3). */
const CLASSIC_SS1_CANONICAL_SLOTS = [
  { key: "objectives", title: "LESSON OBJECTIVES", paste: "Text (concept)" },
  { key: "priorKnowledge", title: "PRIOR KNOWLEDGE", paste: "Text (concept)" },
  { key: "scenario", title: "SCENARIO", paste: "Hook (text)" },
  { key: "coreRule", title: "CORE RULE", paste: "Core rule (key idea)" },
  { key: "coreTeaching", title: "CORE TEACHING", paste: "Text (concept)" },
  { key: "checkpoint", title: "CHECKPOINT", paste: "Checkpoint block" },
  { key: "dragDrop", title: "DRAG AND DROP MATCH", paste: "Drag and drop match" },
  { key: "commonMistake", title: "COMMON MISTAKE", paste: "Common mistake" },
  { key: "diagram", title: "DIAGRAM / VISUAL SETUP", paste: "Diagram (concept)" },
  { key: "stepByStep", title: "STEP-BY-STEP PROCESS", paste: "Step-by-step diagram (process)" },
  { key: "interactiveDiagram", title: "INTERACTIVE DIAGRAM", paste: "Interactive diagram" },
  { key: "examTip", title: "EXAM TIP", paste: "Exam tip (concept)" },
  { key: "workedExample", title: "WORKED EXAMPLE", paste: "Worked example (checkpoint)" },
  { key: "quickCheck", title: "QUICK CHECK", paste: "Quick check (checkpoint)" },
  { key: "synthesis", title: "SYNTHESIS", paste: "Synthesis (key idea)" },
  { key: "selfCheck", title: "SELF-CHECK QUESTION", paste: "Self-check question" },
  { key: "finalMemoryRule", title: "FINAL MEMORY RULE", paste: "Final memory rule (key idea)" },
  { key: "examPractice", title: "EXAM PRACTICE", paste: "Text (concept)" },
  { key: "summary", title: "SUMMARY", paste: "Text (concept)" },
  { key: "keywords", title: "KEY WORDS", paste: "Key words" },
];

/** Teacher-first 24-block SS1 shell (scenario at block 8). */
const TEACHER_FIRST_SS1_CANONICAL_SLOTS = [
  { key: "objectives", title: "LESSON OBJECTIVES", paste: "Text (concept)" },
  { key: "priorKnowledge", title: "PRIOR KNOWLEDGE", paste: "Text (concept)" },
  { key: "definition", title: "DEFINITION", paste: "Text (concept)" },
  { key: "whyItMatters", title: "WHY IT MATTERS", paste: "Text (concept)" },
  { key: "coreModel", title: "CORE MODEL", paste: "Core rule (key idea)" },
  { key: "keyExamples", title: "KEY EXAMPLES", paste: "Text (concept)" },
  { key: "examVocabulary", title: "EXAM VOCABULARY", paste: "Text (concept)" },
  { key: "scenario", title: "SCENARIO", paste: "Hook (text)" },
  { key: "coreTeaching", title: "CORE TEACHING", paste: "Text (concept)" },
  { key: "checkpoint", title: "CHECKPOINT", paste: "Checkpoint block" },
  { key: "dragDrop", title: "DRAG AND DROP MATCH", paste: "Drag and drop match" },
  { key: "commonMistake", title: "COMMON MISTAKE", paste: "Common mistake" },
  { key: "diagram", title: "DIAGRAM / VISUAL SETUP", paste: "Diagram (concept)" },
  { key: "stepByStep", title: "STEP-BY-STEP PROCESS", paste: "Step-by-step diagram (process)" },
  { key: "interactiveDiagram", title: "INTERACTIVE DIAGRAM", paste: "Interactive diagram" },
  { key: "examTip", title: "EXAM TIP", paste: "Exam tip (concept)" },
  { key: "workedExample", title: "WORKED EXAMPLE", paste: "Worked example (checkpoint)" },
  { key: "quickCheck", title: "QUICK CHECK", paste: "Quick check (checkpoint)" },
  { key: "synthesis", title: "SYNTHESIS", paste: "Synthesis (key idea)" },
  { key: "selfCheck", title: "SELF-CHECK QUESTION", paste: "Self-check question" },
  { key: "finalMemoryRule", title: "FINAL MEMORY RULE", paste: "Final memory rule (key idea)" },
  { key: "examPractice", title: "EXAM PRACTICE", paste: "Text (concept)" },
  { key: "summary", title: "SUMMARY", paste: "Text (concept)" },
  { key: "keywords", title: "KEY WORDS", paste: "Key words" },
];

const CLASSIC_MANDATORY_ARCHITECTURE_SEQUENCE = [
  "objectives",
  "priorKnowledge",
  "scenario",
  "coreRule",
  "teachChunk1",
  "checkpoint1",
  "teachChunk2",
  "visualActivity",
  "teachChunk3",
  "interactiveActivity",
  "teachChunk4",
  "applicationActivity",
  "examTechnique",
  "examPractice",
  "summary",
  "keywords",
  "revisionPractice",
];

const TEACHER_FIRST_MANDATORY_ARCHITECTURE_SEQUENCE = [
  "objectives",
  "priorKnowledge",
  "definition",
  "whyItMatters",
  "coreModel",
  "keyExamples",
  "examVocabulary",
  "scenario",
  "teachChunk1",
  "checkpoint1",
  "teachChunk2",
  "visualActivity",
  "teachChunk3",
  "interactiveActivity",
  "teachChunk4",
  "applicationActivity",
  "examTechnique",
  "examPractice",
  "summary",
  "keywords",
  "revisionPractice",
];

const TEACHER_FIRST_KNOWLEDGE_SLOTS = [
  "definition",
  "whyItMatters",
  "coreModel",
  "keyExamples",
  "examVocabulary",
];

const TEACHER_FIRST_SLOT_META = {
  objectives: { phase: "foundation", category: "foundation", expectedTypes: ["keyIdea", "text"] },
  priorKnowledge: { phase: "foundation", category: "foundation", expectedTypes: ["text"] },
  definition: { phase: "foundation", category: "foundation", expectedTypes: ["text", "keyIdea"] },
  whyItMatters: { phase: "foundation", category: "foundation", expectedTypes: ["text", "keyIdea"] },
  coreModel: { phase: "foundation", category: "foundation", expectedTypes: ["keyIdea", "text-concept"] },
  keyExamples: { phase: "foundation", category: "foundation", expectedTypes: ["text", "keyIdea"] },
  examVocabulary: { phase: "foundation", category: "foundation", expectedTypes: ["text", "keyWords"] },
  scenario: { phase: "foundation", category: "foundation", expectedTypes: ["text", "hook"] },
  teachChunk1: { phase: "teach", category: "learning", expectedTypes: ["text", "text-concept", "keyIdea"] },
  checkpoint1: { phase: "retrieval", category: "learning", expectedTypes: ["checkpoint", "self-check-question"] },
  teachChunk2: { phase: "teach", category: "learning", expectedTypes: ["text", "text-concept", "keyIdea"] },
  visualActivity: { phase: "application", category: "learning", expectedTypes: ["diagram", "graph"] },
  teachChunk3: { phase: "teach", category: "learning", expectedTypes: ["text", "text-concept", "keyIdea"] },
  interactiveActivity: {
    phase: "application",
    category: "learning",
    expectedTypes: ["dragDropMatch", "interactiveSequence", "hotspot"],
  },
  teachChunk4: { phase: "teach", category: "learning", expectedTypes: ["text", "text-concept", "keyIdea"] },
  applicationActivity: {
    phase: "application",
    category: "learning",
    expectedTypes: ["dragDropMatch", "checkpoint", "commonMistake"],
  },
  examTechnique: { phase: "exam", category: "endgame", expectedTypes: ["examTip", "text"] },
  examPractice: { phase: "exam", category: "endgame", expectedTypes: ["text", "exam-practice"] },
  summary: { phase: "summary", category: "endgame", expectedTypes: ["keyIdea", "text", "summary"] },
  keywords: { phase: "summary", category: "endgame", expectedTypes: ["keyWords", "text"] },
  revisionPractice: {
    phase: "mastery",
    category: "endgame",
    expectedTypes: ["checkpoint", "self-check-question"],
  },
};

function isTeacherFirstSs1Enabled() {
  return isTeacherFirstOpeningEnabled();
}

function getSs1CanonicalSlots() {
  return isTeacherFirstSs1Enabled()
    ? TEACHER_FIRST_SS1_CANONICAL_SLOTS
    : CLASSIC_SS1_CANONICAL_SLOTS;
}

function getMandatoryArchitectureSequence() {
  return isTeacherFirstSs1Enabled()
    ? TEACHER_FIRST_MANDATORY_ARCHITECTURE_SEQUENCE
    : CLASSIC_MANDATORY_ARCHITECTURE_SEQUENCE;
}

function getFoundationSlots() {
  return isTeacherFirstSs1Enabled()
    ? [
        "objectives",
        "priorKnowledge",
        "definition",
        "whyItMatters",
        "coreModel",
        "keyExamples",
        "examVocabulary",
        "scenario",
      ]
    : ["objectives", "priorKnowledge", "scenario", "coreRule"];
}

function getSlotMeta(slot) {
  if (isTeacherFirstSs1Enabled() && TEACHER_FIRST_SLOT_META[slot]) {
    return TEACHER_FIRST_SLOT_META[slot];
  }
  return null;
}

function getSs1SlotIndex(slotKey) {
  const slots = getSs1CanonicalSlots();
  return slots.findIndex((s) => s.key === slotKey);
}

function getSs1BlockNumber(slotKey) {
  const idx = getSs1SlotIndex(slotKey);
  return idx >= 0 ? idx + 1 : null;
}

function getCoreTeachingOverflowSlotIndex() {
  return getSs1SlotIndex("coreTeaching");
}

/**
 * Build SS1 block-order prompt section for buildPrompt.js.
 * @param {{ topic?: string }} [ctx]
 */
function buildSs1BlockOrderPromptSection(ctx = {}) {
  const topic = ctx.topic || "this topic";
  if (!isTeacherFirstSs1Enabled()) {
    return buildClassicSs1BlockOrderPromptSection(topic);
  }

  const blockCount = TEACHER_FIRST_SS1_CANONICAL_SLOTS.length;
  const lines = [
    "--------------------------------",
    "SS1 BLOCK ORDER (NON-NEGOTIABLE — PAGE 1)",
    "--------------------------------",
    "",
    `Output ONE page (PAGE 1) unless the topic genuinely needs a second page. Number blocks sequentially in EXACTLY this order and paste target. The first ${blockCount} blocks are required types in this sequence; you may insert extra numbered "Text (concept)" teaching beats ONLY after block 9 (Core Teaching) if the topic needs more explanation — then continue the numbered list without breaking required types below.`,
    "",
    "TEACHER-FIRST OPENING ENFORCEMENT (when this section is present):",
    "- Teach core knowledge BEFORE any scenario.",
    "- Blocks 3–7 are Definition → Why it matters → Core model → Key examples → Exam vocabulary.",
    "- Block 8 (Scenario) must be SHORT and must support the core model already taught.",
    '- Do NOT open block 8 with "Imagine..." or "Question to carry".',
    "- Do NOT put Scenario before Definition.",
    "",
  ];

  TEACHER_FIRST_SS1_CANONICAL_SLOTS.forEach((slot, i) => {
    lines.push(`${i + 1} — ${slot.title}`);
    lines.push(`Paste into: ${slot.paste}`);
    lines.push("");
  });

  lines.push(
    "Do NOT put Scenario before Definition, Why it matters, Core model, Key examples, or Exam vocabulary.",
    "Do NOT put Key words anywhere except after Summary.",
    "Do NOT skip or reorder these required paste targets."
  );

  return lines.join("\n");
}

function buildClassicSs1BlockOrderPromptSection(topic) {
  return `--------------------------------
SS1 BLOCK ORDER (NON-NEGOTIABLE — PAGE 1)
--------------------------------

Output ONE page (PAGE 1) unless the topic genuinely needs a second page. Number blocks sequentially in EXACTLY this order and paste target. The first 20 blocks are required types in this sequence; you may insert extra numbered "Text (concept)" teaching beats ONLY after block 5 (Core Teaching) if the topic needs more explanation — then continue the numbered list without breaking required types below.

1 — LESSON OBJECTIVES
Paste into: Text (concept)

2 — PRIOR KNOWLEDGE
Paste into: Text (concept)

3 — SCENARIO
Paste into: Hook (text)

4 — CORE RULE
Paste into: Core rule (key idea)

5 — CORE TEACHING
Paste into: Text (concept)

6 — CHECKPOINT
Paste into: Checkpoint block

7 — DRAG AND DROP MATCH
Paste into: Drag and drop match

8 — COMMON MISTAKE
Paste into: Common mistake

9 — DIAGRAM / VISUAL SETUP
Paste into: Diagram (concept)

10 — STEP-BY-STEP PROCESS
Paste into: Step-by-step diagram (process)

11 — INTERACTIVE DIAGRAM
Paste into: Interactive diagram

12 — EXAM TIP
Paste into: Exam tip (concept)

13 — WORKED EXAMPLE
Paste into: Worked example (checkpoint)

14 — QUICK CHECK
Paste into: Quick check (checkpoint)

15 — SYNTHESIS
Paste into: Synthesis (key idea)

16 — SELF-CHECK QUESTION
Paste into: Self-check question

17 — FINAL MEMORY RULE
Paste into: Final memory rule (key idea)

18 — EXAM PRACTICE
Paste into: Text (concept)

19 — SUMMARY
Paste into: Text (concept)

20 — KEY WORDS
Paste into: Key words

Do NOT put Scenario before Lesson Objectives or Prior Knowledge.
Do NOT put Key words anywhere except after Summary.
Do NOT skip or reorder these required paste targets.`;
}

/**
 * First-blocks template section for buildPrompt.js.
 * @param {{ topic?: string }} [ctx]
 */
function buildSs1FirstBlocksTemplateSection(ctx = {}) {
  const topic = ctx.topic || "this topic";
  if (!isTeacherFirstSs1Enabled()) {
    return buildClassicSs1FirstBlocksTemplateSection(topic);
  }

  return `--------------------------------
BLOCK OUTPUT FORMAT (FIRST BLOCKS — TEMPLATE)
--------------------------------

PAGE 1

1 — LESSON OBJECTIVES
Paste into: Text (concept)

<h2><strong>Lesson objectives</strong></h2>
<p>At the end of this lesson, you should be able to:</p>
<ul>
<li><strong>👉</strong> State the definition of <strong>${topic}</strong> in clear GCSE language.</li>
<li><strong>👉</strong> Explain <strong>why it matters</strong> for cells, enzymes, or survival.</li>
<li><strong>👉</strong> Use the <strong>core model</strong> in exam explanations.</li>
<li><strong>👉</strong> Apply the idea to short exam-style prompts.</li>
</ul>

2 — PRIOR KNOWLEDGE
Paste into: Text (concept)

<h2><strong>Prior knowledge</strong></h2>
<p>Before we start, you should already know:</p>
<ul>
<li>[prior idea 1]</li>
<li>[prior idea 2]</li>
<li>[prior idea 3]</li>
</ul>

3 — DEFINITION
Paste into: Text (concept)

<h2><strong>Definition</strong></h2>
<p>👉 <strong>[One clear GCSE definition sentence — no story, no scenario]</strong></p>

4 — WHY IT MATTERS
Paste into: Text (concept)

<h2><strong>Why it matters</strong></h2>
<p>👉 <strong>[One sentence on why this concept matters biologically or in exams]</strong></p>

5 — CORE MODEL
Paste into: Core rule (key idea)

<h2><strong>Core model</strong></h2>
<p>👉 <strong>[The key GCSE model or pathway — e.g. Receptors → Coordination centre → Effectors]</strong></p>

6 — KEY EXAMPLES
Paste into: Text (concept)

<h2><strong>Key examples</strong></h2>
<ul>
<li>[example 1]</li>
<li>[example 2]</li>
<li>[example 3]</li>
</ul>

7 — EXAM VOCABULARY
Paste into: Text (concept)

<h2><strong>Exam vocabulary</strong></h2>
<p><strong>[term 1]</strong>, <strong>[term 2]</strong>, <strong>[term 3]</strong>, <strong>[term 4]</strong>, <strong>[term 5]</strong></p>

8 — SCENARIO
Paste into: Hook (text)

<h2><strong>Apply the model</strong></h2>
<p>👉 <strong>[One short scenario that illustrates the core model already taught — max 2–3 sentences. No "Imagine..." opening. No "Question to carry".]</strong></p>

9 — CORE TEACHING
Paste into: Text (concept)

<h2><strong>Teaching: ${topic}</strong></h2>
<p>👉 Build on the definition and core model with structured classroom explanation.</p>
<h3><strong>Key idea:</strong></h3>
<p>[One short sentence]</p>
<h3><strong>What happens:</strong></h3>
<ul>
<li>[point]</li>
<li>[cause → effect point]</li>
</ul>
<h3><strong>Structure → function / Process → effect:</strong></h3>
<ul>
<li>[science-appropriate chain]</li>
</ul>
<h3><strong>Think like an examiner:</strong></h3>
<p>👉 [How to phrase for marks — short.]</p>

Then continue with blocks 10–${TEACHER_FIRST_SS1_CANONICAL_SLOTS.length} exactly as listed in SS1 BLOCK ORDER (use the strict interactive formats below for drag-drop, diagrams, checkpoints, etc.).

Do NOT use the word "BLOCK".`;
}

function buildClassicSs1FirstBlocksTemplateSection(topic) {
  return `--------------------------------
BLOCK OUTPUT FORMAT (FIRST BLOCKS — TEMPLATE)
--------------------------------

PAGE 1

1 — LESSON OBJECTIVES
Paste into: Text (concept)

<h2><strong>Lesson objectives</strong></h2>
<p>At the end of this lesson, you should be able to:</p>
<ul>
<li><strong>👉</strong> Describe <strong>[specific key idea]</strong> in clear classroom language.</li>
<li><strong>👉</strong> Explain <strong>[process]</strong> with a cause → effect chain.</li>
<li><strong>👉</strong> Spot common mistakes and fix them like a teacher would in class.</li>
<li><strong>👉</strong> Apply the idea to short exam-style prompts.</li>
</ul>

2 — PRIOR KNOWLEDGE
Paste into: Text (concept)

<h2><strong>Prior knowledge</strong></h2>
<p>Before we start, you should already know:</p>
<ul>
<li>[prior idea 1]</li>
<li>[prior idea 2]</li>
<li>[prior idea 3]</li>
<li>[prior idea 4]</li>
</ul>

3 — SCENARIO
Paste into: Hook (text)

<h2><strong>Right, let's look at this…</strong></h2>
<p>👉 Imagine a typical question about <strong>${topic}</strong> that sounds easy until you have to explain <em>why</em> it matters.</p>
<p>This is the bit of the lesson where we slow down and talk it through like you're <em>in the room</em> — not reading a revision guide.</p>
<p><strong>Question to carry:</strong> what is really happening, step by step?</p>

4 — CORE RULE
Paste into: Core rule (key idea)

<h2><strong>The rule we're building today</strong></h2>
<p>👉 The key thing to remember is <strong>[one sentence — the "headline" rule]</strong>.</p>
<p>Everything else in this lesson hangs off that idea.</p>

5 — CORE TEACHING
Paste into: Text (concept)

<h2><strong>[Topic-specific teaching title]</strong></h2>
<p>👉 [One direct teacher line that sounds spoken, not textbook.]</p>
<h3><strong>Key idea:</strong></h3>
<p>[One short sentence]</p>
<h3><strong>What happens:</strong></h3>
<ul>
<li>[point]</li>
<li>[cause → effect point]</li>
</ul>
<h3><strong>Why this matters:</strong></h3>
<ul>
<li>[exam or real-world line]</li>
</ul>
<h3><strong>Structure → function / Process → effect:</strong></h3>
<ul>
<li>[science-appropriate chain]</li>
</ul>
<h3><strong>Think like an examiner:</strong></h3>
<p>👉 [How to phrase for marks — short.]</p>
<h3><strong>In short:</strong></h3>
<ul>
<li>[recap 1]</li>
<li>[recap 2]</li>
<li>[recap 3]</li>
</ul>

Then continue with blocks 6–20 exactly as listed in SS1 BLOCK ORDER (use the strict interactive formats below for 7, 9–11, 13, etc.).

Do NOT use the word "BLOCK".`;
}

/**
 * Mandatory interactive blocks section (block numbers shift in teacher-first mode).
 */
function buildSs1NonNegotiableRequirementsSection() {
  const finalMemory = getSs1BlockNumber("finalMemoryRule") || 17;
  const examTip = getSs1BlockNumber("examTip") || 12;
  const checkpoint = getSs1BlockNumber("checkpoint") || 6;
  const quickCheck = getSs1BlockNumber("quickCheck") || 14;

  const teacherFirstNote = isTeacherFirstSs1Enabled()
    ? `
TEACHER-FIRST STRUCTURAL RULE:
- Blocks 3–7 MUST teach Definition → Why it matters → Core model → Key examples → Exam vocabulary BEFORE block 8 Scenario.
- Block 4 "Why it matters" is separate from block ${examTip} exam-tip 🌍 section — both may exist.
`
    : "";

  return `Before you finish, your draft MUST satisfy ALL of the following. If ANY item is missing or only partially met, treat the draft as INVALID: revise internally (do not describe the revision), then output ONLY the single corrected full lesson.
${teacherFirstNote}
1) EXACTLY ONE 💡 Key Insight section
   - Put it in block ${finalMemory} — FINAL MEMORY RULE — Paste into: Final memory rule (key idea).
   - The visible title MUST include the 💡 Key Insight wording using HTML only, for example:
     <h2><strong>💡 Key Insight</strong></h2>
     (or <p><strong>💡 Key Insight</strong></p> if it is clearly the section title, followed by the rule.)

2) EXACTLY ONE 🌍 Why this matters section
   - The main heading MUST be exactly this HTML pattern:
     <h2><strong>🌍 Why this matters</strong></h2>
   - Do NOT satisfy this with only a small <h3> inside another block — it must be a full <h2> section.
   - Recommended: place this section first inside block ${examTip} (EXAM TIP — Paste into: Exam tip (concept)), before Premium Exam Tip and answer-quality modelling.

3) EXACTLY ONE 🎯 Premium Exam Tip section
   - The main heading MUST be exactly this HTML pattern:
     <h2><strong>🎯 Premium Exam Tip</strong></h2>
   - Place inside block ${examTip} after 🌍 Why this matters (still Paste into: Exam tip (concept)).

4) EXACTLY ONE answer-quality modelling sequence with these EXACT labels (including colons):
   - Weak answer:
   - Better answer:
   - Full-mark answer:
   - In HTML use <h3><strong>Weak answer:</strong></h3> then <p>...</p>, and the same pattern for Better and Full-mark.
   - Add a short follow-up, e.g. <h3><strong>Why the full-mark answer is stronger:</strong></h3> with a <ul><li>...</li></ul>.
   - Place the full sequence inside block ${examTip} after 🎯 Premium Exam Tip.

5) At least TWO checkpoint-style multiple-choice questions
   - Follow CHECKPOINT FORMAT exactly (Question + Option 1–4 + Answer).
   - Block ${checkpoint} (Checkpoint block) and block ${quickCheck} (Quick check (checkpoint)) must both be present, complete, and distinct.`;
}

function buildSs1MandatoryInteractiveBlocksSection() {
  if (!isTeacherFirstSs1Enabled()) {
    return `Every lesson MUST include (matching the SS1 order above):

- Lesson Objectives (Text concept) as block 1 and Prior Knowledge as block 2
- Scenario (Hook text) as block 3 — substantive teacher-style scenario, never empty
- Core rule (key idea) and Core teaching (Text concept)
- at least 1 main Checkpoint block AND 1 Quick check (checkpoint) — both required, Option 1–4 checkpoint format (satisfies "at least 2 checkpoint-style MCQs")
- block 12 Exam tip (concept) MUST contain in order: <h2><strong>🌍 Why this matters</strong></h2>, then <h2><strong>🎯 Premium Exam Tip</strong></h2>, then answer-quality modelling with exact labels Weak answer: / Better answer: / Full-mark answer: (see NON-NEGOTIABLE REQUIREMENTS)
- block 17 Final memory rule (key idea) MUST be the sole 💡 Key Insight section (see NON-NEGOTIABLE REQUIREMENTS)`;
  }

  const checkpoint = getSs1BlockNumber("checkpoint");
  const quickCheck = getSs1BlockNumber("quickCheck");
  const examTip = getSs1BlockNumber("examTip");
  const finalMemory = getSs1BlockNumber("finalMemoryRule");

  return `Every lesson MUST include (matching the SS1 order above):

- Lesson Objectives (Text concept) as block 1 and Prior Knowledge as block 2
- Definition, Why it matters, Core model, Key examples, and Exam vocabulary as blocks 3–7 — explicit teaching BEFORE any scenario
- Scenario (Hook text) as block 8 ONLY — short, supports the core model; never empty; never before block 7
- Core teaching (Text concept) as block 9
- at least 1 main Checkpoint block (block ${checkpoint}) AND 1 Quick check (block ${quickCheck}) — both required, Option 1–4 checkpoint format
- block ${examTip} Exam tip (concept) MUST contain in order: <h2><strong>🌍 Why this matters</strong></h2>, then <h2><strong>🎯 Premium Exam Tip</strong></h2>, then answer-quality modelling with exact labels Weak answer: / Better answer: / Full-mark answer:
- block ${finalMemory} Final memory rule (key idea) MUST be the sole 💡 Key Insight section`;
}

module.exports = {
  TEACHER_FIRST_OPENING_ORDER_VERSION,
  CLASSIC_SS1_CANONICAL_SLOTS,
  TEACHER_FIRST_SS1_CANONICAL_SLOTS,
  CLASSIC_MANDATORY_ARCHITECTURE_SEQUENCE,
  TEACHER_FIRST_MANDATORY_ARCHITECTURE_SEQUENCE,
  TEACHER_FIRST_KNOWLEDGE_SLOTS,
  isTeacherFirstSs1Enabled,
  getSs1CanonicalSlots,
  getMandatoryArchitectureSequence,
  getFoundationSlots,
  getSlotMeta,
  getSs1SlotIndex,
  getSs1BlockNumber,
  getCoreTeachingOverflowSlotIndex,
  buildSs1BlockOrderPromptSection,
  buildSs1FirstBlocksTemplateSection,
  buildSs1NonNegotiableRequirementsSection,
  buildSs1MandatoryInteractiveBlocksSection,
};
