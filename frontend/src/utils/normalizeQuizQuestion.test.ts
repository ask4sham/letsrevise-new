import { normalizeQuizQuestion } from "./normalizeQuizQuestion";

describe("normalizeQuizQuestion", () => {
  it("outputs MCQ with options from string[]", () => {
    const raw = {
      id: "q1",
      type: "mcq",
      question: "What is a eukaryotic cell?",
      options: ["A cell without a nucleus", "A cell with a nucleus", "A bacterial cell"],
      correctAnswer: "A cell with a nucleus",
    };
    const out = normalizeQuizQuestion(raw, 0);
    expect(out.type).toBe("mcq");
    if (out.type === "mcq") {
      expect(out.options).toEqual(["A cell without a nucleus", "A cell with a nucleus", "A bacterial cell"]);
    }
    expect(out.question).toBe("What is a eukaryotic cell?");
    expect(out.correctAnswer).toBe("A cell with a nucleus");
  });

  it("outputs MCQ with options from { text: string }[]", () => {
    const raw = {
      id: "q2",
      type: "mcq",
      question: "Which is correct?",
      options: [{ text: "Option A" }, { text: "Option B" }],
      correctAnswer: "Option B",
    };
    const out = normalizeQuizQuestion(raw, 1);
    expect(out.type).toBe("mcq");
    if (out.type === "mcq") expect(out.options).toEqual(["Option A", "Option B"]);
  });

  it("outputs MCQ with options from { value: string }[]", () => {
    const raw = {
      type: "mcq",
      question: "Pick one",
      options: [{ value: "One" }, { value: "Two" }],
      correctAnswer: "One",
    };
    const out = normalizeQuizQuestion(raw, 2);
    expect(out.type).toBe("mcq");
    if (out.type === "mcq") expect(out.options).toEqual(["One", "Two"]);
  });

  it("outputs MCQ with options from [{ label: 'A', text: '...' }]", () => {
    const raw = {
      question: "Choose",
      options: [{ label: "A", text: "First" }, { label: "B", text: "Second" }],
      correctAnswer: "First",
    };
    const out = normalizeQuizQuestion(raw, 3);
    expect(out.type).toBe("mcq");
    if (out.type === "mcq") expect(out.options).toEqual(["First", "Second"]);
  });

  it("outputs MCQ with options from object map { A: '...', B: '...' }", () => {
    const raw = {
      id: "q4",
      type: "mcq",
      question: "Which?",
      options: { A: "Alpha", B: "Beta", C: "Gamma" },
      correctAnswer: "Beta",
    };
    const out = normalizeQuizQuestion(raw, 4);
    expect(out.type).toBe("mcq");
    if (out.type === "mcq") expect(out.options).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("outputs MCQ from choices array", () => {
    const raw = {
      type: "mcq",
      question: "Q?",
      choices: ["X", "Y", "Z"],
      correctAnswer: "Y",
    };
    const out = normalizeQuizQuestion(raw, 5);
    expect(out.type).toBe("mcq");
    if (out.type === "mcq") expect(out.options).toEqual(["X", "Y", "Z"]);
  });

  it("outputs MCQ from option1..option4", () => {
    const raw = {
      type: "mcq",
      question: "Select",
      option1: "First",
      option2: "Second",
      option3: "Third",
      option4: "Fourth",
      correctAnswer: "Third",
    };
    const out = normalizeQuizQuestion(raw, 6);
    expect(out.type).toBe("mcq");
    if (out.type === "mcq") expect(out.options).toEqual(["First", "Second", "Third", "Fourth"]);
  });

  it("downgrades to short when backend says mcq but no options", () => {
    const raw = {
      type: "mcq",
      question: "No options provided",
      options: [],
      correctAnswer: "N/A",
    };
    const out = normalizeQuizQuestion(raw, 7);
    expect(out.type).toBe("short");
    expect((out as any).options).toBeUndefined();
  });

  it("outputs short for explicit short type", () => {
    const raw = {
      id: "s1",
      type: "short",
      question: "Explain.",
      correctAnswer: "Some explanation",
    };
    const out = normalizeQuizQuestion(raw, 8);
    expect(out.type).toBe("short");
    expect(out.question).toBe("Explain.");
  });

  it("infers short when options length < 2 and no explicit mcq", () => {
    const raw = {
      question: "One option only",
      options: ["Only"],
      correctAnswer: "Only",
    };
    const out = normalizeQuizQuestion(raw, 9);
    expect(out.type).toBe("short");
  });
});
