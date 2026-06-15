/**
 * P1.3B — Deterministic GCSE diagram profiles for Visual Explanation image prompts.
 * Isolated from Teacher Brain — read-only pedagogy for image generation only.
 */

/**
 * @typedef {object} TopicDiagramProfile
 * @property {string} id
 * @property {string} topic
 * @property {RegExp[]} topicPatterns
 * @property {RegExp[]} [contextPatterns]
 * @property {string[]} requiredLabels
 * @property {string} structure
 * @property {string[]} avoid
 */

/** @type {TopicDiagramProfile[]} */
const TOPIC_DIAGRAM_PROFILES = [
  {
    id: "reflex-arc",
    topic: "Reflex arc",
    topicPatterns: [
      /\breflex\s+arc\b/i,
      /\breflex\s+pathway\b/i,
      /\bwithdrawal\s+reflex\b/i,
      /\bstimulus\b.*\bresponse\b/i,
      /\bhomeostasis\s+and\s+response\b/i,
    ],
    contextPatterns: [
      /\bsensory\s+neurone\b/i,
      /\brelay\s+neurone\b/i,
      /\bmotor\s+neurone\b/i,
      /\bspinal\s+cord\b/i,
      /\bstimulus\b/i,
      /\beffector\b/i,
    ],
    requiredLabels: [
      "STIMULUS",
      "RECEPTOR",
      "SENSORY NEURONE",
      "RELAY NEURONE",
      "SPINAL CORD",
      "MOTOR NEURONE",
      "EFFECTOR",
      "RESPONSE",
    ],
    structure:
      "Clear left-to-right or top-to-bottom pathway from STIMULUS to RESPONSE. " +
      "Show sensory neurone entering spinal cord, relay neurone inside spinal cord, " +
      "motor neurone leaving spinal cord, and effector producing response. " +
      "Use arrows showing impulse direction. Prefer numbered pathway labels 1–7.",
    avoid: [
      "Missing relay neurone",
      "Brain decision-making or cerebrum",
      "Generic neuron-only diagram without full pathway",
      "Random hand icon without full pathway",
    ],
  },
  {
    id: "photosynthesis",
    topic: "Photosynthesis",
    topicPatterns: [
      /\bphotosynthesis\b/i,
      /\bchloroplast\b/i,
      /\bglucose\s+and\s+oxygen\b/i,
    ],
    contextPatterns: [
      /\bcarbon\s+dioxide\b/i,
      /\bchlorophyll\b/i,
      /\bchloroplast\b/i,
      /\bglucose\b/i,
      /\boxygen\b/i,
      /\bsunlight\b/i,
    ],
    requiredLabels: [
      "SUNLIGHT",
      "CHLOROPHYLL",
      "CHLOROPLAST",
      "CARBON DIOXIDE",
      "WATER",
      "GLUCOSE",
      "OXYGEN",
    ],
    structure:
      "Reactants (carbon dioxide and water) enter plant/chloroplast; products (glucose and oxygen) leave. " +
      "Show sunlight absorbed by chlorophyll. Simple equation-style flow: carbon dioxide + water → glucose + oxygen. " +
      "Include chloroplast close-up if possible.",
    avoid: [
      "Generic plant sketch only",
      "Missing oxygen",
      "Missing chloroplast",
      "Showing glucose as input/reactant",
    ],
  },
  {
    id: "diffusion",
    topic: "Diffusion",
    topicPatterns: [
      /\bdiffusion\b/i,
      /\bconcentration\s+gradient\b/i,
      /\bnet\s+movement\b/i,
    ],
    contextPatterns: [
      /\bhigh\s+concentration\b/i,
      /\blow\s+concentration\b/i,
      /\bpartially\s+permeable\b/i,
      /\bmembrane\b/i,
      /\bparticles\b/i,
    ],
    requiredLabels: [
      "HIGH CONCENTRATION",
      "LOW CONCENTRATION",
      "PARTICLES",
      "NET MOVEMENT",
      "PARTIALLY PERMEABLE MEMBRANE",
    ],
    structure:
      "Show particles moving from high concentration to low concentration with arrows showing net movement. " +
      "Prefer before/after or side-by-side gradient. If membrane used, show particles crossing membrane.",
    avoid: [
      "Random particles with no gradient",
      "Osmosis-only water diagram unless context explicitly says osmosis",
      "No arrows",
    ],
  },
  {
    id: "enzymes",
    topic: "Enzymes",
    topicPatterns: [
      /\benzyme\b/i,
      /\bactive\s+site\b/i,
      /\block[- ]and[- ]key\b/i,
      /\bsubstrate\b/i,
      /\benzyme[- ]substrate\s+complex\b/i,
    ],
    contextPatterns: [
      /\bactive\s+site\b/i,
      /\bsubstrate\b/i,
      /\bproducts?\b/i,
      /\bdenatur/i,
    ],
    requiredLabels: [
      "ENZYME",
      "ACTIVE SITE",
      "SUBSTRATE",
      "ENZYME-SUBSTRATE COMPLEX",
      "PRODUCTS",
    ],
    structure:
      "Three-step sequence: (1) substrate approaches enzyme with visible active site, " +
      "(2) enzyme-substrate complex forms, (3) products released and enzyme unchanged. Use GCSE terminology.",
    avoid: [
      "Single lock-and-key image only without sequence",
      "Missing enzyme-substrate complex step",
      "Showing enzyme used up or destroyed",
    ],
  },
  {
    id: "reaction-time-practical",
    topic: "Reaction time required practical",
    topicPatterns: [
      /\breaction\s+time\b/i,
      /\bruler[- ]drop\b/i,
      /\bruler\s+drop\s+test\b/i,
      /\brequired\s+practical\b.*\breaction\b/i,
      /\breaction\b.*\brequired\s+practical\b/i,
    ],
    contextPatterns: [
      /\bruler\b/i,
      /\bzero\s+mark\b/i,
      /\bcatcher'?s?\s+hand\b/i,
      /\bdrop\s+distance\b/i,
      /\brepeats?\b/i,
      /\bcontrol\s+variable\b/i,
    ],
    requiredLabels: [
      "RULER",
      "ZERO MARK",
      "CATCHER'S HAND",
      "DROP DISTANCE",
      "REACTION TIME",
      "CONTROL VARIABLE",
      "REPEATS",
    ],
    structure:
      "Ruler-drop practical setup: vertical ruler, zero mark at top of catcher's hand, distance fallen measured. " +
      "Include note that repeats improve reliability. Safe classroom practical style.",
    avoid: [
      "Decorative lab setup",
      "Stopwatch-only method",
      "Missing ruler scale",
      "Missing hand/ruler relationship",
    ],
  },
];

function normalizeMatchText(parts) {
  return parts
    .filter(Boolean)
    .map((p) => String(p).trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {RegExp[]} patterns
 * @param {string} text
 * @returns {number}
 */
function countPatternHits(patterns, text) {
  if (!patterns?.length || !text) return 0;
  return patterns.reduce((n, re) => (re.test(text) ? n + 1 : n), 0);
}

/**
 * @param {TopicDiagramProfile} profile
 * @param {string} combined
 * @returns {{ score: number; topicHits: number; contextHits: number }}
 */
function scoreProfile(profile, combined) {
  const topicHits = countPatternHits(profile.topicPatterns, combined);
  const contextHits = countPatternHits(profile.contextPatterns || [], combined);
  const score = topicHits * 3 + contextHits;
  return { score, topicHits, contextHits };
}

/**
 * @param {string} confidence
 * @returns {"high"|"medium"|"low"|null}
 */
function normalizeConfidence(confidence) {
  if (confidence === "high" || confidence === "medium" || confidence === "low") return confidence;
  return null;
}

/**
 * Resolve the best-matching GCSE diagram profile.
 *
 * @param {{
 *   topic?: string;
 *   context?: string|null;
 *   subject?: string;
 *   examBoard?: string;
 *   tier?: string;
 * }} params
 * @returns {{ profile: TopicDiagramProfile; profileId: string; confidence: "high"|"medium"|"low" }|null}
 */
function resolveTopicDiagramProfile({
  topic = "",
  context = null,
  subject = "",
  examBoard = "",
  tier = "",
} = {}) {
  const combined = normalizeMatchText([topic, context, subject, examBoard, tier]);
  if (!combined) return null;

  let best = null;

  for (const profile of TOPIC_DIAGRAM_PROFILES) {
    const { score, topicHits, contextHits } = scoreProfile(profile, combined);
    if (score <= 0) continue;

    let confidence = "low";
    if (topicHits >= 1 && contextHits >= 2) confidence = "high";
    else if (topicHits >= 1 && contextHits >= 1) confidence = "medium";
    else if (topicHits >= 1) confidence = "medium";
    else if (contextHits >= 3) confidence = "medium";

    if (!best || score > best.score) {
      best = { profile, profileId: profile.id, confidence, score, topicHits, contextHits };
    }
  }

  if (!best || best.score < 3) return null;

  return {
    profile: best.profile,
    profileId: best.profileId,
    confidence: normalizeConfidence(best.confidence) || "low",
  };
}

/**
 * @param {TopicDiagramProfile} profile
 * @returns {string}
 */
function buildProfilePromptSection(profile) {
  const labels = profile.requiredLabels.map((l) => l.toUpperCase()).join(", ");
  const avoid = profile.avoid.map((a) => `- ${a}`).join("\n");
  return [
    `GCSE diagram topic: ${profile.topic}.`,
    `Required labels (exact uppercase, all must appear): ${labels}.`,
    `Required structure: ${profile.structure}`,
    "Avoid:",
    avoid,
  ].join("\n");
}

module.exports = {
  TOPIC_DIAGRAM_PROFILES,
  resolveTopicDiagramProfile,
  buildProfilePromptSection,
  normalizeMatchText,
};
