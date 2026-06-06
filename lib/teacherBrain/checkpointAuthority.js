/**
 * Phase 3H.1.8b.1 Step 2 — Checkpoint / Quick Check / Drag-drop scope authority.
 */

const { resolveSubTopicProfile } = require("./subTopicProfiles");
const { getSubTopicBoundaryMode } = require("./subTopicBoundaryGuard");
const { findDriftTermsInText } = require("./objectivesAuthority");
const {
  detectBlockedInteractionKey,
  nearestAuthorizedTemplate,
  resolveAuthorityProfile,
  resolveAuthorizedInteractions,
  buildInteractionAuthorityPrompt,
} = require("./interactionAuthorityLayer");
const {
  replaceBlockAtSpan,
  listAssessmentBlockSpans,
} = require("./scopeBlockUtils");

const NS_PATHWAY_CHECKPOINT = `Question:
Which pathway correctly describes the transmission of a nervous impulse from stimulus to response?
Option 1:
Stimulus → Motor neurone → Sensory neurone → Effector → CNS
Option 2:
Stimulus → Receptor → Sensory neurone → CNS → Motor neurone → Effector → Response
Option 3:
Effector → Sensory neurone → Receptor → CNS → Response → Motor neurone
Option 4:
Stimulus → Effector → Sensory neurone → CNS → Motor neurone → Receptor
Answer:
Stimulus → Receptor → Sensory neurone → CNS → Motor neurone → Effector → Response`;

const NS_MOTOR_NEURONE_QUICK_CHECK = `Question:
Which type of neurone carries impulses from the CNS to an effector?
Option 1:
Sensory neurone
Option 2:
Relay neurone
Option 3:
Motor neurone
Option 4:
Receptor
Answer:
Motor neurone`;

const NS_MYELIN_QUICK_CHECK = `Question:
How does the myelin sheath help impulse transmission?
Option 1:
It slows impulses so the CNS can process information
Option 2:
It insulates the axon and allows impulses to jump between nodes, speeding transmission
Option 3:
It connects neurones at the synapse
Option 4:
It detects stimuli in the skin
Answer:
It insulates the axon and allows impulses to jump between nodes, speeding transmission`;

const NS_ADAPTATION_DRAG_DROP = `Instruction:
Match each structure or adaptation to its function.
Items to drag:
- Axon
- Dendrites
- Myelin sheath
- Sensory neurone
Drop zones:
- Carries impulses long distances → ______
- Receives impulses from other neurones → ______
- Speeds up impulse transmission → ______
- Carries impulses from receptors to the CNS → ______
Answer key:
<details>
<summary>Reveal Answer</summary>
- Carries impulses long distances → Axon
- Receives impulses from other neurones → Dendrites
- Speeds up impulse transmission → Myelin sheath
- Carries impulses from receptors to the CNS → Sensory neurone
</details>`;

const NS_CNS_PNS_DRAG_DROP = `Instruction:
Classify each part as CNS or PNS.
Items to drag:
- Brain
- Spinal cord
- Sensory neurone
- Motor neurone
- Nerve
Drop zones:
- Central nervous system → ______
- Peripheral nervous system → ______
Answer key:
<details>
<summary>Reveal Answer</summary>
- Brain → Central nervous system
- Spinal cord → Central nervous system
- Sensory neurone → Peripheral nervous system
- Motor neurone → Peripheral nervous system
- Nerve → Peripheral nervous system
</details>`;

function shouldApplyCheckpointAutofix(profile) {
  if (!profile) return false;
  if (getSubTopicBoundaryMode() >= 2) return true;
  return String(process.env.TEACHER_BRAIN_CHECKPOINT_AUTHORITY || "1").trim() === "1";
}

function blockKindFromSpan(span) {
  if (span.kind === "dragDrop") return "dragDrop";
  if (span.kind === "quickCheck") return "quickCheck";
  return "checkpoint";
}

function replacementBodyForTemplate(templateKey, blockKind) {
  if (blockKind === "dragDrop") {
    if (templateKey === "cns_pns_sort") return NS_CNS_PNS_DRAG_DROP;
    return NS_ADAPTATION_DRAG_DROP;
  }
  if (blockKind === "quickCheck") {
    if (templateKey === "myelin_speed_reasoning") return NS_MYELIN_QUICK_CHECK;
    return NS_MOTOR_NEURONE_QUICK_CHECK;
  }
  return NS_PATHWAY_CHECKPOINT;
}

function analyzeCheckpointBlock(body, authorityProfile) {
  const driftTerms = findDriftTermsInText(body);
  if (driftTerms.length) {
    const blockedKey = detectBlockedInteractionKey(body, authorityProfile) || "drift_terms";
    const template = nearestAuthorizedTemplate(blockedKey, authorityProfile);
    return {
      contaminated: true,
      blockedKey,
      driftTerms,
      replacementKey: template?.key || "receptor_effector_chain",
      template,
    };
  }
  const blockedKey = detectBlockedInteractionKey(body, authorityProfile);
  if (blockedKey) {
    const template = nearestAuthorizedTemplate(blockedKey, authorityProfile);
    return {
      contaminated: true,
      blockedKey,
      driftTerms: [],
      replacementKey: template?.key || null,
      template,
    };
  }
  return { contaminated: false, blockedKey: null, driftTerms: [], replacementKey: null, template: null };
}

function buildSs1Layer2MandatoryCheckpointSection(profile) {
  if (!profile || profile.taxonomyKey !== "nervous-system-structure") return "";
  const auth = resolveAuthorizedInteractions({ subTopicProfile: profile });
  const prompt = buildInteractionAuthorityPrompt({
    authorizedInteractions: auth.authorizedInteractionTemplates,
    blockedInteractions: Object.values(resolveAuthorityProfile(profile)?.blocked || {}),
    boundaryMode: getSubTopicBoundaryMode(),
  });
  if (!prompt.text) return "";

  return [
    "--------------------------------",
    "TEACHER-FIRST LAYER 2 — MANDATORY CHECKPOINTS (SS1 SCOPE AUTHORITY)",
    "--------------------------------",
    "",
    prompt.text,
    "",
    "CHECKPOINT / QUICK CHECK must test:",
    "- Stimulus → receptor → sensory neurone → CNS → motor neurone → effector → response",
    "- Motor vs sensory neurone roles",
    "- Myelin and impulse speed",
    "",
    "DRAG AND DROP must use:",
    "- Neurone structure ↔ function matching, OR",
    "- CNS vs PNS classification",
    "",
    "FORBIDDEN in checkpoints and drag-drop:",
    "- Cerebellum / cerebral cortex / medulla function questions",
    "- Brain region labelling or balance/coordination MCQs",
    "- Thermoregulation, sweating, vasodilation",
    "- Eye accommodation, iris, pupil, retina labelling",
  ].join("\n");
}

function ensureCheckpointScopeCompliance(
  text = "",
  { topic = "", topicKey = "", subTopic = "" } = {},
  fixes = []
) {
  const profile = resolveSubTopicProfile({ topicKey, topic, subTopic: subTopic || topic });
  if (!profile || !shouldApplyCheckpointAutofix(profile)) {
    return { text, changed: false, profile, replacements: [] };
  }

  const authorityProfile = resolveAuthorityProfile(profile);
  if (!authorityProfile) {
    return { text, changed: false, profile, replacements: [] };
  }

  let working = text;
  let changed = false;
  const replacements = [];

  const spans = listAssessmentBlockSpans(working).filter((s) =>
    ["checkpoint", "quickCheck", "dragDrop"].includes(s.kind)
  );

  for (let idx = spans.length - 1; idx >= 0; idx--) {
    const span = spans[idx];
    const analysis = analyzeCheckpointBlock(span.text, authorityProfile);
    if (!analysis.contaminated) continue;

    const blockKind = blockKindFromSpan(span);
    const replacementKey =
      analysis.replacementKey ||
      (blockKind === "dragDrop" ? "adaptation_function_match" : "receptor_effector_chain");
    const newBody = replacementBodyForTemplate(replacementKey, blockKind);
    const pasteLine =
      span.text.split("\n").find((l) => /^Paste into:/i.test(l.trim())) ||
      "Paste into: Checkpoint block";
    const newBlock = `${span.headerLine}\n${pasteLine}\n\n${newBody}\n`;
    working = replaceBlockAtSpan(working, span, newBlock);

    changed = true;
    replacements.push({
      kind: span.kind,
      blockedKey: analysis.blockedKey,
      replacementKey,
      driftTerms: analysis.driftTerms,
    });
  }

  if (changed) {
    fixes.push(
      `Checkpoint authority: rewrote ${replacements.length} contaminated assessment block(s).`
    );
  }

  return { text: working, changed, profile, replacements };
}

function collectCheckpointHaystack(lessonText = "") {
  const spans = listAssessmentBlockSpans(lessonText).filter((s) =>
    ["checkpoint", "quickCheck", "dragDrop"].includes(s.kind)
  );
  return spans.map((s) => s.text).join("\n");
}

function evaluateCheckpointAuthorityGate(lessonText = "", meta = {}) {
  const profile =
    meta.subTopicProfile ||
    resolveSubTopicProfile({
      topicKey: meta.topicKey,
      topic: meta.topic,
      subTopic: meta.subTopic || meta.topic,
    });

  const haystack = collectCheckpointHaystack(lessonText);
  const driftTermsFound = profile ? findDriftTermsInText(haystack) : [];
  const authorityProfile = profile ? resolveAuthorityProfile(profile) : null;

  const violations = [];
  if (authorityProfile) {
    for (const span of listAssessmentBlockSpans(lessonText)) {
      if (!["checkpoint", "quickCheck", "dragDrop"].includes(span.kind)) continue;
      const analysis = analyzeCheckpointBlock(span.text, authorityProfile);
      if (analysis.contaminated) {
        violations.push({
          kind: span.kind,
          blockedKey: analysis.blockedKey,
          driftTerms: analysis.driftTerms,
        });
      }
    }
  }

  const pass = driftTermsFound.length === 0 && violations.length === 0;

  return {
    pass,
    driftTermsFound,
    violations,
    blockCount: listAssessmentBlockSpans(lessonText).filter((s) =>
      ["checkpoint", "quickCheck", "dragDrop"].includes(s.kind)
    ).length,
    warnings:
      violations.length > 0
        ? [`${violations.length} checkpoint/drag-drop scope violation(s) remain.`]
        : [],
  };
}

module.exports = {
  buildSs1Layer2MandatoryCheckpointSection,
  ensureCheckpointScopeCompliance,
  evaluateCheckpointAuthorityGate,
  analyzeCheckpointBlock,
  replacementBodyForTemplate,
  NS_PATHWAY_CHECKPOINT,
};
