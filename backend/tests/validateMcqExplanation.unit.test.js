/**
 * Unit tests for AI-generated MCQ rationale quality (V2.1).
 * Does not apply to manual teacher rationales (PR #82).
 */
const {
  validateMcqExplanation,
  MCQ_EXPLANATION_MAX_LENGTH,
  NEUTRAL_WHY_CORRECT,
} = require("../utils/validateMcqExplanation");

describe("validateMcqExplanation — valid golden examples", () => {
  const cases = [
    {
      name: "Biology mechanism",
      explanation:
        "Light is not essential because the seed initially uses energy stored in its food reserves. Water activates enzymes, oxygen supports aerobic respiration, and a suitable temperature allows enzyme-controlled reactions.",
      correctOption: "Light",
    },
    {
      name: "Chemistry",
      explanation:
        "Sodium loses one electron to form a positive ion with a stable outer shell, matching Group 1 behaviour.",
      correctOption: "Na⁺",
    },
    {
      name: "Physics",
      explanation:
        "Acceleration is the rate of change of velocity, so a constant speed in a straight line means zero acceleration.",
      correctOption: "Zero",
    },
    {
      name: "Mathematics calculation",
      explanation: "The area is 12 cm² because 3 × 4 = 12.",
      correctOption: "12 cm²",
    },
    {
      name: "English-language",
      explanation: "The metaphor creates a vivid image of isolation.",
      correctOption: "Metaphor",
    },
    {
      name: "Concise factual Biology",
      explanation: "Water activates enzymes.",
      correctOption: "Water",
    },
    {
      name: "Concise factual respiration",
      explanation: "Seeds respire aerobically.",
      correctOption: "Oxygen",
    },
    {
      name: "NOT question",
      explanation:
        "Light is not required for germination because the seed uses stored food reserves rather than photosynthesis at first.",
      correctOption: "Light",
    },
  ];

  for (const c of cases) {
    test(`accepts ${c.name}`, () => {
      const res = validateMcqExplanation(c.explanation, { correctOption: c.correctOption });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.explanation).toBe(c.explanation.trim());
    });
  }

  test("accepts exactly 1000 trimmed characters when otherwise valid", () => {
    const body = "Enzymes are biological catalysts that speed up reactions. ";
    let text = body;
    while (text.length < MCQ_EXPLANATION_MAX_LENGTH) text += "x";
    text = text.slice(0, MCQ_EXPLANATION_MAX_LENGTH);
    expect(text.length).toBe(1000);
    const res = validateMcqExplanation(text, { correctOption: "Enzyme" });
    expect(res.ok).toBe(true);
  });
});

describe("validateMcqExplanation — invalid cases", () => {
  const reject = (value, correctOption, expectedIssue) => {
    const res = validateMcqExplanation(value, { correctOption });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.issues).toContain(expectedIssue);
  };

  test("missing / null", () => {
    reject(undefined, "Light", "explanation_missing");
    reject(null, "Light", "explanation_missing");
  });

  test("not a string", () => {
    reject({ text: "x" }, "Light", "explanation_not_string");
    reject(["a"], "Light", "explanation_not_string");
  });

  test("empty / whitespace", () => {
    reject("", "Light", "explanation_empty");
    reject("   ", "Light", "explanation_empty");
  });

  test("over 1000", () => {
    const long = `${"Word ".repeat(250)}extra`;
    expect(long.trim().length).toBeGreaterThan(1000);
    reject(long, "Light", "explanation_too_long");
  });

  test("bare correct option", () => {
    reject("Light", "Light", "explanation_bare_option");
  });

  test("option letter / label", () => {
    reject("C", "Light", "explanation_option_letter");
    reject("Option C", "Light", "explanation_option_letter");
    reject("C — Light", "Light", "explanation_bare_option");
  });

  test("answer declaration", () => {
    reject("The answer is C.", "Light", "explanation_answer_declaration");
    // Leading "Correct answer:" is also administrative marking language.
    reject("Correct answer: Light", "Light", "explanation_administrative");
  });

  test("marking instruction", () => {
    reject("Award 1 mark for selecting Option C.", "Light", "explanation_administrative");
    reject("Award 1 mark for Light.", "Light", "explanation_administrative");
  });

  test("neutral fallback", () => {
    reject(NEUTRAL_WHY_CORRECT, "Light", "explanation_neutral_fallback");
  });

  test("generic this is correct", () => {
    reject("This is correct.", "Light", "explanation_generic");
    reject("It is the right answer.", "Light", "explanation_generic");
    reject("This is correct because it is Light.", "Light", "explanation_bare_option");
  });

  test("HTML and markdown heading", () => {
    reject("<p>Water activates enzymes in the seed.</p>", "Water", "explanation_html");
    reject("## Why\nWater activates enzymes in seeds.", "Water", "explanation_markdown_heading");
  });

  test("too short / too few words", () => {
    reject("Too brief.", "Light", "explanation_too_short");
    reject("One two.", "Light", "explanation_too_few_words");
  });
});
