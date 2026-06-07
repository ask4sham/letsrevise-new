/**
 * Phase 3H.1.8b.0 — Key Words authority unit tests.
 */

const {
  profileAwareKeywordFallback,
  genericKeywordFallbackRows,
  extractKeywordLines,
  evaluateKeyWordsAuthorityGate,
  isFrameworkMetaTerm,
  resolveKeyWordsTermList,
} = require("../lib/teacherBrain/keyWordsAuthority");
const {
  NERVOUS_SYSTEM_STRUCTURE_OPENING,
  HOMEOSTASIS_OPENING,
  THE_EYE_OPENING,
} = require("../lib/teacherBrain/teacherFirstKnowledgeProfiles");
const {
  buildTeacherFirstOpeningPlan,
  buildSs1Layer2MandatoryKeywordsSection,
} = require("../lib/teacherBrain/teacherFirstKnowledgeEngine");

describe("Phase 3H.1.8b.0 — Key Words authority", () => {
  const prevFlag = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevFlag;
  });

  test("generic fallback produces framework meta-terms", () => {
    const rows = genericKeywordFallbackRows("Some topic", 10);
    expect(rows.map((r) => r.term)).toEqual([
      "Cause",
      "Effect",
      "Structure",
      "Function",
      "Keyword",
      "Explain",
      "Compare",
      "Evidence",
      "Misconception",
      "Mark scheme",
    ]);
  });

  test("profileAwareKeywordFallback uses Nervous System biology terms", () => {
    const { rows, usedGenericFallback, source } = profileAwareKeywordFallback({
      topic: "Structure and function of the nervous system",
      topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
      subject: "Biology",
      count: 10,
    });
    expect(usedGenericFallback).toBe(false);
    expect(source).toBe("profile");
    expect(rows).toHaveLength(10);
    const terms = rows.map((r) => r.term.toLowerCase());
    expect(terms).toContain("receptor");
    expect(terms).toContain("stimulus");
    expect(terms).toContain("sensory neurone");
    expect(terms).not.toContain("cause");
    expect(terms).not.toContain("mark scheme");
  });

  test("profileAwareKeywordFallback resolves generator display title for nervous system", () => {
    const { rows, usedGenericFallback } = profileAwareKeywordFallback({
      topic: "Nervous System: Basics – Structure & Fun",
      subject: "Biology",
      count: 10,
    });
    expect(usedGenericFallback).toBe(false);
    const terms = rows.map((r) => r.term.toLowerCase());
    expect(terms).toContain("receptor");
    expect(terms).toContain("synapse");
    expect(terms).not.toContain("mark scheme");
  });

  test("reconcileKeywordRows replaces generic autofix fallback with biology terms", () => {
    const { reconcileKeywordRows } = require("../lib/teacherBrain/keyWordsAuthority");
    const generic = genericKeywordFallbackRows("Nervous System: Basics – Structure & Fun", 10);
    const { rows, replaced, usedGenericFallback } = reconcileKeywordRows({
      existingRows: generic,
      topic: "Nervous System: Basics – Structure & Fun",
      subject: "Biology",
      count: 10,
    });
    expect(replaced).toBe(true);
    expect(usedGenericFallback).toBe(false);
    expect(rows.map((r) => r.term.toLowerCase())).toContain("motor neurone");
    expect(rows.map((r) => r.term.toLowerCase())).not.toContain("cause");
  });

  test("reconcileKeywordRows preserves strong existing biology keywords", () => {
    const { reconcileKeywordRows } = require("../lib/teacherBrain/keyWordsAuthority");
    const existing = [
      { term: "Stimulus", def: "A change in the environment that is detected." },
      { term: "Receptor", def: "A cell or organ that detects a stimulus." },
      { term: "Neurone", def: "A specialised nerve cell that carries electrical impulses." },
      { term: "Nerve", def: "A bundle of many neurones together." },
      { term: "CNS", def: "Central nervous system: brain and spinal cord." },
      { term: "PNS", def: "Peripheral nervous system." },
      { term: "Effector", def: "A muscle or gland that carries out a response." },
      { term: "Myelin sheath", def: "Fatty insulation around an axon." },
      { term: "Axon", def: "Carries impulses away from the cell body." },
      { term: "Reflex", def: "A fast, automatic response." },
    ];
    const { rows, replaced, usedGenericFallback } = reconcileKeywordRows({
      existingRows: existing,
      topic: "Nervous System: Basics – Structure & Fun",
      subject: "Biology",
      count: 10,
    });
    expect(replaced).toBe(false);
    expect(usedGenericFallback).toBe(false);
    expect(rows.map((r) => r.term.toLowerCase())).toContain("stimulus");
    expect(rows.map((r) => r.term.toLowerCase())).not.toContain("cause");
  });

  test("profileAwareKeywordFallback uses Homeostasis biology terms", () => {
    const { rows, usedGenericFallback } = profileAwareKeywordFallback({
      topic: "Homeostasis",
      topicKey: "aqa-gcse-biology:homeostasis",
      subject: "Biology",
      count: 10,
    });
    expect(usedGenericFallback).toBe(false);
    const terms = rows.map((r) => r.term.toLowerCase());
    expect(terms).toContain("homeostasis");
    expect(terms).toContain("negative feedback");
    expect(terms).not.toContain("explain");
  });

  test("profileAwareKeywordFallback uses Eye biology terms", () => {
    const { rows, usedGenericFallback } = profileAwareKeywordFallback({
      topic: "The eye",
      topicKey: "aqa-gcse-biology:the-eye",
      subject: "Biology",
      count: 10,
    });
    expect(usedGenericFallback).toBe(false);
    const terms = rows.map((r) => r.term.toLowerCase());
    expect(terms).toContain("cornea");
    expect(terms).toContain("accommodation");
    expect(terms).not.toContain("compare");
  });

  test("extractKeywordLines parses br-separated and li malformed lines", () => {
    const html = `
<p><strong>👉 Keywords</strong></p>
<strong>Stimulus</strong> – A change in the environment.<br />
<strong>Receptor</strong> – Detects the stimulus.<br />
<strong>Sensory neurone</strong> – Carries impulses to the CNS.<br />
<strong>Motor neurone</strong> – Carries impulses to effectors.<br />
<strong>Effector</strong> – Muscle or gland.</li>
<strong>CNS</strong> – Brain and spinal cord.<br />
<strong>Synapse</strong> – Gap between neurones.<br />
<strong>Response</strong> – Action produced.<br />
<strong>Axon</strong> – Carries impulses.<br />
<strong>Dendrite</strong> – Receives impulses.<br />
`;
    const rows = extractKeywordLines(html);
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.map((r) => r.term.toLowerCase())).toContain("stimulus");
    expect(rows.map((r) => r.term.toLowerCase())).toContain("receptor");
  });

  test("evaluateKeyWordsAuthorityGate fails on framework meta-terms", () => {
    const lesson = `
24 — KEY WORDS
Paste into: Key words
<p><strong>👉 Keywords</strong></p>
<strong>Cause</strong> – Why something happens.
<strong>Effect</strong> – What changes.
<strong>Structure</strong> – How parts fit.
<strong>Function</strong> – What something does.
<strong>Keyword</strong> – Precise term.
<strong>Explain</strong> – Give reasoning.
<strong>Compare</strong> – Similarities and differences.
<strong>Evidence</strong> – Proves the answer.
<strong>Misconception</strong> – Common confusion.
<strong>Mark scheme</strong> – What examiners reward.
`;
    const gate = evaluateKeyWordsAuthorityGate(lesson);
    expect(gate.pass).toBe(false);
    expect(gate.frameworkRatio).toBe(1);
    expect(gate.warnings.length).toBeGreaterThan(0);
  });

  test("evaluateKeyWordsAuthorityGate passes on subject vocabulary", () => {
    const lesson = `
24 — KEY WORDS
Paste into: Key words
<p><strong>👉 Keywords</strong></p>
<strong>Receptor</strong> – Detects a stimulus.
<strong>Stimulus</strong> – A change detected.
<strong>Response</strong> – Action produced.
<strong>Sensory neurone</strong> – To the CNS.
<strong>Relay neurone</strong> – In the CNS.
<strong>Motor neurone</strong> – To effectors.
<strong>Synapse</strong> – Gap between neurones.
<strong>CNS</strong> – Brain and spinal cord.
<strong>PNS</strong> – Peripheral nerves.
<strong>Effector</strong> – Muscle or gland.
`;
    const gate = evaluateKeyWordsAuthorityGate(lesson);
    expect(gate.pass).toBe(true);
    expect(gate.frameworkTermCount).toBe(0);
  });

  test("prompt mandate section lists topic Key Words when Layer 2 enabled", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const plan = buildTeacherFirstOpeningPlan({
      profile: NERVOUS_SYSTEM_STRUCTURE_OPENING,
      topic: "Structure and function of the nervous system",
      topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
      subject: "Biology",
    });
    const section = buildSs1Layer2MandatoryKeywordsSection(plan);
    expect(section).toMatch(/MANDATORY KEY WORDS/);
    expect(section).toMatch(/Sensory neurone/);
    expect(section).toMatch(/FORBIDDEN as Key Words/);
    expect(section).toMatch(/Mark scheme/);
  });

  test("resolveKeyWordsTermList merges profile and lesson extraction", () => {
    const lesson = `
5 — CORE MODEL
Paste into: Core rule (key idea)
Stimulus → Receptor → Sensory neurone → CNS → Motor neurone → Effector → Response
7 — EXAM VOCABULARY
Paste into: Text (concept)
<p><strong>synapse</strong>, <strong>PNS</strong></p>
`;
    const terms = resolveKeyWordsTermList(NERVOUS_SYSTEM_STRUCTURE_OPENING, lesson);
    expect(terms.map((t) => t.toLowerCase())).toEqual(
      expect.arrayContaining(["receptor", "stimulus", "synapse", "cns"])
    );
  });

  test("isFrameworkMetaTerm identifies exam-framework vocabulary", () => {
    expect(isFrameworkMetaTerm("Cause")).toBe(true);
    expect(isFrameworkMetaTerm("Mark scheme")).toBe(true);
    expect(isFrameworkMetaTerm("Receptor")).toBe(false);
  });

  test("profiles define keyWordsTerms for all three biology topics", () => {
    expect(HOMEOSTASIS_OPENING.keyWordsTerms).toContain("homeostasis");
    expect(NERVOUS_SYSTEM_STRUCTURE_OPENING.keyWordsTerms).toContain("myelin sheath");
    expect(THE_EYE_OPENING.keyWordsTerms).toContain("refraction");
  });
});
