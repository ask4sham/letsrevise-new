import { createRequire } from "module";
import {
  findSpecEntry,
  buildSpecPromptSection,
  inferQualificationTypeFromSubject,
  normaliseTierFilter,
} from "./specDatabase/specLookup.js";

const require = createRequire(import.meta.url);
const { formatDragDropImageDesignRequirements } = require("./teacherBrain/dragDropVisualContract.js");
const { buildReferenceLessonMaterialPrompt } = require("./referenceLessonMaterialPrompt.js");
const {
  buildSs1NonNegotiableRequirementsSection,
  buildSs1BlockOrderPromptSection,
  buildSs1FirstBlocksTemplateSection,
  buildSs1MandatoryInteractiveBlocksSection,
  buildSs1AntiDuplicationPromptSection,
  isTeacherFirstSs1Enabled,
} = require("./teacherBrain/teacherFirstSs1Architecture.js");
const { buildTeachingQualityUpgradePromptSection } = require("./teacherBrain/teachingQualityUpgrade.js");
const {
  buildTeacherFirstOpeningPlan,
  formatTeacherFirstOpeningAppendix,
  buildSs1Layer2MandatoryOpeningSection,
} = require("./teacherBrain/teacherFirstKnowledgeEngine.js");

export function buildPrompt({
  subject = "Biology",
  keyStage = "KS4 - GCSE",
  examBoard = "AQA",
  topic,
  topicKey = "",
  subTopic = "",
  extras = "",
  additionalInstructions = "",
  tier: tierParam = "",
  qualification = "",
  qualificationType: qualificationTypeOverride = "",
} = {}) {
  const isBoardSpecific = keyStage === "KS4 - GCSE" || keyStage === "A-Level";

  const qualificationType =
    qualificationTypeOverride || inferQualificationTypeFromSubject(subject);

  const specResult = findSpecEntry({
    subject,
    keyStage,
    examBoard,
    topic,
    tier: tierParam,
    qualification,
    qualificationType,
  });
  const specPromptSection = buildSpecPromptSection(specResult);

  const tierEffective =
    normaliseTierFilter(tierParam) || normaliseTierFilter(topic);
  const tierContextBlock =
    keyStage === "KS4 - GCSE"
      ? tierEffective === "foundation"
        ? `Tier context: Foundation Tier — do not require Higher-only scope unless you clearly label stretch material as such.`
        : tierEffective === "higher"
          ? `Tier context: Higher Tier — include appropriate depth for Higher, including HT statements where relevant to the topic.`
          : `Tier context: Mixed or unspecified — use broadly GCSE-appropriate depth; state tier explicitly in the lesson header if you target one tier.`
      : "";

  const boardInstruction = isBoardSpecific
    ? `Exam Board: ${examBoard}
- Align the lesson to the selected exam board where relevant.
- Use board-appropriate terminology and specification emphasis.
- Do not mention other exam boards.`
    : `Exam Board handling:
- For ${keyStage}, do NOT make the lesson exam-board-specific.`;

  const levelInstruction =
    keyStage === "KS2"
      ? `Language level:
- Use very clear, simple school-friendly wording.
- Keep explanations short and concrete.
- Avoid dense technical language.
- Explain every key term immediately.`
      : keyStage === "KS3"
      ? `Language level:
- Use clear lower-secondary wording.
- Introduce subject vocabulary carefully.
- Explain key terms naturally in context.
- Avoid exam-board jargon.`
      : keyStage === "KS4 - GCSE"
      ? `Language level:
- Keep explanations clearly GCSE level.
- Avoid textbook or A-level density.
- Use simple, precise subject wording.
- Explain terms naturally in context.
- Sound like a strong GCSE teacher, not a revision guide.`
      : `Language level:
- Match A-Level depth.
- Use stronger disciplinary vocabulary.
- Keep explanations precise and analytical.`;

  const subjectUpgrade = getSubjectSpecificUpgrade(subject, keyStage);
  const referencePromptSection = buildReferenceLessonMaterialPrompt(additionalInstructions);
  const ss1NonNegotiableSection = buildSs1NonNegotiableRequirementsSection();
  const ss1BlockOrderSection = buildSs1BlockOrderPromptSection({ topic });
  const ss1FirstBlocksSection = buildSs1FirstBlocksTemplateSection({ topic });
  const ss1MandatoryInteractiveSection = buildSs1MandatoryInteractiveBlocksSection();
  const teachingQualityUpgradeSection = buildTeachingQualityUpgradePromptSection({
    topic,
    title: topic,
    subject,
    keyStage,
    topicKey,
    subTopic: subTopic || topic,
  });

  const teacherFirstLayer2Section = isTeacherFirstSs1Enabled()
    ? (() => {
        const plan = buildTeacherFirstOpeningPlan({
          topic,
          topicKey,
          subTopic: subTopic || topic,
          subject,
        });
        return [
          formatTeacherFirstOpeningAppendix(plan),
          buildSs1Layer2MandatoryOpeningSection(plan),
        ]
          .filter(Boolean)
          .join("\n\n");
      })()
    : "";

  const ss1AntiDuplicationSection = buildSs1AntiDuplicationPromptSection();

  return `
You are creating a premium LetsRevise lesson.

Your output must feel like a real teacher teaching a class — not notes.

IMPORTANT CONTEXT:
Subject: ${subject}
Key Stage: ${keyStage}
Topic: ${topic}
Qualification route (for specification filtering): ${qualificationType || "unspecified — use subject defaults"}
${tierContextBlock ? `${tierContextBlock}\n` : ""}

${specPromptSection}
--------------------------------
SPECIFICATION COVERAGE RULE
--------------------------------
If specification points are provided in SPECIFICATION ALIGNMENT above, every listed point must be taught somewhere in the lesson.

${boardInstruction}

${levelInstruction}

${subjectUpgrade}
${referencePromptSection ? `\n${referencePromptSection}\n` : ""}

--------------------------------
HIDDEN TEACHER THINKING
--------------------------------

Before writing, silently:
1. Identify the core ideas students must understand.
2. Identify likely misconceptions.
3. Plan the strongest teaching order.
4. Decide where students need diagrams.
5. Decide where students need interaction.
6. Decide where exam technique must be taught.
7. Decide how an examiner would award marks.

Do NOT output this planning.
Only output the lesson.

--------------------------------
OUTPUT START RULE
--------------------------------

At the very top include exactly:

LESSON OBJECTIVE FIELD:
[one plain-text sentence only]

SHORT SUMMARY FIELD:
[one plain-text sentence only]

Then output the lesson blocks.

--------------------------------
NON-NEGOTIABLE REQUIREMENTS (QUALITY GATE)
--------------------------------

${ss1NonNegotiableSection}

STRICT SECTION FORMATTING (NO MARKDOWN HEADINGS):
- All major lesson sections (including Objectives, Prior knowledge, 🌍 Why this matters, 🎯 Premium Exam Tip, 💡 Key Insight, modelling blocks, Summary, Key words, etc.) MUST use:
  <h2><strong>Section title</strong></h2>
- Nested teaching beats: <h3><strong>...</strong></h3> only.
- Do NOT use ### or ##. Do NOT use **bold** for headings — use <strong> inside <h2>/<h3> as shown.

ANSWER-QUALITY MODELLING — COPY THIS HTML STRUCTURE (replace bracketed content with topic-specific text; keep labels verbatim):

<h2><strong>🎯 Answer Quality Modelling</strong></h2>
<p>👉 This is how to move from a basic answer to a full-mark explanation.</p>

<h3><strong>Weak answer:</strong></h3>
<p>A very short statement about <strong>[topic idea]</strong> that does not explain <em>why</em> it happens.</p>

<h3><strong>Better answer:</strong></h3>
<p>Adds a <strong>because</strong> and links two ideas so the examiner can see basic reasoning.</p>

<h3><strong>Full-mark answer:</strong></h3>
<p>Uses precise terminology and a clear cause → process → effect chain for <strong>[topic idea]</strong>.</p>

<h3><strong>Why the full-mark answer is stronger:</strong></h3>
<ul>
<li>It gives a clear cause → effect chain.</li>
<li>It links evidence to what the mark scheme rewards.</li>
<li>It avoids vague wording.</li>
</ul>

INTERNAL REGENERATION GUARD:
- Do NOT return a lesson that omits Key Insight, the 🌍 or 🎯 sections, any of the three modelling labels, or a second checkpoint. If you detect a gap, regenerate internally until complete, then output once.
- Downstream deterministicAutoFixLesson can patch gaps, but you MUST aim for a lesson that is already complete and high-scoring without relying on that fallback.

${ss1BlockOrderSection}

${ss1FirstBlocksSection}
${teacherFirstLayer2Section ? `\n${teacherFirstLayer2Section}\n` : ""}
${teachingQualityUpgradeSection ? `\n${teachingQualityUpgradeSection}\n` : ""}
${ss1AntiDuplicationSection ? `\n${ss1AntiDuplicationSection}\n` : ""}

LIVE CLASSROOM TEACHER VOICE (NOT TEXTBOOK)
--------------------------------

Sound like a confident teacher in front of the class — warm, direct, varied. Use natural phrases such as:
- “Right, let’s break this down.”
- “The key thing to remember is…”
- “This matters because…”
- “Watch the cause → effect chain here.”
- “This is where students often get confused.”
- “In the exam, don’t just say…”
- “A stronger answer would say…”
- “Let’s turn that into a full-mark explanation.”

Do NOT repeat the same opener every time. Vary rhythm: short explanation → bullet → question → bullet.

RULE: Every major teaching block (Hook, Core rule, Core teaching, Common mistake, Synthesis, Final memory rule, Summary beats) MUST include at least one &lt;p&gt; that begins with the finger emoji exactly like this: 👉 (example: &lt;p&gt;👉 The key thing here is…&lt;/p&gt;).

Aim for at least 3 separate 👉 paragraphs across the whole lesson.

--------------------------------
SCAN / FORMAT TIGHTENING
--------------------------------

- Target 2–3 short lines per paragraph inside each &lt;p&gt; (no dense walls of text).
- Prefer several short &lt;p&gt; blocks plus &lt;ul&gt;&lt;li&gt; over one long ramble.
- Each numbered section should be scannable in under ~10 seconds.
- Main title for a section: &lt;h2&gt;&lt;strong&gt;...&lt;/strong&gt;&lt;/h2&gt; only.
- Subheads: &lt;h3&gt;&lt;strong&gt;...&lt;/strong&gt;&lt;/h3&gt;.
- Do NOT use markdown headings (###) or **bold** — use HTML &lt;strong&gt; only.

--------------------------------
OBJECTIVES AND PRIOR KNOWLEDGE RULE
--------------------------------

Lesson Objectives and Prior Knowledge MUST each contain full bullet lists (3–5 specific bullets). The parser depends on these bullets.

Do NOT output only the intro line without &lt;ul&gt;&lt;li&gt; items.

--------------------------------
LESSON TITLE RULE
--------------------------------

After the two fields, include a clear title:

<strong>${topic} – Organisation (${examBoard} ${keyStage})</strong>

Do not add emojis to the title.

Use only these paste targets:

- Hook (text)
- Core rule (key idea)
- Common mistake
- Pattern recognition (key idea)
- Diagram (concept)
- What to Notice (key idea)
- Text (concept)
- Exam tip (concept)
- Worked example (checkpoint)
- Synthesis (key idea)
- Quick check (checkpoint)
- Self-check question
- Final memory rule (key idea)
- Key words
- Deeper knowledge (stretch)
- Step-by-step diagram (process)
- Interactive diagram
- Drag and drop match
- Checkpoint block

Do NOT use:
- Explanation block
- Flashcards
- Markdown tables
- React code
- JSON

--------------------------------
LEARNING LOOP RULE
--------------------------------

Every core concept must follow this learning loop:

Explain → Visual → Interaction → Exam thinking

This means every major concept should include:
1. A teaching explanation
2. A visual or diagram suggestion
3. An active task or checkpoint
4. Exam-focused guidance

No full lesson may be text-only.

--------------------------------
CONTENT COVERAGE + SS1 STRUCTURE RULE
--------------------------------

The lesson must combine:
1. strong factual coverage (Save My Exams style — complete, exam-aligned ideas)
2. teacher-led SS1 explanation structure (LetsRevise paste targets)

Do NOT output flat textbook-style paragraphs or revision-guide lists without teaching structure.

For every important concept, prefer this pattern where it fits (adapt length to the idea — not every block must repeat all lines):

<p><strong>📘 The key idea is:</strong></p>
<p>[one clear GCSE-friendly summary sentence]</p>

<p><strong>Structure → function:</strong></p>
<p>[what the structure/feature is and how it supports the function]</p>

<p><strong>Process → effect:</strong></p>
<p>[what happens → what it causes → final outcome]</p>

<p><strong>Adaptation → advantage:</strong></p>
<p>[why the feature/process gives an advantage or better exam understanding]</p>

<p><strong>Think like an examiner:</strong></p>
<p>👉 [how to phrase this for marks — cause → effect → outcome]</p>

For non-Biology subjects, swap the middle headings for the equivalent discipline structure (keep the 📘 key idea + examiner line):
- Chemistry: Particle → behaviour, Reaction → observation, Evidence → conclusion
- Physics: Quantity → relationship, Cause → effect, Formula → meaning
- Maths: Method → reason, Step → result, Common error → correction
- Geography: Process → impact, Place → consequence, Data → conclusion
- History: Cause → event, Consequence → change, Evidence → judgement
- English: Method → evidence, Effect → reader, Interpretation → judgement

If a section starts to read like a revision guide or uninterrupted fact list, rewrite it into this teacher-led structure before output.

Requirement:
- At least 3 major teaching blocks (different concepts) should visibly use this structured pattern (markers like “Structure → function” or subject equivalents + “Think like an examiner” style).
- If you only have one long paragraph, split the teaching into labelled chunks as above.

--------------------------------
MANDATORY INTERACTIVE BLOCKS
--------------------------------

${ss1MandatoryInteractiveSection}
- at least 1 Drag and drop match
- at least 1 Step-by-step diagram (process)
- at least 1 Interactive diagram
- at least 1 Diagram (concept)
- at least 1 Common mistake
- at least 1 Exam tip (concept)
- at least 1 Worked example (checkpoint)
- at least 1 Synthesis (key idea)
- at least 1 Self-check question
- at least 1 Final memory rule (key idea)
- Exam practice (Text concept) and Summary (Text concept)
- exactly 1 Key words block (10 keywords)

--------------------------------
CHECKPOINT FORMAT
--------------------------------

Checkpoint and Quick check blocks must use EXACTLY:

Question:
[clear question]

Option 1:
[text]

Option 2:
[text]

Option 3:
[text]

Option 4:
[text]

Answer:
[exact option text — must match one option verbatim]

Important:
- Answer must be plain text and hidden from “visible teaching” expectations by the platform — do NOT restate the correct answer inside extra paragraphs outside this format.
- Do NOT put <details> inside checkpoint Option/Answer fields.
- Do NOT leak the answer into the question stem.

--------------------------------
INTERACTIVE BLOCK STRUCTURE RULE
--------------------------------

When generating interactive LetsRevise blocks, you MUST follow exact structures.
Do NOT write interactive activities as loose paragraphs — the system parses these automatically.

--------------------------------
DRAG AND DROP MATCH STRICT FORMAT
--------------------------------

For every Drag and drop match block, use:

Instruction:
Match each item to the correct description.

Items to drag:
- [item 1]
- [item 2]
- [item 3]
- [item 4]

Drop zones:
- [description 1] → ______
- [description 2] → ______
- [description 3] → ______
- [description 4] → ______

Answer key:
<details>
<summary>Reveal Answer</summary>

- [description 1] → [item]
- [description 2] → [item]
- [description 3] → [item]
- [description 4] → [item]

</details>

When a Drag and drop match block uses a single activity image (text-to-image main image or diagram with on-image drop zones), the artwork MUST follow this contract:

${formatDragDropImageDesignRequirements()}

--------------------------------
INTERACTIVE DIAGRAM STRICT FORMAT
--------------------------------

For every Interactive diagram block, use:

Instruction:
Label the diagram using the correct terms.

Labels to use:
- [label 1]
- [label 2]
- [label 3]
- [label 4]

Hotspots / parts:
- A → ______
- B → ______
- C → ______
- D → ______

Answer key:
<details>
<summary>Reveal Answer</summary>

- A → [label]
- B → [label]
- C → [label]
- D → [label]

</details>

--------------------------------
STEP-BY-STEP DIAGRAM STRICT FORMAT
--------------------------------

For every Step-by-step diagram block, use:

Process:
[name of process]

Step 1:
[text]

↓

Step 2:
[text]

↓

Step 3:
[text]

↓

Step 4:
[text]

Exam link:
[text]

--------------------------------
WORKED EXAMPLE STRICT FORMAT
--------------------------------

For every Worked example block, use:

Question:
[text]

Answer:
<details>
<summary>Reveal Answer</summary>

[text]

</details>

--------------------------------
TEACHER VOICE RULES
--------------------------------

Write like a confident teacher.

Use clear teacher language:
- 👉 The key idea is...
- 👉 At its simplest...
- 👉 In basic terms...
- 👉 This happens because...
- 👉 As a result...
- 👉 This means that...
- 👉 Think like an examiner...
- 👉 A full-mark answer would include...
- 👉 A common mistake is...
- 👉 Do NOT just...

Do NOT:
- sound like a textbook
- start sections with fact dumps
- make every section structurally identical
- use dense paragraphs
- use generic filler

Keep paragraphs short.
Use bullets often.
Use arrows: →, ↑, ↓, ↕.

--------------------------------
HTML FORMATTING RULE
--------------------------------

Use simple HTML inside content (paste-safe for LetsRevise — no markdown headings).

Use:
- <h2><strong>Main section title</strong></h2> for every major lesson section (Objectives, Prior knowledge, core teaching, summary, keywords, etc.)
- <h3><strong>Sub-section title</strong></h3> for nested teaching beats inside a block where helpful
- <p>...</p>
- <strong>...</strong>
- <ul><li>...</li></ul>
- <br />

Do NOT use markdown headings (###, ##).
Do NOT output a section title as plain text only — wrap titles in <h2> or <h3> as above.

--------------------------------
NON-CHECKPOINT HIDDEN ANSWERS
--------------------------------

For normal in-lesson questions, self-checks, worked examples, and exam practice model answers, use:

<details>
<summary>Reveal Answer</summary>

[answer]

</details>

For model answers, use:

<details>
<summary>Reveal Model Answer</summary>

[answer]

</details>

--------------------------------
DIAGRAM RULES
--------------------------------

Include exactly 3 diagram-related blocks across the lesson.

They may be:
- Diagram (concept)
- Step-by-step diagram (process)
- Interactive diagram

Each diagram block must include:

Placement:
[where it should go]

Type:
[Diagram / Step-by-step diagram / Interactive diagram]

What it should show:
[text]

Key labels / features:
[text]

Why it helps:
[text]

Brand/style:
- LET’S REVISE header
- Exam-board ready
- White background
- Thick black outlines
- Minimal colours
- Large uppercase labels
- No questions inside diagrams
- No answer text inside diagrams

Diagrams are visual only.
All interactivity must be text-based outside the diagram.

--------------------------------
EXAM PRACTICE RULE
--------------------------------

Include exam practice with:
- Q1 (1 mark)
- Q2 (2 marks)
- Q3 (3 marks)
- Q4 (4 marks)

For Q3 and Q4, include model answers using hidden answer HTML.

Model answers must:
- use exam language
- include cause → effect
- be short enough for GCSE students to learn from

--------------------------------
EXAM PRECISION RULE
--------------------------------

At least twice in the lesson include answer-quality modelling:

Weak answer:
[text]

Better answer:
[text]

Full-mark answer:
[text]

Then explain briefly why the full-mark answer is stronger.

--------------------------------
MISCONCEPTION RULE
--------------------------------

Include at least 2 explicit misconception corrections.

Use:
- A common mistake is...
- Students often confuse...
- Do NOT say...
- A better way to say it is...

Each misconception must:
1. state the error
2. correct it
3. explain why the correction earns marks

--------------------------------
APPLICATION RULE
--------------------------------

Include one realistic application or data-thinking block.

It must include:
- a short scenario
- a cause → effect explanation
- what pattern students should notice
- one exam-style question with hidden answer

--------------------------------
SUMMARY RULE
--------------------------------

The summary must include:
- 5–6 concise recap points
- 1 remember-this takeaway
- 1 exam-style reminder

--------------------------------
KEY WORDS RULE
--------------------------------

The final Key words block must include exactly 10 keywords.

Use this format:
<strong>Keyword</strong> – GCSE-friendly definition

Every keyword term must be bold.

--------------------------------
FINAL QUALITY STANDARD
--------------------------------

The final lesson must feel:
- premium
- teacher-led
- interactive-ready
- exam-focused
- memory-optimised
- paste-ready for LetsRevise

Before finalising, silently check:
- Is there EXACTLY ONE 💡 Key Insight in block 17 with that visible title?
- Is there <h2><strong>🌍 Why this matters</strong></h2> and <h2><strong>🎯 Premium Exam Tip</strong></h2> in block 12?
- Does block 12 include all three labels Weak answer: / Better answer: / Full-mark answer: as <h3><strong>...</strong></h3> with paragraphs?
- Are there at least 2 complete checkpoints (block 6 + block 14)?
- Does every major idea include explanation, visual support, interaction, and exam thinking?
- Is there a drag and drop task?
- Is there a step-by-step diagram?
- Is there an interactive diagram?
- Are misconception corrections clear?
- Are Q3 and Q4 model answers included?
- Are there exactly 10 keywords?
- Do Lesson Objectives and Prior Knowledge have full bullet lists?

Do NOT output this checklist.
Only output the final lesson.

EXTRA INSTRUCTIONS:
${extras || "None"}

Return ONLY the final premium lesson.
  `.trim();
}

function getSubjectSpecificUpgrade(subject, keyStage) {
  switch ((subject || "").toLowerCase()) {
    case "biology":
      return `
--------------------------------
SUBJECT-SPECIFIC TEACHING ENGINE: BIOLOGY
--------------------------------

Teach Biology through:
- structure → function
- process → effect
- adaptation → advantage
- comparison where useful
- hierarchy and systems where relevant

BIOLOGY TEACHING RULES:
- Explain what structures do and why they are adapted.
- Link cell / tissue / organ structure directly to function.
- Explain processes step by step.
- Use cause → effect chains heavily.
- Where relevant, connect microscopic structure to whole-organism outcome.
- Use practical or real organism examples where useful.

BIOLOGY EXAM RULES:
- Use prompts such as:
  - Explain how...
  - Describe how...
  - Compare...
  - Give one reason why...
- Include common mistakes like:
  - naming without explaining
  - giving function without structure
  - describing process without linking to effect
- Use full-mark phrasing that links:
  - structure → function
  - process → effect
  - adaptation → advantage

BIOLOGY VISUAL RULES:
- Biology lessons should be strongly diagram-led where appropriate.
- Use visuals for:
  - cells
  - tissues
  - organ structure
  - transport pathways
  - life cycles
  - required practicals / setups
- Where a diagram is included, teach directly from it using:
  - Look at...
  - Notice that...
  - This part is adapted because...

BIOLOGY LANGUAGE RULES:
- Keep terms accurate but naturally explained.
- Avoid over-dense molecular detail unless the level requires it.
- At GCSE, stay clearly within GCSE depth.
- Prefer simple scientific clarity over technical overload.
`;
    case "chemistry":
      return `
--------------------------------
SUBJECT-SPECIFIC TEACHING ENGINE: CHEMISTRY
--------------------------------

Teach Chemistry through:
- particle explanation
- model → evidence
- reaction → observation → explanation
- equation meaning
- pattern recognition

CHEMISTRY TEACHING RULES:
- Explain what particles are doing.
- Link observations to particle behaviour.
- Explain symbols, equations, and state changes clearly.
- Use "because" often.
- Make invisible processes visible through explanation.

CHEMISTRY EXAM RULES:
- Use phrases like:
  - Explain in terms of particles...
  - Describe what happens...
  - Compare...
- Include common mistakes:
  - describing only what is seen
  - forgetting particle language
  - confusing physical and chemical change

CHEMISTRY VISUAL RULES:
- Use diagrams for:
  - particle models
  - apparatus
  - bonding
  - reaction setups
  - energy profiles
`;
    case "physics":
      return `
--------------------------------
SUBJECT-SPECIFIC TEACHING ENGINE: PHYSICS
--------------------------------

Teach Physics through:
- concept → model → relationship → application
- cause → effect
- variable thinking
- real-world meaning

PHYSICS TEACHING RULES:
- Explain what is happening physically, not just what formula applies.
- Link ideas to forces, energy, motion, fields, waves, or charge clearly.
- Use concrete examples.
- Make abstract ideas easier to picture.

PHYSICS EXAM RULES:
- Use command words:
  - calculate
  - explain
  - describe
  - compare
- Include common mistakes:
  - formula use without meaning
  - confusing units
  - describing trend without explaining why

PHYSICS VISUAL RULES:
- Use diagrams for:
  - circuits
  - ray diagrams
  - force arrows
  - wave patterns
  - motion graphs
  - apparatus
`;
    case "combined science":
      return `
--------------------------------
SUBJECT-SPECIFIC TEACHING ENGINE: COMBINED SCIENCE
--------------------------------

Teach with very clear explanation and controlled difficulty.
Make scientific ideas accessible and exam-relevant.
Avoid unnecessary depth and keep terminology well explained.
Use diagram-led teaching where appropriate.
`;
    case "mathematics":
      return `
--------------------------------
SUBJECT-SPECIFIC TEACHING ENGINE: MATHEMATICS
--------------------------------

Teach Maths through:
- worked method
- step-by-step logic
- common error correction
- repetition of process
- clear final checks

MATHS TEACHING RULES:
- Show the method in a clean sequence.
- Explain why each step is done.
- Use worked examples.
- Include common mistakes.
- Emphasise what examiners expect to see written.

MATHS VISUAL RULES:
- Use diagrams for:
  - geometry
  - graphs
  - constructions
  - transformations
  - data displays
`;
    case "english":
      return `
--------------------------------
SUBJECT-SPECIFIC TEACHING ENGINE: ENGLISH
--------------------------------

Teach English through:
- model interpretation
- evidence selection
- explanation of language / structure
- effect on reader
- argument / writing craft

ENGLISH TEACHING RULES:
- Use short quotations where relevant.
- Explain how evidence supports interpretation.
- Link methods to effects clearly.
- Use model analytical phrasing.

ENGLISH EXAM RULES:
- Use phrases like:
  - A strong answer would say...
  - Zoom in on the word...
  - This suggests...
`;
    case "history":
      return `
--------------------------------
SUBJECT-SPECIFIC TEACHING ENGINE: HISTORY
--------------------------------

Teach History through:
- chronology
- cause and consequence
- change and continuity
- significance
- interpretation

HISTORY TEACHING RULES:
- Make timeline and sequence clear.
- Explain why events happened.
- Link factors, causes, and outcomes.
- Distinguish description from explanation.

HISTORY EXAM RULES:
- Use prompts such as:
  - Explain why...
  - How far do you agree...
  - Describe two features...
`;
    case "geography":
      return `
--------------------------------
SUBJECT-SPECIFIC TEACHING ENGINE: GEOGRAPHY
--------------------------------

Teach Geography through:
- process explanation
- place-based examples
- human + physical links
- scale and consequence
- data interpretation

GEOGRAPHY TEACHING RULES:
- Explain what is happening, where, and why.
- Link process to impact.
- Use named or realistic examples where helpful.
- Make data and maps part of the explanation where useful.

GEOGRAPHY EXAM RULES:
- Use command words:
  - describe
  - explain
  - compare
  - suggest
`;
    default:
      return `
--------------------------------
SUBJECT-SPECIFIC TEACHING ENGINE
--------------------------------

Make the lesson strongly aligned to the subject selected.
Use the natural teaching style, explanation style, and exam style of that subject.
Prefer subject-authentic explanation over generic lesson-writing.
`;
  }
}