import { deriveLessonRetrieval } from "./deriveLessonRetrieval";

describe("deriveLessonRetrieval", () => {
  it("builds quiz from checkpoints and flashcards from keywords", () => {
    const result = deriveLessonRetrieval([
      {
        blocks: [
          {
            type: "checkpoint",
            prompt: "What is a limiting factor?",
            options: ["A", "B", "C", "D"],
            correctAnswer: "B",
          },
          {
            type: "keywords",
            content: "<p><strong>Limiting factor</strong> – Factor in shortest supply</p>",
          },
        ],
      },
    ]);

    expect(result.quizQuestions).toHaveLength(1);
    expect(result.quizQuestions[0].correctAnswer).toBe("B");
    expect(result.flashcards.some((c) => c.front === "Limiting factor")).toBe(true);
  });

  it("parses exam practice from text blocks with examPractice role", () => {
    const result = deriveLessonRetrieval([
      {
        blocks: [
          {
            type: "text",
            role: "examPractice",
            content:
              "<p>Q1 (4 marks) Explain how light intensity affects the rate of photosynthesis.</p><p>Reveal Model Answer: Rate increases then plateaus when another factor limits.</p>",
          },
        ],
      },
    ]);

    expect(result.examQuestions.length).toBeGreaterThanOrEqual(1);
    expect(result.examQuestions[0].marks).toBe(4);
    expect(result.examQuestions[0].modelAnswer).toMatch(/plateaus/i);
  });

  it("caps output at 5 quiz, 5 flashcards, 2 exam questions", () => {
    const blocks = Array.from({ length: 8 }, (_, i) => ({
      type: "checkpoint",
      prompt: `Q${i}`,
      options: ["A", "B"],
      correctAnswer: "A",
    }));
    const result = deriveLessonRetrieval([{ blocks }]);
    expect(result.quizQuestions).toHaveLength(5);
  });
});
