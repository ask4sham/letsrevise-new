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
    summaryTakeaway:
      "Homeostasis maintains internal conditions within optimum ranges using negative feedback between receptors, coordination centres, and effectors.",
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
    summaryTakeaway:
      "Reaction time is the interval between stimulus and response and is influenced by transmission along neurones and across synapses.",
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
    summaryTakeaway:
      "The eye focuses light through refraction by the cornea and lens, with accommodation enabling near objects to form a clear image on the retina.",
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

const REFLEX_ARC_TEACHING_QUALITY = {
  taxonomyKey: "reflex-arc",
  matchPatterns: [/^the reflex arc$/i, /reflex\s+arc/i, /reflex\s+action/i, /reflex-arc/i],
  openingSlots: {
    coreModel:
      "Stimulus → Receptor → Sensory neurone → Relay neurone (spinal cord) → Motor neurone → Effector → Response",
    keyExamples: [
      "Withdrawal reflex from a hot object",
      "Knee jerk reflex",
      "Blink reflex",
      "Pupillary reflex",
    ],
    examVocabulary: [
      "receptor",
      "sensory neurone",
      "relay neurone",
      "motor neurone",
      "effector",
      "stimulus",
      "response",
      "spinal cord",
      "reflex",
    ],
  },
  reasoningChains: [
    {
      id: "reflex-pathway",
      label: "Reflex arc pathway",
      steps: [
        "Stimulus detected by receptors in the sense organ",
        "Sensory neurone carries impulses to the spinal cord",
        "Relay neurone connects sensory and motor neurones in the CNS",
        "Motor neurone carries impulses to the effector",
        "Effector (muscle or gland) produces a rapid response",
        "Response occurs without conscious brain processing",
      ],
      examPrompt: "Describe the pathway of a reflex arc from stimulus to response. (4 marks)",
    },
    {
      id: "reflex-vs-voluntary",
      label: "Reflex versus voluntary response",
      steps: [
        "Reflex arc pathway is shorter than voluntary pathways",
        "Fewer synapses to cross in the spinal cord",
        "Response is automatic and protective",
        "Voluntary responses involve conscious processing in the brain",
        "Reflexes are faster but less flexible",
      ],
      examPrompt:
        "Explain why a reflex response is faster than a voluntary response. (3–4 marks)",
    },
  ],
  examinerLanguage: {
    studentsOftenWrite: '"The brain controls reflexes."',
    examinersExpect:
      "Named neurones in order; spinal cord as relay; effector named; automatic response stated.",
    useThePhrase:
      '"Relay neurone in the spinal cord" and "response without conscious thought."',
    avoidSaying:
      '"Nerves send messages" without naming sensory, relay, and motor neurones.',
    aqaWording:
      "Use **sensory neurone**, **relay neurone**, **motor neurone**, **effector**, **reflex**.",
    markLosingPhrase:
      '"The reflex happens in the brain" when the pathway is through the spinal cord.',
  },
  workedReasoning: {
    primaryChainId: "reflex-pathway",
    secondaryChainId: "reflex-vs-voluntary",
    markingPointLabels: [
      "receptor",
      "sensory neurone",
      "relay neurone",
      "motor neurone",
      "effector",
      "response",
    ],
    minSteps: 4,
    commandWord: "Describe",
    defaultExamStem:
      "Describe the pathway of a reflex arc from stimulus to response. (4 marks)",
  },
  examinerLanguageV2: {
    examSayLines: [
      "In the exam, say: 'Sensory neurone carries impulses to the spinal cord.'",
      "In the exam, say: 'Relay neurone connects sensory and motor neurones.'",
    ],
    contrastPairs: [
      {
        weak: "The brain controls reflexes",
        strong:
          "Impulses pass through relay neurones in the spinal cord therefore the response is rapid and automatic",
      },
      {
        weak: "Nerves send messages",
        strong: "Electrical impulses travel along sensory and motor neurones to the effector",
      },
    ],
    summaryTakeaway:
      "A reflex arc produces a rapid automatic response through sensory, relay, and motor neurones linking receptors to effectors.",
    modelAnswerExample:
      "Receptors detected the hot stimulus. A sensory neurone carried impulses to the spinal cord. A relay neurone connected to a motor neurone. The effector muscle contracted therefore the hand withdrew rapidly.",
  },
  grade89Challenge: {
    promptStem:
      "Compare reflex and voluntary responses — evaluate which pathway is faster and why. (6 marks)",
    workedExampleStem:
      "Evaluate whether all reflex arcs bypass the brain completely. (4 marks)",
    examPracticeStem:
      "A student says reflexes are controlled by the brain. Evaluate this statement. (4 marks)",
    summaryStem: "Grade 8/9: Compare reflex arc pathways with conscious responses through the brain.",
    topBandCriteria: ["compare", "relay neurone", "spinal cord", "evaluate", "automatic", "synapse"],
    forbidden: "Do not repeat the block 6 stimulus → response pathway verbatim.",
  },
};

const CELL_STRUCTURE_TEACHING_QUALITY = {
  taxonomyKey: "cell-structure",
  matchPatterns: [
    /^cell structure$/i,
    /cell-structure/i,
    /structure of (?:animal|plant|bacterial )?cells/i,
    /animal and plant cells/i,
    /eukaryot/i,
    /prokaryot/i,
  ],
  openingSlots: {
    coreModel:
      "Nucleus (controls activities) → Cytoplasm (chemical reactions) → Cell membrane (controls transport); plant cells also have cell wall, chloroplast, and large vacuole",
    keyExamples: [
      "Animal cell organelles",
      "Plant cell with chloroplasts",
      "Bacterial cell (no nucleus)",
      "Mitochondria for respiration",
    ],
    examVocabulary: [
      "nucleus",
      "cytoplasm",
      "cell membrane",
      "mitochondria",
      "ribosomes",
      "chloroplast",
      "cell wall",
      "vacuole",
      "plasmid",
    ],
  },
  reasoningChains: [
    {
      id: "plant-vs-animal",
      label: "Plant cells versus animal cells",
      steps: [
        "Both have nucleus, cytoplasm, cell membrane, mitochondria, and ribosomes",
        "Plant cells have a rigid cell wall for support",
        "Plant cells have chloroplasts for photosynthesis",
        "Plant cells have a large permanent vacuole for turgor",
        "Animal cells lack cell wall, chloroplasts, and large vacuole",
      ],
      examPrompt: "Compare plant and animal cells. (4 marks)",
    },
    {
      id: "organelle-functions",
      label: "Organelle functions",
      steps: [
        "Nucleus contains genetic material and controls cell activities",
        "Mitochondria are the site of aerobic respiration",
        "Ribosomes synthesise proteins",
        "Cell membrane controls movement of substances in and out",
        "Chloroplasts absorb light for photosynthesis in plant cells",
      ],
      examPrompt: "Explain the function of the nucleus and mitochondria in a cell. (4 marks)",
    },
  ],
  examinerLanguage: {
    studentsOftenWrite: '"The cell wall controls what enters the cell."',
    examinersExpect:
      "Cell membrane for transport; cell wall for support in plants; named organelle functions.",
    useThePhrase:
      '"Mitochondria are the site of aerobic respiration" and "chloroplasts are the site of photosynthesis."',
    avoidSaying:
      '"The nucleus makes energy" — mitochondria carry out respiration.',
    aqaWording:
      "Use **nucleus**, **cytoplasm**, **cell membrane**, **mitochondria**, **chloroplast**, **ribosomes**.",
    markLosingPhrase:
      '"Plant and animal cells are the same" with no mention of cell wall or chloroplasts.',
  },
  workedReasoning: {
    primaryChainId: "plant-vs-animal",
    secondaryChainId: "organelle-functions",
    markingPointLabels: ["chloroplast", "cell wall", "photosynthesis", "mitochondria", "nucleus"],
    minSteps: 3,
    commandWord: "Explain why",
    defaultExamStem: "Explain why plant cells have chloroplasts but animal cells do not. (3 marks)",
  },
  examinerLanguageV2: {
    examSayLines: [
      "In the exam, say: 'Chloroplasts are the site of photosynthesis.'",
      "In the exam, say: 'The cell membrane controls movement of substances.'",
    ],
    contrastPairs: [
      {
        weak: "Plant cells make food",
        strong:
          "Plant cells contain chloroplasts with chlorophyll therefore they carry out photosynthesis",
      },
      {
        weak: "The cell wall controls entry",
        strong: "The cell membrane controls transport; the cell wall provides support in plant cells",
      },
    ],
    summaryTakeaway:
      "Specialised organelles carry out distinct roles: nucleus controls activities, mitochondria respire, chloroplasts photosynthesise in plant cells.",
    modelAnswerExample:
      "Plant cells photosynthesise to make glucose. Chloroplasts contain chlorophyll and are the site of photosynthesis. Animal cells do not photosynthesise therefore they do not need chloroplasts.",
  },
  grade89Challenge: {
    promptStem:
      "Compare eukaryotic and prokaryotic cells — evaluate structural differences. (6 marks)",
    workedExampleStem:
      "Evaluate whether a bacterial cell could carry out photosynthesis without chloroplasts. (4 marks)",
    examPracticeStem:
      "A student confuses cell wall and cell membrane functions. Evaluate their answer. (4 marks)",
    summaryStem: "Grade 8/9: Compare organelle structures across plant, animal, and bacterial cells.",
    topBandCriteria: ["compare", "organelle", "eukaryotic", "prokaryotic", "evaluate", "function"],
    forbidden: "Do not repeat the Core Model organelle list verbatim.",
  },
};

const CONTROL_BLOOD_GLUCOSE_TEACHING_QUALITY = {
  taxonomyKey: "control-blood-glucose",
  matchPatterns: [
    /control of blood glucose/i,
    /blood glucose concentration/i,
    /blood glucose regulation/i,
    /control-blood-glucose/i,
    /insulin.*glucagon/i,
  ],
  openingSlots: {
    coreModel:
      "Receptors detect change → Pancreas (coordination centre) → Insulin or glucagon released → Liver/muscles (effectors) → Blood glucose returns to optimum",
    keyExamples: [
      "Blood glucose rises after a meal",
      "Insulin lowers blood glucose",
      "Glucagon raises blood glucose",
      "Glycogen stored in the liver",
    ],
    examVocabulary: [
      "insulin",
      "glucagon",
      "glycogen",
      "pancreas",
      "liver",
      "receptor",
      "negative feedback",
      "blood glucose",
      "hormone",
    ],
  },
  reasoningChains: [
    {
      id: "glucose-rise",
      label: "Blood glucose rises above optimum",
      steps: [
        "Blood glucose concentration rises above the set point",
        "Receptors detect the change",
        "Pancreas (coordination centre) releases insulin",
        "Insulin causes cells to take up more glucose from the blood",
        "Excess glucose is converted to glycogen in the liver",
        "Blood glucose returns towards the optimum",
      ],
      examPrompt: "Explain how the body responds when blood glucose rises above normal. (4 marks)",
    },
    {
      id: "glucose-fall",
      label: "Blood glucose falls below optimum",
      steps: [
        "Blood glucose concentration falls below the set point",
        "Receptors detect the change",
        "Pancreas releases glucagon",
        "Glucagon causes glycogen to be converted back to glucose in the liver",
        "Glucose is released into the blood",
        "Blood glucose returns towards the optimum",
      ],
      examPrompt: "Explain how the body responds when blood glucose falls below normal. (4 marks)",
    },
  ],
  examinerLanguage: {
    studentsOftenWrite: '"Insulin lowers sugar."',
    examinersExpect:
      "Named hormone; pancreas; liver or cells as effector; glycogen conversion; return to optimum.",
    useThePhrase:
      '"Insulin causes glucose to be converted to glycogen" and "negative feedback returns blood glucose to optimum."',
    avoidSaying:
      '"The body makes less sugar" without naming glucagon and glycogen breakdown.',
    aqaWording:
      "Use **insulin**, **glucagon**, **glycogen**, **pancreas**, **negative feedback**, **optimum**.",
    markLosingPhrase:
      '"Insulin and glucagon do the same thing" with no contrast between raise and lower responses.',
  },
  workedReasoning: {
    primaryChainId: "glucose-rise",
    secondaryChainId: "glucose-fall",
    markingPointLabels: ["insulin", "glucagon", "glycogen", "pancreas", "negative feedback", "optimum"],
    minSteps: 4,
    commandWord: "Explain how",
    defaultExamStem:
      "Explain how the body responds when blood glucose rises above normal. (4 marks)",
  },
  examinerLanguageV2: {
    examSayLines: [
      "In the exam, say: 'Insulin causes glucose to be converted to glycogen in the liver.'",
      "In the exam, say: 'Negative feedback returns blood glucose to the optimum.'",
    ],
    contrastPairs: [
      {
        weak: "Insulin lowers sugar",
        strong:
          "Receptors detect high blood glucose; insulin is released from the pancreas therefore glucose is stored as glycogen",
      },
      {
        weak: "The body makes less sugar",
        strong:
          "Glucagon stimulates glycogen breakdown in the liver therefore glucose is released into the blood",
      },
    ],
    summaryTakeaway:
      "Blood glucose is regulated by insulin and glucagon from the pancreas using negative feedback to maintain optimum levels.",
    modelAnswerExample:
      "Blood glucose rose after a meal. Receptors detected the change. The pancreas released insulin therefore cells took up glucose and the liver stored glycogen. Blood glucose returned towards the optimum.",
  },
  grade89Challenge: {
    promptStem:
      "Compare responses when blood glucose rises versus when it falls — evaluate the roles of insulin and glucagon. (6 marks)",
    workedExampleStem:
      "Evaluate whether negative feedback alone explains type 1 diabetes. (4 marks)",
    examPracticeStem:
      "A student says insulin and glucagon work at the same time. Evaluate this statement. (4 marks)",
    summaryStem: "Grade 8/9: Compare insulin and glucagon pathways using negative feedback.",
    topBandCriteria: ["insulin", "glucagon", "glycogen", "compare", "negative feedback", "evaluate"],
    forbidden: "Do not repeat the Core Model receptor → effector list verbatim.",
  },
};

const MITOSIS_CELL_CYCLE_TEACHING_QUALITY = {
  taxonomyKey: "mitosis-cell-cycle",
  matchPatterns: [
    /mitosis and the cell cycle/i,
    /mitosis-cell-cycle/i,
    /^mitosis$/i,
    /the cell cycle/i,
  ],
  openingSlots: {
    coreModel:
      "Interphase (DNA replication) → Prophase → Metaphase → Anaphase → Telophase → Two identical daughter cells",
    keyExamples: [
      "Growth of multicellular organisms",
      "Repair of skin after injury",
      "Asexual reproduction in some organisms",
      "Replacement of worn-out cells",
    ],
    examVocabulary: [
      "mitosis",
      "cell cycle",
      "chromosome",
      "chromatid",
      "spindle",
      "equator",
      "daughter cell",
      "interphase",
      "replication",
    ],
  },
  reasoningChains: [
    {
      id: "mitosis-stages",
      label: "Stages of mitosis",
      steps: [
        "Interphase: DNA replicates so each chromosome consists of two chromatids",
        "Prophase: chromosomes condense and become visible",
        "Metaphase: chromosomes line up at the equator of the cell",
        "Anaphase: chromatids are pulled to opposite poles by spindle fibres",
        "Telophase: nuclear membranes reform around each set",
        "Two genetically identical daughter cells are produced",
      ],
      examPrompt: "Describe what happens during mitosis. (4 marks)",
    },
    {
      id: "mitosis-purpose",
      label: "Purpose of mitosis",
      steps: [
        "Mitosis produces genetically identical daughter cells",
        "Enables growth of multicellular organisms",
        "Replaces damaged or worn-out cells",
        "Maintains chromosome number in body cells",
        "Occurs throughout the cell cycle in dividing tissues",
      ],
      examPrompt: "Explain why mitosis is important for growth and repair. (3 marks)",
    },
  ],
  examinerLanguage: {
    studentsOftenWrite: '"The cell splits in half."',
    examinersExpect:
      "DNA replication before division; chromosomes line up; chromatids separate; identical daughter cells.",
    useThePhrase:
      '"Chromosomes line up at the equator" and "genetically identical daughter cells."',
    avoidSaying:
      '"Cells just divide" without naming stages or chromosome behaviour.',
    aqaWording:
      "Use **mitosis**, **chromosome**, **chromatid**, **spindle**, **daughter cell**, **interphase**.",
    markLosingPhrase:
      '"Mitosis makes sperm and egg cells" — that confuses mitosis with meiosis.',
  },
  workedReasoning: {
    primaryChainId: "mitosis-stages",
    secondaryChainId: "mitosis-purpose",
    markingPointLabels: ["replication", "equator", "chromatid", "daughter cell", "identical"],
    minSteps: 4,
    commandWord: "Describe",
    defaultExamStem: "Describe what happens during mitosis. (4 marks)",
  },
  examinerLanguageV2: {
    examSayLines: [
      "In the exam, say: 'DNA replicates during interphase before mitosis.'",
      "In the exam, say: 'Chromatids are pulled to opposite poles during anaphase.'",
    ],
    contrastPairs: [
      {
        weak: "The cell splits in half",
        strong:
          "Chromosomes line up at the equator; chromatids separate therefore two identical daughter cells form",
      },
      {
        weak: "Mitosis makes sex cells",
        strong: "Mitosis produces genetically identical body cells for growth and repair",
      },
    ],
    summaryTakeaway:
      "Mitosis is division of the nucleus producing two genetically identical daughter cells for growth and repair.",
    modelAnswerExample:
      "DNA replicated during interphase. Chromosomes lined up at the equator. Chromatids were pulled to opposite poles. Two genetically identical daughter cells formed therefore damaged tissue could be replaced.",
  },
  grade89Challenge: {
    promptStem:
      "Compare mitosis and meiosis — evaluate why organisms need both processes. (6 marks)",
    workedExampleStem:
      "Evaluate whether all cells in the body divide at the same rate. (4 marks)",
    examPracticeStem:
      "A student confuses mitosis with meiosis. Evaluate their explanation. (4 marks)",
    summaryStem: "Grade 8/9: Compare mitosis and meiosis for growth versus gamete formation.",
    topBandCriteria: ["mitosis", "meiosis", "compare", "identical", "chromosome", "evaluate"],
    forbidden: "Do not repeat the Core Model mitosis stage list verbatim.",
  },
};

const HOW_MATERIALS_CYCLED_TEACHING_QUALITY = {
  taxonomyKey: "how-materials-cycled",
  matchPatterns: [
    /how materials are cycled/i,
    /how-materials-cycled/i,
    /carbon cycle/i,
    /carbon-cycle/i,
    /recycling carbon/i,
  ],
  openingSlots: {
    coreModel:
      "CO₂ in atmosphere → Photosynthesis (plants) → Carbon in organisms → Respiration / Decomposition / Combustion → CO₂ returned",
    keyExamples: [
      "Photosynthesis removes CO₂ from the atmosphere",
      "Respiration releases CO₂",
      "Decomposers recycle carbon from dead matter",
      "Combustion of fossil fuels returns CO₂",
    ],
    examVocabulary: [
      "carbon cycle",
      "photosynthesis",
      "respiration",
      "decomposer",
      "combustion",
      "carbon dioxide",
      "fossil fuels",
      "decay",
    ],
  },
  reasoningChains: [
    {
      id: "carbon-cycle",
      label: "Carbon cycle pathways",
      steps: [
        "Carbon dioxide is taken in by plants during photosynthesis",
        "Carbon becomes part of carbohydrates, fats, and proteins in organisms",
        "Animals obtain carbon by eating plants or other animals",
        "Carbon dioxide is released by respiration in plants and animals",
        "Decomposers break down dead organisms and release carbon dioxide",
        "Combustion of fossil fuels returns stored carbon to the atmosphere",
      ],
      examPrompt: "Explain the main processes in the carbon cycle. (4–6 marks)",
    },
    {
      id: "decomposer-role",
      label: "Role of decomposers",
      steps: [
        "Decomposers break down dead organisms and waste material",
        "Digestive enzymes release carbon compounds from organic matter",
        "Nutrients return to the soil for uptake by plants",
        "Decomposers respire and release carbon dioxide",
        "Carbon is recycled between living and non-living components",
      ],
      examPrompt: "Explain the role of decomposers in the carbon cycle. (4 marks)",
    },
  ],
  examinerLanguage: {
    studentsOftenWrite: '"Plants breathe in carbon."',
    examinersExpect:
      "Photosynthesis removes CO₂; respiration and decomposition release CO₂; decomposers named.",
    useThePhrase:
      '"Carbon dioxide is taken in during photosynthesis" and "released during respiration and decomposition."',
    avoidSaying:
      '"Carbon disappears" — carbon is recycled, not destroyed.',
    aqaWording:
      "Use **photosynthesis**, **respiration**, **decomposer**, **combustion**, **carbon dioxide**.",
    markLosingPhrase:
      '"Decomposers eat carbon" without explaining breakdown and release of carbon dioxide.',
  },
  workedReasoning: {
    primaryChainId: "decomposer-role",
    secondaryChainId: "carbon-cycle",
    markingPointLabels: ["decomposer", "respiration", "photosynthesis", "carbon dioxide", "decay"],
    minSteps: 4,
    commandWord: "Explain",
    defaultExamStem: "Explain the role of decomposers in the carbon cycle. (4 marks)",
  },
  examinerLanguageV2: {
    examSayLines: [
      "In the exam, say: 'Decomposers break down dead organisms and release carbon dioxide.'",
      "In the exam, say: 'Photosynthesis removes carbon dioxide from the atmosphere.'",
    ],
    contrastPairs: [
      {
        weak: "Plants breathe in carbon",
        strong:
          "Plants take in carbon dioxide during photosynthesis therefore carbon enters food chains",
      },
      {
        weak: "Carbon disappears when things die",
        strong:
          "Decomposers break down dead matter and respire therefore carbon dioxide returns to the atmosphere",
      },
    ],
    summaryTakeaway:
      "The carbon cycle moves carbon between the atmosphere, living organisms, and decomposers through photosynthesis, respiration, decomposition, and combustion.",
    modelAnswerExample:
      "Decomposers broke down dead organic matter. Enzymes released carbon compounds. Decomposers respired and released carbon dioxide. Therefore carbon was recycled to the atmosphere for photosynthesis.",
  },
  grade89Challenge: {
    promptStem:
      "Evaluate how human activity affects the carbon cycle through combustion of fossil fuels. (6 marks)",
    workedExampleStem:
      "Compare the rate of carbon return via decomposition versus fossil fuel combustion. (4 marks)",
    examPracticeStem:
      "A student says plants are the only part of the carbon cycle. Evaluate this statement. (4 marks)",
    summaryStem: "Grade 8/9: Compare natural and human-driven pathways in the carbon cycle.",
    topBandCriteria: ["photosynthesis", "combustion", "decomposer", "evaluate", "compare", "co2"],
    forbidden: "Do not repeat the Core Model carbon pathway list verbatim.",
  },
};

const ALL_PROFILES = [
  HOMEOSTASIS_TEACHING_QUALITY,
  NERVOUS_SYSTEM_TEACHING_QUALITY,
  THE_EYE_TEACHING_QUALITY,
  REFLEX_ARC_TEACHING_QUALITY,
  CELL_STRUCTURE_TEACHING_QUALITY,
  CONTROL_BLOOD_GLUCOSE_TEACHING_QUALITY,
  MITOSIS_CELL_CYCLE_TEACHING_QUALITY,
  HOW_MATERIALS_CYCLED_TEACHING_QUALITY,
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
  REFLEX_ARC_TEACHING_QUALITY,
  CELL_STRUCTURE_TEACHING_QUALITY,
  CONTROL_BLOOD_GLUCOSE_TEACHING_QUALITY,
  MITOSIS_CELL_CYCLE_TEACHING_QUALITY,
  HOW_MATERIALS_CYCLED_TEACHING_QUALITY,
  resolveTeachingQualityProfile,
  listTeachingQualityProfileKeys,
};
