/**
 * Phase 3H.1.8b.2a — Summary authority tests.
 */

const {
  ensureSummaryScopeCompliance,
  evaluateSummaryAuthorityGate,
  findClosingDriftTermsInText,
} = require("../lib/teacherBrain/summaryAuthority");
const { hasFutureLessonPreviewMarker } = require("../lib/teacherBrain/closingScopeUtils");

const NS_INPUT = {
  topic: "Structure and function of the nervous system",
  topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
};

const CONTAMINATED_SUMMARY = `PAGE 1

24 — SUMMARY
Paste into: Text (concept)
<h2><strong>Summary</strong></h2>
<ul>
<li>The nervous system detects stimuli and coordinates rapid responses using electrical impulses.</li>
<li>Receptors convert stimuli into impulses; sensory neurones carry impulses to the CNS.</li>
<li>Motor neurones transmit impulses from the CNS to effectors that produce responses.</li>
<li>Neurones have specialised structures—myelin sheaths speed up impulse transmission.</li>
<li>The brain consists of regions like the cerebral cortex, cerebellum, and medulla, each with specific roles.</li>
<li>The eye has structures adapted to detect light and focus images on the retina.</li>
<li>Thermoregulation uses skin receptors and the thermoregulatory centre in the brain to maintain body temperature.</li>
</ul>
<p><strong>Remember:</strong> Always link structure to function.</p>
`;

const PREVIEW_SUMMARY = `PAGE 1

24 — SUMMARY
Paste into: Text (concept)
<h2><strong>Summary</strong></h2>
<ul>
<li>Receptors detect stimuli; sensory neurones carry impulses to the CNS.</li>
<li>Brain regions are covered in a later lesson.</li>
</ul>
`;

describe("Phase 3H.1.8b.2a — Summary authority", () => {
  test("summary authority rewrites contaminated NS summary block", () => {
    const fixes = [];
    const { text, changed } = ensureSummaryScopeCompliance(CONTAMINATED_SUMMARY, NS_INPUT, fixes);
    expect(changed).toBe(true);
    expect(findClosingDriftTermsInText(text)).toEqual([]);
    expect(text).toMatch(/myelin sheaths speed impulse transmission/i);
    expect(text).not.toMatch(/cerebellum/i);
    expect(text).not.toMatch(/thermoregulation/i);
    const gate = evaluateSummaryAuthorityGate(text, NS_INPUT);
    expect(gate.pass).toBe(true);
  });

  test("preview-marked sentence passes gate without forbidden terms flagged", () => {
    expect(hasFutureLessonPreviewMarker("Brain regions are covered in a later lesson.")).toBe(true);
    expect(findClosingDriftTermsInText(PREVIEW_SUMMARY)).toEqual([]);
    const gate = evaluateSummaryAuthorityGate(PREVIEW_SUMMARY, NS_INPUT);
    expect(gate.pass).toBe(true);
  });

  test("bare forbidden term fails gate", () => {
    const drift = findClosingDriftTermsInText(
      "<p>The cerebellum controls balance and coordination.</p>"
    );
    expect(drift).toContain("cerebellum");
  });

  test("homeostasis topic without summary profile skips gate", () => {
    const gate = evaluateSummaryAuthorityGate("<p>thermoregulation</p>", {
      topic: "Homeostasis",
      topicKey: "aqa-gcse-biology:homeostasis",
    });
    expect(gate.skipped).toBe(true);
    expect(gate.pass).toBe(true);
  });
});
