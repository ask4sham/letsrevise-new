import { buildMcqFeedback, gradeMcq, mcqOptionLabel } from "./gradeMcq";

const OPTIONS = ["0", "1", "2", "23"];

describe("gradeMcq", () => {
  test("correct answer awards full marks", () => {
    const grade = gradeMcq(1, 1, OPTIONS, 1);
    expect(grade.status).toBe("correct");
    expect(grade.marksAwarded).toBe(1);
    expect(grade.totalMarks).toBe(1);
    expect(grade.correctLabel).toBe("B");
    expect(grade.correctOption).toBe("1");
    expect(grade.selectedLabel).toBe("B");
  });

  test("wrong answer awards zero marks and exposes correct option label", () => {
    const grade = gradeMcq(3, 1, OPTIONS, 1);
    expect(grade.status).toBe("incorrect");
    expect(grade.marksAwarded).toBe(0);
    expect(grade.totalMarks).toBe(1);
    expect(grade.selectedLabel).toBe("D");
    expect(grade.selectedOption).toBe("23");
    expect(grade.correctLabel).toBe("B");
    expect(grade.correctOption).toBe("1");
  });

  test("mcqOptionLabel returns A-D", () => {
    expect(mcqOptionLabel(0)).toBe("A");
    expect(mcqOptionLabel(3)).toBe("D");
  });
});

describe("buildMcqFeedback", () => {
  test("parses mark scheme and option explanations for wrong answers", () => {
    const grade = gradeMcq(3, 1, OPTIONS, 1);
    const feedback = buildMcqFeedback({
      grade,
      options: OPTIONS,
      markScheme: [
        "Correct answer: B — 1",
        "Why D is wrong: 23 is the total number of chromosomes in a sperm cell, not the number of X chromosomes.",
      ],
      explanation:
        "A sperm cell is haploid and contains either one X chromosome or one Y chromosome.",
    });

    expect(feedback.whyCorrect).toMatch(/haploid/i);
    expect(feedback.whySelectedWrong).toMatch(/23 is the total number of chromosomes/i);
    expect(feedback.wrongOptionExplanations.some((w) => w.label === "D")).toBe(true);
  });

  test("falls back when no distractor explanations exist", () => {
    const grade = gradeMcq(0, 1, OPTIONS, 1);
    const feedback = buildMcqFeedback({
      grade,
      options: OPTIONS,
      markScheme: ["Correct answer: B — 1"],
    });
    expect(feedback.whySelectedWrong).toMatch(/not correct|correct answer is B/i);
    expect(feedback.improvementTip).toMatch(/^Revise:/);
  });

  test("skips generic exam advice and uses topic-specific explanation for Revise", () => {
    const grade = gradeMcq(0, 1, OPTIONS, 1);
    const feedback = buildMcqFeedback({
      grade,
      options: OPTIONS,
      markScheme: ["Why A is wrong: 0 is not the number of sex chromosomes in a sperm cell."],
      explanation:
        "Strong GCSE answers name the process and link cause to effect using topic-specific terms.",
      correctAnswer: "1",
    });
    expect(feedback.improvementTip).toMatch(/Revise: 0 is not the number of sex chromosomes/i);
    expect(feedback.improvementTip).not.toMatch(/Strong GCSE answers/i);
  });

  test("uses mark scheme teaching over generic explanation when misconception is negative-only", () => {
    const options = ["Egg released immediately", "Lining breaks down due to progesterone fall"];
    const grade = gradeMcq(0, 1, options, 1);
    const feedback = buildMcqFeedback({
      grade,
      options,
      markScheme: [
        "Why A is wrong: A new egg is not released immediately after menstruation begins.",
        "Progesterone levels fall if fertilisation does not occur. This causes the uterus lining to break down and be shed during menstruation.",
      ],
      explanation:
        "Strong GCSE answers name the process and link cause to effect using topic-specific terms.",
      correctAnswer: "Lining breaks down due to progesterone fall",
    });
    expect(feedback.improvementTip).toMatch(/Progesterone levels fall/i);
    expect(feedback.improvementTip).not.toMatch(/Strong GCSE answers/i);
  });

  test("uses biology explanation for Revise when misconception is negative-only", () => {
    const options = ["Mitochondria", "Nucleus", "Ribosome", "Chloroplast"];
    const grade = gradeMcq(1, 0, options, 1);
    const feedback = buildMcqFeedback({
      grade,
      options,
      markScheme: ["Why B is wrong: Nucleus is not the site of aerobic respiration."],
      explanation: "Mitochondria release energy through aerobic respiration.",
      correctAnswer: "Mitochondria",
    });
    expect(feedback.whySelectedWrong).toMatch(/Nucleus is not the site/i);
    expect(feedback.improvementTip).toMatch(/Revise: Mitochondria release energy/i);
    expect(feedback.memoryRule).toBeUndefined();
  });

  test("uses explicit memory rule from mark scheme line", () => {
    const grade = gradeMcq(0, 1, OPTIONS, 1);
    const feedback = buildMcqFeedback({
      grade,
      options: OPTIONS,
      markScheme: ["Memory rule: Oestrogen rebuilds.\nProgesterone maintains."],
    });
    expect(feedback.memoryRule).toBe("Oestrogen rebuilds.\nProgesterone maintains.");
  });

  test("uses explicit memory rule from input field", () => {
    const grade = gradeMcq(0, 1, OPTIONS, 1);
    const feedback = buildMcqFeedback({
      grade,
      options: OPTIONS,
      memoryRule: "Fertilisation → Oviduct\nImplantation → Uterus",
    });
    expect(feedback.memoryRule).toBe("Fertilisation → Oviduct\nImplantation → Uterus");
  });

  test("derives hormone memory rule from mark scheme teaching lines", () => {
    const options = ["Egg released immediately", "Lining breaks down due to progesterone fall"];
    const grade = gradeMcq(0, 1, options, 1);
    const feedback = buildMcqFeedback({
      grade,
      options,
      markScheme: [
        "Why A is wrong: A new egg is not released immediately after menstruation begins.",
        "Oestrogen repairs and thickens the uterus lining before ovulation.",
        "After ovulation progesterone maintains the thick uterus lining.",
      ],
      explanation:
        "Strong GCSE answers name the process and link cause to effect using topic-specific terms.",
      correctAnswer: "Lining breaks down due to progesterone fall",
    });
    expect(feedback.memoryRule).toMatch(/Oestrogen rebuilds\./i);
    expect(feedback.memoryRule).toMatch(/Progesterone maintains\./i);
  });

  test("omits memory rule when no concise rule can be derived", () => {
    const grade = gradeMcq(3, 1, OPTIONS, 1);
    const feedback = buildMcqFeedback({
      grade,
      options: OPTIONS,
      markScheme: [
        "Why D is wrong: 23 is the total number of chromosomes in a sperm cell, not the number of X chromosomes.",
      ],
      explanation:
        "A sperm cell is haploid and contains either one X chromosome or one Y chromosome.",
    });
    expect(feedback.memoryRule).toBeUndefined();
  });
});
