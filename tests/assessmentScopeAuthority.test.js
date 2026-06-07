/**
 * Phase 3H.1.8b.1 Step 2 — Checkpoint + Exam Practice authority tests.
 */

const {
  ensureCheckpointScopeCompliance,
  evaluateCheckpointAuthorityGate,
} = require("../lib/teacherBrain/checkpointAuthority");
const {
  ensureExamPracticeScopeCompliance,
  evaluateExamPracticeAuthorityGate,
} = require("../lib/teacherBrain/examPracticeAuthority");
const { findDriftTermsInText } = require("../lib/teacherBrain/objectivesAuthority");

const NS_INPUT = {
  topic: "Structure and function of the nervous system",
  topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
};

const CONTAMINATED_CHECKPOINT = `PAGE 1

10 — CHECKPOINT
Paste into: Checkpoint block
Question:
Which part of the brain controls balance and coordination?
Option 1:
Cerebral cortex
Option 2:
Cerebellum
Option 3:
Medulla
Option 4:
Hypothalamus
Answer:
Cerebellum

11 — DRAG AND DROP MATCH
Paste into: Drag and drop match
Instruction:
Match each nervous system part to its correct function.
Items to drag:
- Cerebral cortex
- Cerebellum
- Medulla
- Sensory neurone
Drop zones:
- Controls higher brain functions → ______
- Coordinates balance → ______
`;

const CONTAMINATED_EXAM = `PAGE 1

23 — EXAM PRACTICE
Paste into: Text (concept)
<h2><strong>Exam practice</strong></h2>
<p><strong>Q3 (3 marks):</strong> Explain how the cerebellum contributes to everyday movements.</p>
<p><strong>Q4 (4 marks):</strong> Describe how the skin and brain work together to regulate body temperature when it gets too hot.</p>
`;

const EXAM_PRACTICE_FORBIDDEN_RE =
  /\b(cerebellum|medulla|cerebr(?:al\s+cortex|um)|cortex|hypothalamus|thermoregulation|retina|lens|pupil)\b/i;

const EXAM_PRACTICE_DRIFT_FIXTURES = [
  { q2: "State the function of the cerebellum.", q3: "Describe the role of the medulla in breathing control." },
  { q2: "What does the cerebral cortex control?", q3: "Explain thermoregulation when body temperature rises above 37°C." },
  { q2: "Compare cerebellum and medulla functions.", q3: "How does the hypothalamus control thermoregulation?" },
  { q2: "Label the cerebellum on a brain diagram.", q3: "Explain sweating during thermoregulation." },
  { q2: "Why is the medulla important for heart rate?", q3: "Describe accommodation of the eye using the lens." },
  { q2: "How does the retina detect light?", q3: "Explain pupil reflex and iris control." },
  { q2: "State one function of the cortex.", q3: "Explain how thermoregulation keeps core temperature stable." },
  { q2: "Describe cerebellum coordination in sport.", q3: "Why does the medulla control involuntary actions?" },
  { q2: "How does the hypothalamus detect temperature change?", q3: "Explain thermoregulation above 37°C." },
  { q2: "What is the function of the medulla oblongata?", q3: "Describe how the lens changes shape during accommodation." },
  { q2: "Explain cerebellum balance control.", q3: "How does the retina convert light into impulses?" },
  { q2: "State the role of the cerebral cortex in memory.", q3: "Explain pupil diameter changes in bright light." },
  { q2: "How does the medulla regulate breathing?", q3: "Describe thermoregulation through sweating." },
  { q2: "What is cerebellum function in movement?", q3: "Explain hypothalamus role in temperature control." },
  { q2: "Describe cortex involvement in conscious thought.", q3: "How does accommodation help near vision?" },
  { q2: "State medulla functions in reflexes.", q3: "Explain thermoregulation when too hot." },
  { q2: "How does the cerebellum fine-tune movement?", q3: "Describe retina structure for GCSE." },
  { q2: "What does the medulla control?", q3: "Explain lens shape change for far vision." },
  { q2: "Describe cerebellum and cortex differences.", q3: "How does thermoregulation use vasodilation?" },
  { q2: "State the function of cerebellum / medulla.", q3: "Thermoregulation above 37°C — explain the process." },
];

function buildContaminatedExamPracticeBlock({ q2, q3 }, lessonIndex = 0) {
  return `PAGE 1

23 — EXAM PRACTICE
Paste into: Text (concept)
<h2><strong>Exam practice</strong></h2>
<p><strong>Q1 (1 mark):</strong> What detects a stimulus?</p>
<p><strong>Q2 (2 marks):</strong> ${q2}</p>
<p><strong>Q3 (3 marks):</strong> ${q3}</p>
<p><strong>Q4 (4 marks):</strong> Explain why quick transmission of impulses along neurones is important for survival.</p>
<details><summary>Reveal Model Answers</summary>
<p><strong>Q1:</strong> A receptor detects a stimulus.</p>
<p><strong>Q2:</strong> Out-of-scope answer ${lessonIndex}.</p>
<p><strong>Q3:</strong> Out-of-scope answer ${lessonIndex}.</p>
<p><strong>Q4:</strong> Quick transmission allows rapid responses.</p>
</details>
<p><strong>Q5 (6 marks):</strong> Describe the organisation of the CNS and PNS and how neurones transmit impulses.</p>
<details><summary>Reveal Model Answer</summary>
<p>Brain and spinal cord form the CNS; nerves form the PNS; impulses travel along neurones and cross synapses.</p>
</details>
`;
}

describe("Phase 3H.1.8b.1 Step 2 — assessment scope authority", () => {
  test("checkpoint authority rewrites brain-region quick check", () => {
    const fixes = [];
    const { text, changed } = ensureCheckpointScopeCompliance(
      CONTAMINATED_CHECKPOINT,
      NS_INPUT,
      fixes
    );
    expect(changed).toBe(true);
    expect(findDriftTermsInText(text)).toEqual([]);
    const gate = evaluateCheckpointAuthorityGate(text, NS_INPUT);
    expect(gate.pass).toBe(true);
  });

  test("exam practice authority rewrites contaminated questions", () => {
    const fixes = [];
    const { text, changed } = ensureExamPracticeScopeCompliance(
      CONTAMINATED_EXAM,
      NS_INPUT,
      fixes
    );
    expect(changed).toBe(true);
    expect(text).toMatch(/What detects a stimulus/i);
    expect(text).not.toMatch(/cerebellum/i);
    expect(text).not.toMatch(/thermoregulation/i);
    const gate = evaluateExamPracticeAuthorityGate(text, NS_INPUT);
    expect(gate.pass).toBe(true);
  });

  test("20 nervous-system exam-practice lessons stay in subtopic scope", () => {
    const basicsInput = {
      topic: "Structure of the Nervous System – basics",
      topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
    };

    for (let i = 0; i < 20; i++) {
      const fixture = EXAM_PRACTICE_DRIFT_FIXTURES[i];
      const input = i % 2 === 0 ? basicsInput : NS_INPUT;
      const fixes = [];
      const { text, changed } = ensureExamPracticeScopeCompliance(
        buildContaminatedExamPracticeBlock(fixture, i),
        input,
        fixes
      );
      expect(changed).toBe(true);
      expect(text).toMatch(/Q5 \(6 marks\)/i);
      expect(text).not.toMatch(EXAM_PRACTICE_FORBIDDEN_RE);
      const gate = evaluateExamPracticeAuthorityGate(text, input);
      expect(gate.pass).toBe(true);
    }
  });
});
