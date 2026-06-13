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
  workedReasoning: {
    primaryChainId: "thermoregulation",
    secondaryChainId: "negative-feedback",
    markingPointLabels: [
      "receptor",
      "coordination centre",
      "effector",
      "optimum",
      "negative feedback",
    ],
    minSteps: 4,
    commandWord: "Explain how",
    defaultExamStem:
      "Explain how the body responds when core temperature rises during exercise. (4 marks)",
  },
  examinerLanguageV2: {
    studentsOftenWrite: '"The body gets too hot so it sweats."',
    examinersExpect:
      "Named receptors → coordination centre (hypothalamus) → named effector → mechanism → return to optimum.",
    doNotSay: '"The brain makes you sweat" without naming the hypothalamus as coordination centre.',
    creditworthyAnswer:
      "Thermoreceptors detect a change in core temperature; the hypothalamus coordinates effectors therefore sweating increases heat loss by evaporation.",
    fullMarksGuidance:
      "Link stimulus, receptor, coordination centre, effector, mechanism, and negative feedback returning conditions towards the optimum.",
    markLosingReason:
      "Sweating is described without explaining evaporation removes heat energy.",
    gcseTerms: [
      "receptor",
      "effector",
      "stimulus",
      "optimum",
      "negative feedback",
      "thermoreceptor",
      "hypothalamus",
      "coordination centre",
      "enzyme",
    ],
    examSayLines: [
      "In the exam, say: 'Thermoreceptors detect a change in core temperature.'",
      "In the exam, say: 'Negative feedback returns conditions towards the optimum.'",
    ],
    contrastPairs: [
      {
        weak: "The body gets too hot so it sweats",
        strong:
          "Core temperature rises above the optimum; thermoreceptors detect the change and sweat glands are activated",
      },
      {
        weak: "The brain makes you sweat",
        strong:
          "The hypothalamus coordinates effectors therefore sweating increases heat loss by evaporation",
      },
    ],
    modelAnswerExample:
      "Core temperature rose to 38°C during exercise. Thermoreceptors detected the change. The hypothalamus coordinated sweating therefore heat loss increased by evaporation. The data supports negative feedback restoring optimum temperature.",
  },
  grade89Challenge: {
    promptStem:
      "Evaluate how effectively negative feedback restores optimum body temperature after exercise. (6 marks)",
    workedExampleStem:
      "Compare responses when core temperature rises versus when it falls — which coordination pathway is faster and why?",
    examPracticeStem:
      "A student claims sweating alone controls temperature. Evaluate this statement using evidence from thermoreceptors and effectors. (4 marks)",
    summaryStem:
      "Grade 8/9: Compare negative feedback in temperature control with blood glucose regulation.",
    topBandCriteria: [
      "negative feedback",
      "optimum",
      "coordination centre",
      "evaluate",
      "compare",
      "evidence",
    ],
    forbidden: "Do not repeat the Core Model receptor → effector list verbatim in the challenge section.",
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
  workedReasoning: {
    primaryChainId: "stimulus-response",
    secondaryChainId: "myelin-speed",
    markingPointLabels: [
      "receptor",
      "sensory neurone",
      "motor neurone",
      "effector",
      "response",
    ],
    minSteps: 4,
    commandWord: "Explain how",
    defaultExamStem:
      "Explain how a reflex arc produces a rapid response to a painful stimulus. (4 marks)",
  },
  examinerLanguageV2: {
    studentsOftenWrite: '"Messages travel through nerves to the brain."',
    examinersExpect:
      "Electrical impulses along named neurones; direction sensory → CNS → motor; effector named.",
    doNotSay: '"Signals" or "messages" without stating electrical impulses or synapses.',
    creditworthyAnswer:
      "Electrical impulses travel along sensory neurones to the CNS; motor neurones transmit impulses to the effector therefore a response occurs.",
    fullMarksGuidance:
      "Name stimulus, receptor, sensory neurone, CNS, motor neurone, effector, and response in sequence with because/therefore links.",
    markLosingReason:
      "Impulse direction is vague or neurones are not named.",
    gcseTerms: [
      "stimulus",
      "receptor",
      "effector",
      "electrical impulse",
      "neurone",
      "synapse",
      "CNS",
      "sensory neurone",
      "motor neurone",
      "relay neurone",
    ],
    examSayLines: [
      "In the exam, say: 'Sensory neurone carries electrical impulses to the CNS.'",
      "In the exam, say: 'Motor neurone transmits impulses to the effector.'",
    ],
    contrastPairs: [
      {
        weak: "The nervous system helps responses",
        strong:
          "The nervous system coordinates responses through electrical impulses transmitted along neurones",
      },
      {
        weak: "Messages travel through nerves",
        strong: "Electrical impulses travel along sensory and motor neurones",
      },
    ],
    modelAnswerExample:
      "The mean reaction time decreased from 260 ms to 240 ms. This indicates faster responses. Caffeine acts as a stimulant affecting nervous transmission. Therefore the data supports the hypothesis.",
  },
  grade89Challenge: {
    promptStem:
      "Compare the roles of sensory, relay and motor neurones in producing a coordinated response. (6 marks)",
    workedExampleStem:
      "Explain why myelinated neurones transmit impulses faster than unmyelinated neurones — evaluate the survival advantage. (4 marks)",
    examPracticeStem:
      "Evaluate whether a reflex arc through the spinal cord is always faster than a conscious response through the brain. (6 marks)",
    summaryStem:
      "Grade 8/9: Compare electrical transmission along neurones with chemical transmission across synapses.",
    topBandCriteria: [
      "compare",
      "myelin",
      "saltatory",
      "synapse",
      "evaluate",
      "justify",
      "electrical impulses",
    ],
    forbidden: "Do not repeat the block 6 stimulus → response pathway verbatim.",
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
  workedReasoning: {
    primaryChainId: "light-to-retina",
    secondaryChainId: "accommodation",
    markingPointLabels: ["cornea", "lens", "retina", "refract", "accommodation"],
    minSteps: 4,
    commandWord: "Explain how",
    defaultExamStem: "Explain how the eye focuses light onto the retina. (4 marks)",
  },
  examinerLanguageV2: {
    studentsOftenWrite: '"The lens focuses light" with no mechanism.',
    examinersExpect:
      "Cornea and lens refraction; accommodation sequence (ciliary muscles → ligaments → lens shape).",
    doNotSay: '"The eye zooms in" — use accommodation, ciliary muscles, suspensory ligaments.',
    creditworthyAnswer:
      "Light is refracted by the cornea and lens; ciliary muscles change lens shape during accommodation therefore rays converge on the retina.",
    fullMarksGuidance:
      "Link cornea, lens, accommodation, retina, and photoreceptors with cause → effect chains.",
    markLosingReason:
      "The retina is said to 'see' the image instead of detecting light.",
    gcseTerms: [
      "cornea",
      "lens",
      "retina",
      "accommodation",
      "ciliary muscles",
      "suspensory ligaments",
      "refract",
      "photoreceptor",
      "iris",
      "pupil",
    ],
    examSayLines: [
      "In the exam, say: 'Light is refracted by the cornea and lens.'",
      "In the exam, say: 'Ciliary muscles change lens shape during accommodation.'",
    ],
    contrastPairs: [
      {
        weak: "The lens focuses light",
        strong:
          "The cornea and lens refract light rays therefore they converge on the retina",
      },
      {
        weak: "The eye zooms in",
        strong:
          "Ciliary muscles contract leading to a thicker lens and increased refraction",
      },
    ],
    modelAnswerExample:
      "Light enters through the cornea. The lens refracts rays more strongly during accommodation. Photoreceptors in the retina detect the focused image. Therefore the eye maintains a clear image on the retina.",
  },
  grade89Challenge: {
    promptStem:
      "Compare how the eye focuses on a near object versus a distant object — evaluate the role of accommodation. (6 marks)",
    workedExampleStem:
      "Evaluate whether corneal refraction alone could produce a sharp retinal image without lens accommodation.",
    examPracticeStem:
      "A student says the retina 'sees' the image. Evaluate this statement using evidence about photoreceptors and the brain. (4 marks)",
    summaryStem:
      "Grade 8/9: Compare refractive roles of the cornea and lens for near and distant vision.",
    topBandCriteria: [
      "accommodation",
      "ciliary",
      "compare",
      "evaluate",
      "refract",
      "retina",
    ],
    forbidden: "Do not repeat the Core Model cornea → lens → retina list verbatim.",
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
