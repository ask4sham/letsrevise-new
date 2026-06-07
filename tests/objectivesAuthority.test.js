/**
 * Phase 3H.1.8b.1 — Objectives scope authority unit tests.
 */

const {
  buildSs1Layer2MandatoryObjectivesSection,
  ensureObjectiveScopeCompliance,
  evaluateObjectivesAuthorityGate,
  extractListItemsFromHtml,
  findDriftTermsInText,
  scanDownstreamDrift,
} = require("../lib/teacherBrain/objectivesAuthority");
const { resolveSubTopicProfile } = require("../lib/teacherBrain/subTopicProfiles");

const NS_INPUT = {
  topic: "Structure and function of the nervous system",
  topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
};

const CONTAMINATED_LESSON = `LESSON OBJECTIVE FIELD:
Explain brain regions, eye structure and thermoregulation in the nervous system.

SHORT SUMMARY FIELD:
Covers cerebellum, cortex and accommodation.

PAGE 1

1 — REVISION OBJECTIVES
Paste into: Text (concept)
<h2><strong>Revision objectives</strong></h2>
<ul>
<li><strong>👉</strong> Identify main brain regions: cerebral cortex, cerebellum, medulla.</li>
<li><strong>👉</strong> Describe the structure of the eye and accommodation.</li>
<li><strong>👉</strong> Explain thermoregulation through the hypothalamus.</li>
</ul>

2 — PRIOR KNOWLEDGE
Paste into: Text (concept)
<ul>
<li>Recall thermoregulation and body temperature control.</li>
</ul>
`;

describe("Phase 3H.1.8b.1 — Objectives scope authority", () => {
  test("buildSs1Layer2MandatoryObjectivesSection includes forbidden list for NS", () => {
    const profile = resolveSubTopicProfile(NS_INPUT);
    const section = buildSs1Layer2MandatoryObjectivesSection(profile);
    expect(section).toContain("MANDATORY OBJECTIVES");
    expect(section).toContain("cerebellum");
    expect(section).toContain("thermoregulation");
    expect(section).toContain("CNS and PNS");
  });

  test("findDriftTermsInText detects sibling-topic terms", () => {
    const terms = findDriftTermsInText(
      "Describe the cerebellum, cerebral cortex, thermoregulation and eye accommodation."
    );
    expect(terms).toContain("cerebellum");
    expect(terms).toContain("cortex");
    expect(terms).toContain("thermoregulation");
    expect(terms).toContain("accommodation");
  });

  test("ensureObjectiveScopeCompliance rewrites contaminated objectives", () => {
    const fixes = [];
    const { text, changed, enforcementResult } = ensureObjectiveScopeCompliance(
      CONTAMINATED_LESSON,
      NS_INPUT,
      fixes
    );
    expect(changed).toBe(true);
    expect(enforcementResult.outOfScopeObjectiveCount).toBeGreaterThan(0);
    const gate = evaluateObjectivesAuthorityGate(text, NS_INPUT);
    expect(gate.pass).toBe(true);
    expect(gate.driftTermsFound).toEqual([]);
    expect(fixes.some((f) => /Objectives scope authority/i.test(f))).toBe(true);
  });

  test("evaluateObjectivesAuthorityGate fails on contaminated lesson", () => {
    const gate = evaluateObjectivesAuthorityGate(CONTAMINATED_LESSON, NS_INPUT);
    expect(gate.pass).toBe(false);
    expect(gate.driftTermsFound.length).toBeGreaterThan(0);
    expect(gate.violations.length).toBeGreaterThan(0);
  });

  test("evaluateObjectivesAuthorityGate passes after autofix", () => {
    const fixes = [];
    const { text } = ensureObjectiveScopeCompliance(CONTAMINATED_LESSON, NS_INPUT, fixes);
    const gate = evaluateObjectivesAuthorityGate(text, {
      ...NS_INPUT,
      scopeAutofixChanged: true,
    });
    expect(gate.pass).toBe(true);
    expect(gate.driftTermsFound).toEqual([]);
  });

  test("scanDownstreamDrift reports exam practice contamination", () => {
    const lesson = `${CONTAMINATED_LESSON}

23 — EXAM PRACTICE
Paste into: Text (concept)
<p>Q3: Explain how the cerebellum controls balance.</p>
<p>Q4: Describe thermoregulation when body temperature rises.</p>
`;
    const drift = scanDownstreamDrift(lesson);
    expect(drift.examPractice).toContain("cerebellum");
    expect(drift.examPractice).toContain("thermoregulation");
  });
});
