import type { PracticeQuestionLite } from "../src/components/practice/PracticeShortQuestion";

export type BrowserQaCase = {
  id: string;
  question: PracticeQuestionLite;
  studentAnswer: string;
  minScore?: number;
  maxScore?: number;
  expectEstimatedScore: boolean;
  mustInclude: RegExp[];
  mustExclude: RegExp[];
};

export const BRAIN_DAMAGE_STUDENT_ANSWER =
  "If the cerebral cortex is damaged, a person may lose abilities such as memory, language and conscious control of thought. Damage to the cerebellum affects balance and coordination, making controlled movement difficult. If the medulla is damaged, automatic functions such as breathing and heart rate may fail, which can be life-threatening. Damage to the hypothalamus can disrupt temperature regulation, water balance and hormone control. Different regions control different essential functions, so the impact of brain damage depends on which area is affected. Overall, brain damage can seriously reduce quality of life and can be fatal if vital centres are damaged.";

export const BROWSER_QA_CASES: BrowserQaCase[] = [
  {
    id: "brain-damage-evaluation",
    question: {
      id: "qa-brain-damage",
      question: "Evaluate the impact of brain damage on the functions of specific brain regions. (6 marks)",
      type: "short",
      marks: 6,
      correctAnswer:
        "Damage to the cerebral cortex can affect higher functions such as memory, language and conscious thought. Damage to the cerebellum can impair balance and coordination of voluntary movement. Damage to the medulla can disrupt automatic control of breathing and heart rate, which may be life-threatening. Damage to the hypothalamus can affect temperature regulation, water balance and links between the nervous and endocrine systems. The impact depends on which region is damaged and how severe the damage is. Overall, damage to essential regions such as the medulla can be fatal, while damage to other areas may reduce quality of life.",
      markScheme: [
        "Names specific brain regions and their normal functions",
        "Links damage in each region to loss of function or consequences",
        "Compares severity or importance of damage to different regions",
        "Includes evaluative judgement about overall impact",
      ],
    },
    studentAnswer: BRAIN_DAMAGE_STUDENT_ANSWER,
    minScore: 5,
    maxScore: 6,
    expectEstimatedScore: true,
    mustInclude: [
      /cerebral cortex|cortex/i,
      /cerebellum/i,
      /medulla/i,
      /hypothalamus|temperature|water balance|hormone/i,
      /damage|impact|quality of life|fatal|life threatening/i,
    ],
    mustExclude: [
      /during physical activity/i,
      /oxygen\/glucose to muscles/i,
      /the medulla increases breathing rate/i,
      /the medulla increases heart rate/i,
    ],
  },
  {
    id: "medulla-physical-activity",
    question: {
      id: "qa-medulla",
      question: "Analyse the role of the medulla in maintaining homeostasis during physical activity. (4 marks)",
      type: "short",
      marks: 4,
      correctAnswer:
        "During physical activity, the medulla detects changes such as increased carbon dioxide and reduced oxygen. The medulla increases breathing rate to bring in more oxygen and remove carbon dioxide. It also increases heart rate to deliver oxygen and glucose to muscles faster. These responses maintain homeostasis during exercise.",
      markScheme: [
        "Medulla responds to changes during exercise",
        "Increases breathing rate",
        "Increases heart rate",
        "Maintains homeostasis by supplying oxygen/glucose and removing carbon dioxide",
      ],
    },
    studentAnswer:
      "During physical activity, the medulla detects changes such as increased carbon dioxide and reduced oxygen. The medulla increases breathing rate to bring in more oxygen and remove carbon dioxide. It also increases heart rate to deliver oxygen and glucose to muscles faster. These responses maintain homeostasis during exercise.",
    minScore: 4,
    maxScore: 4,
    expectEstimatedScore: true,
    mustInclude: [/medulla/i, /breathing/i, /heart rate/i, /oxygen|glucose|carbon dioxide|homeostasis/i],
    mustExclude: [/hypothalamus/i, /sweating/i, /vasodilation/i, /shivering/i, /vasoconstriction/i],
  },
  {
    id: "hypothalamus-thermoregulation",
    question: {
      id: "qa-thermo",
      question: "Explain how the hypothalamus contributes to thermoregulation in the body. (4 marks)",
      type: "short",
      marks: 4,
      correctAnswer:
        "The hypothalamus monitors the temperature of the blood flowing through the brain. If body temperature rises above the optimum level, the hypothalamus detects the change and triggers responses such as sweating and vasodilation to increase heat loss. If body temperature falls below the optimum level, the hypothalamus triggers responses such as shivering and vasoconstriction to reduce heat loss and generate heat. These responses act through negative feedback to return body temperature to its normal level.",
      markScheme: [
        "Blood vessels widen and sweating occurs to cool the body",
        "Blood vessels narrow and shivering occurs to warm the body",
      ],
    },
    studentAnswer:
      "The hypothalamus monitors the temperature of the blood flowing through the brain. If body temperature rises above the optimum level, the hypothalamus detects the change and triggers responses such as sweating and vasodilation to increase heat loss. If body temperature falls below the optimum level, the hypothalamus triggers responses such as shivering and vasoconstriction to reduce heat loss and generate heat. These responses act through negative feedback to return body temperature to its normal level.",
    minScore: 4,
    maxScore: 4,
    expectEstimatedScore: true,
    mustInclude: [
      /hypothalamus/i,
      /temperature|thermoregulation/i,
      /sweat|vasodilat/i,
      /shiver|vasoconstric/i,
      /negative feedback|homeostasis|normal/i,
    ],
    mustExclude: [/\bmedulla\b/i, /breathing rate/i, /heart rate/i],
  },
  {
    id: "reflex-withdrawal",
    question: {
      id: "qa-reflex",
      question:
        "Apply your knowledge of the reflex arc pathway to explain how a withdrawal reflex occurs when touching a hot surface. (4 marks)",
      type: "short",
      marks: 4,
      correctAnswer:
        "A receptor in the skin detects the hot stimulus. A sensory neurone carries impulses to the spinal cord. A relay neurone in the spinal cord connects to a motor neurone, which carries impulses to the effector muscle. The muscle contracts to pull the hand away quickly.",
      markScheme: [
        "Receptor detects stimulus",
        "Sensory neurone to spinal cord",
        "Relay neurone in spinal cord",
        "Motor neurone to effector produces response",
      ],
    },
    studentAnswer:
      "A receptor in the skin detects the hot stimulus. A sensory neurone carries impulses to the spinal cord. A relay neurone in the spinal cord connects to a motor neurone, which carries impulses to the effector muscle. The muscle contracts to pull the hand away quickly.",
    minScore: 4,
    maxScore: 4,
    expectEstimatedScore: true,
    mustInclude: [/receptor/i, /sensory/i, /relay|spinal cord/i, /motor/i, /effector|response|muscle/i],
    mustExclude: [/hypothalamus/i, /\bmedulla\b/i],
  },
  {
    id: "low-confidence-unknown",
    question: {
      id: "qa-vague",
      question: "Discuss the importance of biodiversity. (4 marks)",
      type: "short",
      marks: 4,
      correctAnswer: "Biodiversity matters.",
      markScheme: ["Mentions biodiversity"],
    },
    studentAnswer: "Biodiversity is important for ecosystems.",
    expectEstimatedScore: false,
    mustInclude: [/guided self-check|Check whether your answer mentions/i, /No estimated score shown/i],
    mustExclude: [/Estimated score \(guide\)/i],
  },
];
