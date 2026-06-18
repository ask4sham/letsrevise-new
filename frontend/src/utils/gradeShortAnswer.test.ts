import { gradeShortAnswer } from "./gradeShortAnswer";

const THERMO_QUESTION =
  "Explain how the hypothalamus contributes to thermoregulation in the body. (4 marks)";

const THERMO_STUDENT_ANSWER =
  "The hypothalamus monitors the temperature of the blood flowing through the brain. If body temperature rises above the optimum level, the hypothalamus detects the change and triggers responses such as sweating and vasodilation to increase heat loss. If body temperature falls below the optimum level, the hypothalamus triggers responses such as shivering and vasoconstriction to reduce heat loss and generate heat. These responses act through negative feedback to return body temperature to its normal level.";

const THERMO_MARK_SCHEME = [
  "Blood vessels widen and sweating occurs to cool the body",
  "Blood vessels narrow and shivering occurs to warm the body",
];

const THERMO_MODEL_ANSWER = THERMO_STUDENT_ANSWER;

const MEDULLA_QUESTION =
  "Analyse the role of the medulla in maintaining homeostasis during physical activity. (4 marks)";

const MEDULLA_STUDENT_ANSWER =
  "During physical activity, the medulla detects changes such as increased carbon dioxide and reduced oxygen. The medulla increases breathing rate to bring in more oxygen and remove carbon dioxide. It also increases heart rate to deliver oxygen and glucose to muscles faster. These responses maintain homeostasis during exercise.";

const MEDULLA_MARK_SCHEME = [
  "Medulla responds to changes during exercise",
  "Increases breathing rate",
  "Increases heart rate",
  "Maintains homeostasis by supplying oxygen/glucose and removing carbon dioxide",
];

const REFLEX_QUESTION =
  "Apply your knowledge of the reflex arc pathway to explain how a withdrawal reflex occurs when touching a hot surface. (4 marks)";

const REFLEX_STUDENT_ANSWER =
  "A receptor in the skin detects the hot stimulus. A sensory neurone carries impulses to the spinal cord. A relay neurone in the spinal cord connects to a motor neurone, which carries impulses to the effector muscle. The muscle contracts to pull the hand away quickly.";

const REFLEX_MARK_SCHEME = [
  "Receptor detects stimulus",
  "Sensory neurone to spinal cord",
  "Relay neurone in spinal cord",
  "Motor neurone to effector produces response",
];

const BRAIN_DAMAGE_QUESTION =
  "Evaluate the impact of brain damage on the functions of specific brain regions. (6 marks)";

const BRAIN_DAMAGE_MARK_SCHEME = [
  "Names specific brain regions and their normal functions",
  "Links damage in each region to loss of function or consequences",
  "Compares severity or importance of damage to different regions",
  "Includes evaluative judgement about overall impact",
];

const BRAIN_DAMAGE_MODEL_ANSWER =
  "Damage to the cerebral cortex can affect higher functions such as memory, language and conscious thought. Damage to the cerebellum can impair balance and coordination of voluntary movement. Damage to the medulla can disrupt automatic control of breathing and heart rate, which may be life-threatening. Damage to the hypothalamus can affect temperature regulation and links between the nervous and endocrine systems. The impact depends on which region is damaged and how severe the damage is. Overall, damage to essential regions such as the medulla can be fatal, while damage to other areas may reduce quality of life.";

const BRAIN_DAMAGE_STUDENT_ANSWER =
  "If the cerebral cortex is damaged, a person may lose abilities such as memory, language and conscious control of movement. Damage to the cerebellum affects balance and coordination, making controlled movement difficult. If the medulla is damaged, automatic functions such as breathing and heart rate may fail, which can be life-threatening. Damage to the hypothalamus can disrupt temperature regulation. Different regions control different essential functions, so the impact of brain damage depends on which area is affected. Overall, brain damage can seriously reduce quality of life and can be fatal if vital centres are damaged.";

function assertNoExerciseMedullaProfileLeak(text: string) {
  expect(text).not.toMatch(/medulla monitors\/responds to changes during physical activity/i);
  expect(text).not.toMatch(/the medulla increases breathing rate/i);
  expect(text).not.toMatch(/oxygen\/glucose to muscles and removing carbon dioxide/i);
}

describe("gradeShortAnswer — medulla exercise (derived mark points)", () => {
  it("scores a complete medulla answer at 4/4 without thermoregulation leakage", () => {
    const result = gradeShortAnswer({
      question: MEDULLA_QUESTION,
      userAnswer: MEDULLA_STUDENT_ANSWER,
      markScheme: MEDULLA_MARK_SCHEME,
      correctAnswer: MEDULLA_STUDENT_ANSWER,
      marks: 4,
    });

    expect(result.contract?.profile).toBe("derived");
    expect(result.showEstimatedScore).toBe(true);
    expect(result.score).toBe(4);
    expect(result.included?.length).toBe(4);
    const feedback = [...(result.included ?? []), ...(result.toImprove ?? [])].join(" ");
    expect(feedback).toMatch(/medulla/i);
    expect(feedback).toMatch(/breathing/i);
    expect(feedback).toMatch(/heart rate/i);
    expect(feedback).toMatch(/homeostasis|oxygen|glucose|carbon dioxide/i);
  });
});

describe("gradeShortAnswer — hypothalamus thermoregulation (derived mark points)", () => {
  it("scores a complete thermoregulation answer at 4/4 without exercise-medulla profile leakage", () => {
    const result = gradeShortAnswer({
      question: THERMO_QUESTION,
      userAnswer: THERMO_STUDENT_ANSWER,
      markScheme: THERMO_MARK_SCHEME,
      correctAnswer: THERMO_MODEL_ANSWER,
      marks: 4,
    });

    expect(result.contract?.profile).toBe("derived");
    expect(result.showEstimatedScore).toBe(true);
    expect(result.score).toBe(4);
    expect(result.included?.length).toBe(4);
    const feedback = [...(result.included ?? []), ...(result.toImprove ?? [])].join(" ");
    expect(feedback).toMatch(/hypothalamus|sweat|vasodilat|shiver|vasoconstric/i);
    assertNoExerciseMedullaProfileLeak(feedback);
  });

  it("scores a weak thermoregulation answer below full marks", () => {
    const result = gradeShortAnswer({
      question: THERMO_QUESTION,
      userAnswer: "The hypothalamus controls body temperature.",
      markScheme: THERMO_MARK_SCHEME,
      correctAnswer: THERMO_MODEL_ANSWER,
      marks: 4,
    });

    expect(result.showEstimatedScore).toBe(true);
    expect(result.score).toBeLessThan(4);
    expect(result.toImprove?.length).toBeGreaterThan(0);
  });
});

describe("gradeShortAnswer — reflex arc (derived mark points)", () => {
  it("scores a complete withdrawal reflex answer without profile leakage", () => {
    const result = gradeShortAnswer({
      question: REFLEX_QUESTION,
      userAnswer: REFLEX_STUDENT_ANSWER,
      markScheme: REFLEX_MARK_SCHEME,
      correctAnswer: REFLEX_STUDENT_ANSWER,
      marks: 4,
    });

    expect(result.contract?.profile).toBe("derived");
    expect(result.showEstimatedScore).toBe(true);
    expect(result.score).toBe(4);
    const feedback = [...(result.included ?? []), ...(result.toImprove ?? [])].join(" ");
    expect(feedback).toMatch(/receptor|sensory|relay|spinal cord|motor|effector/i);
    assertNoExerciseMedullaProfileLeak(feedback);
  });
});

describe("gradeShortAnswer — SS1 brain damage evaluation", () => {
  it("scores a strong multi-region evaluation at least 5/6 using question mark points", () => {
    const result = gradeShortAnswer({
      question: BRAIN_DAMAGE_QUESTION,
      userAnswer: BRAIN_DAMAGE_STUDENT_ANSWER,
      markScheme: BRAIN_DAMAGE_MARK_SCHEME,
      correctAnswer: BRAIN_DAMAGE_MODEL_ANSWER,
      marks: 6,
    });

    expect(result.contract?.profile).toBe("derived");
    expect(result.showEstimatedScore).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(5);
    expect(result.score).toBeLessThanOrEqual(6);

    const feedback = [...(result.included ?? []), ...(result.toImprove ?? [])].join(" ");
    expect(feedback).toMatch(/cerebral cortex|cortex/i);
    expect(feedback).toMatch(/cerebellum/i);
    expect(feedback).toMatch(/medulla/i);
    expect(feedback).toMatch(/hypothalamus|temperature/i);
    expect(feedback).toMatch(/damage|consequence|impact|quality of life|fatal/i);

    assertNoExerciseMedullaProfileLeak(result.included?.join(" ") ?? "");
    assertNoExerciseMedullaProfileLeak(result.toImprove?.join(" ") ?? "");
  });

  it("does not apply medulla_exercise criteria to brain damage evaluation", () => {
    const result = gradeShortAnswer({
      question: BRAIN_DAMAGE_QUESTION,
      userAnswer: BRAIN_DAMAGE_STUDENT_ANSWER,
      markScheme: BRAIN_DAMAGE_MARK_SCHEME,
      correctAnswer: BRAIN_DAMAGE_MODEL_ANSWER,
      marks: 6,
    });

    const allFeedback = [...(result.included ?? []), ...(result.toImprove ?? [])].join(" ");
    expect(allFeedback).not.toMatch(/during physical activity/i);
    expect(allFeedback).not.toMatch(/the medulla increases breathing rate/i);
    expect(allFeedback).not.toMatch(/the medulla increases heart rate/i);
  });
});

describe("gradeShortAnswer — low confidence (no numeric score)", () => {
  it("does not show estimated score when criteria cannot be derived safely", () => {
    const result = gradeShortAnswer({
      question: "Discuss the importance of biodiversity. (4 marks)",
      userAnswer: "Biodiversity is important for ecosystems.",
      markScheme: ["Mentions biodiversity"],
      correctAnswer: "Biodiversity matters.",
      marks: 4,
    });

    expect(result.confidence).toBe("low");
    expect(result.showEstimatedScore).toBe(false);
    expect(result.guidedSelfCheck?.length).toBeGreaterThan(0);
    expect(result.contract?.profile).toBe("derived");
  });
});

describe("gradeShortAnswer — sparse mark scheme", () => {
  it("derives extra criteria from model answer and shows score when confidence is medium/high", () => {
    const result = gradeShortAnswer({
      question: THERMO_QUESTION,
      userAnswer: THERMO_STUDENT_ANSWER,
      markScheme: THERMO_MARK_SCHEME,
      correctAnswer: THERMO_MODEL_ANSWER,
      marks: 4,
    });

    expect(THERMO_MARK_SCHEME).toHaveLength(2);
    expect(result.showEstimatedScore).toBe(true);
    expect(result.score).toBe(4);
    expect(result.included?.length).toBe(4);
  });
});

describe("gradeShortAnswer — general", () => {
  it("does not over-mark a weak answer when mark scheme has multiple lines", () => {
    const result = gradeShortAnswer({
      userAnswer: "nucleus",
      markScheme: ["Mentions nucleus", "DNA stored in nucleus"],
      correctAnswer: "The nucleus contains DNA in eukaryotic cells.",
      marks: 4,
    });

    expect(result.score).toBeLessThan(4);
  });

  it("rewards answers that match multiple mark points when model answer is clear", () => {
    const result = gradeShortAnswer({
      userAnswer: "The nucleus contains DNA",
      markScheme: ["Mentions nucleus", "DNA stored in nucleus"],
      correctAnswer: "The nucleus contains DNA in eukaryotic cells.",
      marks: 4,
    });

    expect(result.showEstimatedScore).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(2);
    expect(result.included?.length).toBeGreaterThan(0);
  });
});
