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
});
