/**
 * Phase 3H.1.8a — Topic profiles for reasoning chains and examiner language (prompt only).
 */

const HOMEOSTASIS_TEACHING_QUALITY = {
  taxonomyKey: "homeostasis",
  matchPatterns: [/homeostasis/i, /thermoregulation/i, /control of body temperature/i],
  openingSlots: {
    coreModel: "Receptors → Coordination centre → Effectors",
    keyExamples: ["Body temperature", "Blood glucose", "Water balance"],
    examVocabulary: [
      "receptor",
      "coordination centre",
      "effector",
      "stimulus",
      "response",
      "optimum",
      "enzyme",
    ],
  },
  reasoningChains: [
    {
      id: "thermoregulation",
      label: "Thermoregulation (core temperature rise)",
      steps: [
        "Core body temperature rises above optimum",
        "Thermoreceptors in the skin detect the change",
        "Hypothalamus (coordination centre) receives information",
        "Sweat glands are activated",
        "Sweat evaporates from the skin surface",
        "Evaporation removes heat energy",
        "Core temperature returns towards the optimum",
      ],
      examPrompt:
        "Explain how the body responds when core temperature rises during exercise (4–6 marks).",
    },
    {
      id: "negative-feedback",
      label: "Negative feedback loop",
      steps: [
        "Stimulus moves a condition away from the set point",
        "Receptors detect the change",
        "Coordination centre processes information",
        "Effectors produce a corrective response",
        "Condition returns towards optimum",
        "Response is switched off when optimum is restored",
      ],
      examPrompt: "Describe the role of negative feedback in homeostasis (4 marks).",
    },
  ],
  examinerLanguage: {
    studentsOftenWrite: '"The body gets too hot so it sweats."',
    examinersExpect:
      "Named receptors → coordination centre → named effector → mechanism → return to optimum.",
    useThePhrase:
      '"Thermoreceptors detect a change in core temperature" and "negative feedback returns conditions to optimum."',
    avoidSaying:
      '"The brain makes you sweat" without naming the hypothalamus as coordination centre.',
    aqaWording:
      "Use **receptor**, **coordination centre**, **effector**, **stimulus**, **response**, **optimum**.",
    markLosingPhrase:
      '"Sweating cools you down" with no mention of evaporation removing heat energy.',
  },
};

const NERVOUS_SYSTEM_TEACHING_QUALITY = {
  taxonomyKey: "nervous-system-structure",
  matchPatterns: [
    /structure and function of the nervous system/i,
    /nervous-system-structure/i,
  ],
  openingSlots: {
    coreModel:
      "Stimulus → Receptor → Sensory neurone → CNS → Motor neurone → Effector → Response",
    keyExamples: [
      "Reflex actions",
      "Withdrawal reflex",
      "Touch receptors",
      "Light receptors",
      "Temperature receptors",
    ],
    examVocabulary: [
      "receptor",
      "sensory neurone",
      "relay neurone",
      "motor neurone",
      "synapse",
      "CNS",
      "PNS",
      "effector",
      "response",
      "stimulus",
    ],
  },
  reasoningChains: [
    {
      id: "stimulus-response",
      label: "Stimulus to response pathway",
      steps: [
        "Stimulus detected by receptors",
        "Sensory neurone carries impulse to CNS",
        "Relay neurone in spinal cord or brain",
        "Motor neurone carries impulse to effector",
        "Effector (muscle or gland) produces response",
        "Rapid response without conscious thought in reflex arcs",
      ],
      examPrompt: "Describe the pathway from stimulus to response in the nervous system (4 marks).",
    },
    {
      id: "myelin-speed",
      label: "Myelin and transmission speed",
      steps: [
        "Myelin sheath insulates the axon",
        "Impulses jump between nodes of Ranvier (saltatory conduction)",
        "Electrical signal loss is reduced",
        "Transmission speed increases significantly",
        "Effectors respond faster to stimuli",
        "Organism can react quickly to danger or change",
      ],
      examPrompt:
        "Explain why myelinated neurones transmit impulses faster than unmyelinated neurones (4 marks).",
    },
  ],
  examinerLanguage: {
    studentsOftenWrite: '"Nerves send messages to the brain."',
    examinersExpect:
      "Electrical impulses along named neurones; direction sensory → CNS → motor; effector named.",
    useThePhrase:
      '"Sensory neurone carries impulses **to** the CNS" and "motor neurone carries impulses **away** to effectors."',
    avoidSaying:
      '"The brain controls reflexes" — reflexes often bypass conscious brain processing via spinal cord.',
    aqaWording: "Use **neurone**, **axon**, **dendrite**, **CNS**, **PNS**, **receptor**, **effector**.",
    markLosingPhrase:
      '"Messages travel through nerves" without stating electrical impulses or synapses.',
  },
};

const THE_EYE_TEACHING_QUALITY = {
  taxonomyKey: "the-eye",
  matchPatterns: [/^the eye$/i, /structure of the eye/i, /vision and the eye/i, /\bthe eye\b/i],
  openingSlots: {
    coreModel: "Cornea → Lens → Retina",
    keyExamples: ["Cornea refraction", "Lens accommodation", "Retina image formation"],
    examVocabulary: [
      "cornea",
      "lens",
      "retina",
      "iris",
      "pupil",
      "ciliary muscles",
      "suspensory ligaments",
      "accommodation",
    ],
  },
  reasoningChains: [
    {
      id: "light-to-retina",
      label: "Light focusing on retina",
      steps: [
        "Light enters the eye through the cornea",
        "Cornea refracts (bends) light rays",
        "Iris controls pupil size (light intensity)",
        "Lens fine-focuses light by changing shape (accommodation)",
        "Light rays converge on the retina",
        "Photoreceptors in retina detect light and send impulses to brain",
      ],
      examPrompt: "Explain how the eye focuses light onto the retina (4–6 marks).",
    },
    {
      id: "accommodation",
      label: "Accommodation (near object)",
      steps: [
        "Ciliary muscles contract",
        "Suspensory ligaments slacken",
        "Lens becomes thicker and more curved",
        "Light refracts more strongly",
        "Near object image focused on retina",
      ],
      examPrompt: "Explain how the eye focuses on a near object (4 marks).",
    },
  ],
  examinerLanguage: {
    studentsOftenWrite: '"The lens focuses light" with no mechanism.',
    examinersExpect:
      "Cornea + lens refraction; accommodation sequence (ciliary muscles → ligaments → lens shape).",
    useThePhrase:
      '"Light is refracted by the cornea and lens" and "ciliary muscles change lens shape for accommodation."',
    avoidSaying:
      '"The eye zooms in" — use **accommodation**, **ciliary muscles**, **suspensory ligaments**.',
    aqaWording:
      "Use **cornea**, **lens**, **retina**, **accommodation**, **ciliary muscles**, **suspensory ligaments**.",
    markLosingPhrase:
      '"The retina sees the image" — the retina **detects light**; the brain interprets the image.',
  },
};

const ALL_PROFILES = [
  HOMEOSTASIS_TEACHING_QUALITY,
  NERVOUS_SYSTEM_TEACHING_QUALITY,
  THE_EYE_TEACHING_QUALITY,
];

function resolveTeachingQualityProfile(meta = {}) {
  const hay = `${meta.topic || ""} ${meta.title || ""} ${meta.subTopic || ""}`.trim();
  if (!hay) return null;
  for (const profile of ALL_PROFILES) {
    if (profile.matchPatterns.some((rx) => rx.test(hay))) {
      return profile;
    }
  }
  return null;
}

function listTeachingQualityProfileKeys() {
  return ALL_PROFILES.map((p) => p.taxonomyKey);
}

module.exports = {
  HOMEOSTASIS_TEACHING_QUALITY,
  NERVOUS_SYSTEM_TEACHING_QUALITY,
  THE_EYE_TEACHING_QUALITY,
  resolveTeachingQualityProfile,
  listTeachingQualityProfileKeys,
};
