/**
 * Phase 3H.1.8b.2b — Memory Rule authority tests.
 */

const {
  ensureMemoryRuleScopeCompliance,
  evaluateMemoryRuleAuthorityGate,
} = require("../lib/teacherBrain/memoryRuleAuthority");
const { findClosingDriftTermsInText } = require("../lib/teacherBrain/closingScopeUtils");

const NS_INPUT = {
  topic: "Structure and function of the nervous system",
  topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
};

const CONTAMINATED_MEMORY_RULE = `PAGE 1

21 — FINAL MEMORY RULE
Paste into: Final memory rule (key idea)
<h2><strong>💡 Key Insight</strong></h2>
<p>Stimulus → Receptor → Sensory neurone → CNS → Motor neurone → Effector → Response is the backbone of all nervous system actions.</p>
<p>Receptors detect and convert stimuli → sensory neurones quickly carry impulses to the CNS where processing happens.</p>
<p>Remember brain regions (cerebral cortex, cerebellum, medulla) have specific roles in thinking, coordination, and automatic control.</p>
<p>The eye's structure is adapted to focus and detect light precisely.</p>
<p>Skin receptors and the hypothalamus work together in thermoregulation to maintain body temperature.</p>
`;

describe("Phase 3H.1.8b.2b — Memory Rule authority", () => {
  test("memory rule authority rewrites contaminated NS memory rule block", () => {
    const fixes = [];
    const { text, changed } = ensureMemoryRuleScopeCompliance(
      CONTAMINATED_MEMORY_RULE,
      NS_INPUT,
      fixes
    );
    expect(changed).toBe(true);
    expect(findClosingDriftTermsInText(text)).toEqual([]);
    expect(text).toMatch(/Stimulus → Receptor → Sensory neurone/i);
    expect(text).not.toMatch(/cerebellum/i);
    expect(text).not.toMatch(/thermoregulation/i);
    const gate = evaluateMemoryRuleAuthorityGate(text, NS_INPUT);
    expect(gate.pass).toBe(true);
  });

  test("clean memory rule block passes gate without rewrite", () => {
    const clean = `21 — FINAL MEMORY RULE
Paste into: Final memory rule (key idea)
<h2><strong>💡 Key Insight</strong></h2>
<p>👉 Stimulus → Receptor → Sensory neurone → CNS → Motor neurone → Effector → Response.</p>
`;
    const fixes = [];
    const { changed } = ensureMemoryRuleScopeCompliance(clean, NS_INPUT, fixes);
    expect(changed).toBe(false);
    expect(evaluateMemoryRuleAuthorityGate(clean, NS_INPUT).pass).toBe(true);
  });

  test("homeostasis topic without memory rule profile skips gate", () => {
    const gate = evaluateMemoryRuleAuthorityGate("<p>hypothalamus</p>", {
      topic: "Homeostasis",
      topicKey: "aqa-gcse-biology:homeostasis",
    });
    expect(gate.skipped).toBe(true);
    expect(gate.pass).toBe(true);
  });
});
