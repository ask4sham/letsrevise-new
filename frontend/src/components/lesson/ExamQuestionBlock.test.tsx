import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ExamQuestionBlock } from "./ExamQuestionBlock";
import type { ExamQuestion } from "../../api/examQuestions";

jest.mock("./ZoomableImageLightbox", () => ({
  ZoomableImageTrigger: ({
    alt,
    src,
    imageClassName,
  }: {
    alt: string;
    src: string;
    imageClassName?: string;
  }) => <img alt={alt} src={src} className={imageClassName} data-testid="zoomable-image" />,
}));

const MCQ_QUESTION: ExamQuestion = {
  _id: "exam-mcq-1",
  question: "Which organelle releases energy?",
  type: "mcq",
  options: ["Nucleus", "Mitochondria", "Ribosome"],
  correctIndex: 1,
  marks: 1,
  markScheme: [
    "Correct answer: B — Mitochondria",
    "Why A is wrong: The nucleus controls the cell, it does not release energy.",
    "Memory rule: Mitochondria are the powerhouse of the cell.",
  ],
  metadata: {
    modelAnswer: "Mitochondria release energy through aerobic respiration.",
  },
};

const SHORT_QUESTION: ExamQuestion = {
  _id: "exam-short-1",
  question: "Describe what happens during mitosis.",
  type: "short",
  marks: 4,
  markScheme: [
    "DNA replicates before mitosis",
    "Chromosomes line up at the equator",
    "Chromosomes are pulled to opposite poles",
    "Two genetically identical daughter cells are formed",
  ],
  metadata: {
    modelAnswer:
      "DNA replicates, chromosomes line up, are pulled apart, and two identical cells form.",
  },
};

const COMPOSITE_QUESTION: ExamQuestion = {
  _id: "exam-composite-1",
  questionMode: "composite",
  type: "composite",
  question: "Read the information about cell division.",
  sharedStem: "Read the information about cell division.",
  totalMarks: 3,
  parts: [
    {
      label: "a",
      type: "mcq",
      marks: 1,
      questionText: "Which phase comes first?",
      options: ["Prophase", "Metaphase"],
      correctIndex: 0,
      markScheme: ["Correct answer: A — Prophase"],
    },
    {
      label: "b",
      type: "short",
      marks: 2,
      questionText: "Name one change in prophase.",
      markScheme: ["Chromosomes condense", "Nuclear envelope breaks down"],
    },
  ],
};

describe("ExamQuestionBlock single question marking", () => {
  test("single MCQ marks correct answer 1/1 with shared feedback panel", () => {
    render(<ExamQuestionBlock question={MCQ_QUESTION} mode="student" />);
    fireEvent.click(screen.getByRole("button", { name: "Mitochondria" }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    expect(screen.getByTestId("answer-feedback-hero")).toHaveTextContent(/Correct/i);
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/1 \/ 1 marks/i);
    expect(screen.getByTestId("answer-feedback-panel")).toHaveAttribute("data-status", "correct");
  });

  test("single MCQ marks wrong answer 0/1 with green/red styling", () => {
    render(<ExamQuestionBlock question={MCQ_QUESTION} mode="student" />);
    fireEvent.click(screen.getByRole("button", { name: "Nucleus" }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    expect(screen.getByTestId("answer-feedback-hero")).toHaveTextContent(/Incorrect/i);
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/0 \/ 1 marks/i);
    expect(screen.getByTestId("answer-feedback-correct-answer")).toBeInTheDocument();
    expect(screen.getByText(/why your answer is wrong/i)).toBeInTheDocument();
  });

  test("single short answer awards partial marks and shows missing points", () => {
    render(<ExamQuestionBlock question={SHORT_QUESTION} mode="student" />);
    fireEvent.change(screen.getByPlaceholderText(/write your answer here/i), {
      target: { value: "DNA replicates before mitosis" },
    });
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    expect(screen.getByTestId("answer-feedback-hero")).toHaveTextContent(/Partially correct/i);
    expect(screen.getByTestId("answer-feedback-panel")).toHaveAttribute("data-status", "partial");
    expect(screen.getByText(/Mark scheme points matched/i)).toBeInTheDocument();
    expect(screen.getByText(/Still needed for full marks/i)).toBeInTheDocument();
    expect(screen.getByTestId("answer-feedback-tip")).toHaveTextContent(/Revise:/i);
  });

  test("student reveal is disabled until single short answer is checked", () => {
    render(<ExamQuestionBlock question={SHORT_QUESTION} mode="student" />);
    const revealBtn = screen.getByTestId("exam-question-reveal-btn");
    expect(revealBtn).toBeDisabled();
    expect(revealBtn).toHaveAttribute("title", "Check your answer first.");

    fireEvent.change(screen.getByPlaceholderText(/write your answer here/i), {
      target: { value: "DNA replicates" },
    });
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(revealBtn).not.toBeDisabled();

    fireEvent.click(revealBtn);
    const revealPanel = document.querySelector(".exam-question-block__reveal");
    expect(revealPanel).toHaveTextContent(/DNA replicates before mitosis/i);
    expect(revealPanel).toHaveTextContent(/two identical cells form/i);
  });

  test("student reveal is disabled until single MCQ is checked", () => {
    render(<ExamQuestionBlock question={MCQ_QUESTION} mode="student" />);
    const revealBtn = screen.getByTestId("exam-question-reveal-btn");
    expect(revealBtn).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /^Mitochondria$/i }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(revealBtn).not.toBeDisabled();

    fireEvent.click(revealBtn);
    expect(screen.getByText(/Correct answer: B — Mitochondria/i)).toBeInTheDocument();
  });

  test("editor preview does not show Check answer for MCQ", () => {
    render(<ExamQuestionBlock question={MCQ_QUESTION} mode="editor" />);
    expect(screen.queryByRole("button", { name: /check answer/i })).not.toBeInTheDocument();
  });

  test("editor preview keeps reveal enabled without checking", () => {
    render(<ExamQuestionBlock question={SHORT_QUESTION} mode="editor" />);
    const revealBtn = screen.getByTestId("exam-question-reveal-btn");
    expect(revealBtn).not.toBeDisabled();
    fireEvent.click(revealBtn);
    expect(document.querySelector(".exam-question-block__reveal")).toBeInTheDocument();
  });
});

describe("ExamQuestionBlock composite question marking", () => {
  test("part (a) MCQ marks correctly with per-part feedback", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="student" />);
    fireEvent.click(screen.getByRole("radio", { name: /Prophase/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /check answer/i })[0]);

    expect(screen.getByTestId("exam-composite-part-marking-0")).toBeInTheDocument();
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/1 \/ 1 marks/i);
    expect(screen.getByTestId("exam-composite-total-score")).toHaveTextContent(/1 \/ 3 marks/i);
  });

  test("legacy composite MCQ without rationale shows neutral whyCorrect, not bare option", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="student" />);
    fireEvent.click(screen.getByRole("radio", { name: /Prophase/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /check answer/i })[0]);

    expect(screen.getByTestId("answer-feedback-panel")).toHaveAttribute("data-status", "correct");
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/1 \/ 1 marks/i);
    const why = screen.getByTestId("answer-feedback-why-correct");
    expect(why).toHaveTextContent(/Why this is correct/i);
    expect(why).toHaveTextContent(/The selected response matches the correct answer/i);
    expect(why).not.toHaveTextContent(/^Why this is correct\s*Prophase\s*$/i);
    // Short-answer part remains unanswered and independently checkable.
    expect(screen.getByRole("textbox", { name: /your answer/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /check answer/i }).length).toBeGreaterThan(0);
  });

  test("composite MCQ with partData explanation shows full rationale", () => {
    const withRationale: ExamQuestion = {
      ...COMPOSITE_QUESTION,
      _id: "exam-composite-rationale",
      parts: [
        {
          label: "a",
          type: "mcq",
          marks: 1,
          questionText: "Which factor is NOT essential for seed germination?",
          options: ["Water", "Oxygen", "Suitable temperature", "Light"],
          correctIndex: 3,
          markScheme: ["Award 1 mark for selecting Light."],
          partData: {
            explanation:
              "Light is not essential because the seed initially uses stored food reserves. Germination requires water, oxygen and a suitable temperature.",
          },
        },
        COMPOSITE_QUESTION.parts![1],
      ],
    };
    render(<ExamQuestionBlock question={withRationale} mode="student" />);
    fireEvent.click(screen.getByRole("radio", { name: /^Light$/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /check answer/i })[0]);

    expect(screen.getByTestId("answer-feedback-panel")).toHaveAttribute("data-status", "correct");
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/1 \/ 1 marks/i);
    const why = screen.getByTestId("answer-feedback-why-correct");
    expect(why).toHaveTextContent(/stored food reserves/i);
    expect(why).not.toHaveTextContent(/^Why this is correct\s*Light\s*$/i);
  });

  test("part (b) written answer marks partially with feedback", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="student" />);
    fireEvent.change(screen.getByRole("textbox", { name: /your answer/i }), {
      target: { value: "Chromosomes condense" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /check answer/i })[1]);

    expect(screen.getByTestId("exam-composite-part-marking-1")).toBeInTheDocument();
    expect(screen.getByTestId("answer-feedback-panel")).toHaveAttribute("data-status", "partial");
    expect(screen.getByText(/Still needed for full marks/i)).toBeInTheDocument();
  });

  test("total score updates when multiple parts are checked", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="student" />);
    fireEvent.click(screen.getByRole("radio", { name: /Prophase/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /your answer/i }), {
      target: { value: "Chromosomes condense" },
    });
    fireEvent.click(screen.getByTestId("exam-composite-check-all-btn"));

    const summary = screen.getByTestId("exam-composite-result-summary");
    expect(summary).toHaveTextContent(/📝 Exam question result/i);
    expect(screen.getByTestId("exam-composite-overall-score")).toHaveTextContent(/2 \/ 3 marks/i);
    expect(summary).toHaveTextContent(/Strengths/i);
    expect(summary).toHaveTextContent(/Focus your revision/i);
    expect(summary).toHaveTextContent(/Chromosomes condense/i);
    expect(summary).toHaveTextContent(/Nuclear envelope breaks down/i);
  });

  test("student reveal stays disabled until all composite parts are checked", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="student" />);
    const revealBtn = screen.getByTestId("exam-composite-reveal-btn");
    expect(revealBtn).toBeDisabled();
    expect(revealBtn).toHaveAttribute("title", "Check your answer first.");

    fireEvent.click(screen.getByRole("radio", { name: /Prophase/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /check answer/i })[0]);
    expect(revealBtn).toBeDisabled();
    expect(document.querySelector(".exam-composite__reveal")).not.toBeInTheDocument();

    // Filled-in answers alone must not unlock reveal — gate is checked, not merely answered.
    fireEvent.change(screen.getByRole("textbox", { name: /your answer/i }), {
      target: { value: "Chromosomes condense" },
    });
    expect(revealBtn).toBeDisabled();
    expect(document.querySelector(".exam-composite__reveal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("exam-composite-check-all-btn"));
    expect(revealBtn).not.toBeDisabled();

    fireEvent.click(revealBtn);
    expect(document.querySelector(".exam-composite__reveal")).toHaveTextContent(/Correct answer:/i);
    expect(document.querySelector(".exam-composite__reveal")).toHaveTextContent(/Chromosomes condense/i);
  });

  test("editor preview has no composite marking controls", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="editor" />);
    expect(screen.queryByRole("button", { name: /check answer/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("exam-composite-total-score")).not.toBeInTheDocument();
    expect(screen.queryByTestId("exam-composite-result-summary")).not.toBeInTheDocument();
  });

  test("editor composite reveal stays enabled without checking", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="editor" />);
    const revealBtn = screen.getByTestId("exam-composite-reveal-btn");
    expect(revealBtn).not.toBeDisabled();
    fireEvent.click(revealBtn);
    expect(document.querySelector(".exam-composite__reveal")).toBeInTheDocument();
  });

  test("classroom mode has no composite marking controls and reveal stays enabled", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="classroom" />);
    expect(screen.queryByRole("button", { name: /check answer/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("exam-composite-result-summary")).not.toBeInTheDocument();
    const revealBtn = screen.getByTestId("exam-composite-reveal-btn");
    expect(revealBtn).not.toBeDisabled();
  });

  test("standard composite without stimulusTable is unchanged", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="student" />);
    expect(screen.queryByTestId("exam-composite-stimulus-table")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Prophase/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /your answer/i })).toBeInTheDocument();
  });
});

describe("ExamQuestionBlock data-table stimulus", () => {
  const DATA_TABLE_QUESTION: ExamQuestion = {
    ...COMPOSITE_QUESTION,
    parts: [
      {
        label: "a",
        type: "short",
        marks: 1,
        questionText: "State the temperature with the highest rate.",
        markScheme: ["Award 1 mark for 40 °C."],
      },
      {
        label: "b",
        type: "short",
        marks: 2,
        questionText: "Describe the trend shown by the rate results.",
        markScheme: [
          "Award 1 mark for rate increases to 40 °C.",
          "Award 1 mark for rate decreases after 40 °C.",
        ],
      },
    ],
    metadata: {
      questionStyle: "data_table",
      stimulusTable: {
        title: "Effect of temperature on enzyme activity",
        columns: [
          { heading: "Temperature", unit: "°C" },
          { heading: "Rate", unit: "s⁻¹" },
        ],
        rows: [
          ["20", "0.013"],
          ["30", "0.022"],
          ["40", "0.040"],
        ],
      },
    },
  };

  test("composite with metadata.stimulusTable renders read-only table under stem before parts", () => {
    const { container } = render(
      <ExamQuestionBlock question={DATA_TABLE_QUESTION} mode="student" />
    );
    const stem = container.querySelector(".exam-composite__stem");
    const table = screen.getByTestId("exam-composite-stimulus-table");
    const partA = screen.getByText(/State the temperature with the highest rate/i);
    expect(stem).toBeTruthy();
    expect(table).toHaveTextContent("Effect of temperature on enzyme activity");
    expect(table).toHaveTextContent("Temperature");
    expect(table).toHaveTextContent("0.040");
    expect(stem!.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(table.compareDocumentPosition(partA) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(table.querySelectorAll("input").length).toBe(0);
    expect(screen.queryByTestId("exam-composite-table-0")).not.toBeInTheDocument();
    expect(screen.getByText(/Describe the trend shown by the rate results/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Exam question/i })).toBeInTheDocument();
  });

  test("known published reproduction data-table question renders Frog/Bacteria/Daisy rows", () => {
    render(
      <ExamQuestionBlock
        question={{
          _id: "6a53b05488cdc36953051df6",
          questionMode: "composite",
          type: "composite",
          title: "Differences Between Sexual and Asexual Reproduction",
          sharedStem:
            "The table below shows the average time taken for different organisms to reproduce sexually and asexually under controlled conditions.",
          question:
            "The table below shows the average time taken for different organisms to reproduce sexually and asexually under controlled conditions.",
          totalMarks: 5,
          parts: [
            {
              label: "a",
              type: "short",
              marks: 2,
              questionText: "Compare the average reproduction times for frogs and daisies.",
              markScheme: ["Award 1 mark for stating that frogs take longer than daisies."],
            },
            {
              label: "b",
              type: "short",
              marks: 2,
              questionText:
                "Calculate the difference in asexual reproduction time between frogs and daisies.",
              markScheme: ["Award 1 mark for stating the difference is 5 days."],
            },
            {
              label: "c",
              type: "short",
              marks: 1,
              questionText:
                "Explain the trend observed in the reproduction times for sexual and asexual reproduction.",
              markScheme: [
                "Award 1 mark for explaining that asexual reproduction is generally faster.",
              ],
            },
          ],
          metadata: {
            questionStyle: "data_table",
            stimulusTable: {
              title: "Reproduction Time Data",
              columns: [
                { heading: "Organism", unit: "" },
                { heading: "Sexual Reproduction Time", unit: "days" },
                { heading: "Asexual Reproduction Time", unit: "days" },
              ],
              rows: [
                ["Frog", "30", "15"],
                ["Bacteria", "N/A", "1"],
                ["Daisy", "20", "10"],
              ],
            },
          },
        }}
        mode="editor"
      />
    );
    const table = screen.getByTestId("exam-composite-stimulus-table");
    expect(table).toHaveTextContent("Reproduction Time Data");
    expect(table).toHaveTextContent("Frog");
    expect(table).toHaveTextContent("Bacteria");
    expect(table).toHaveTextContent("Daisy");
    expect(table.querySelectorAll("input").length).toBe(0);
    expect(screen.getByText(/Compare the average reproduction times/i)).toBeInTheDocument();
    expect(screen.getByTestId("exam-composite-reveal-btn")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Exam question/i })).toBeInTheDocument();
    expect(screen.queryByText(/COMPOSITE QUESTION/i)).not.toBeInTheDocument();
  });

  test("invalid or missing stimulusTable does not render a table", () => {
    render(
      <ExamQuestionBlock
        question={{
          ...COMPOSITE_QUESTION,
          metadata: { questionStyle: "data_table", stimulusTable: { columns: [], rows: [] } },
        }}
        mode="student"
      />
    );
    expect(screen.queryByTestId("exam-composite-stimulus-table")).not.toBeInTheDocument();
  });
});

describe("ExamQuestionBlock data-table stimulus", () => {
  test("composite with metadata.stimulusTable renders read-only table and short parts", () => {
    render(
      <ExamQuestionBlock
        question={{
          ...COMPOSITE_QUESTION,
          parts: [
            {
              label: "a",
              type: "short",
              marks: 1,
              questionText: "State the temperature with the highest rate.",
              markScheme: ["Award 1 mark for 40 °C."],
            },
            {
              label: "b",
              type: "short",
              marks: 2,
              questionText: "Describe the trend shown by the rate results.",
              markScheme: [
                "Award 1 mark for rate increases to 40 °C.",
                "Award 1 mark for rate decreases after 40 °C.",
              ],
            },
          ],
          metadata: {
            questionStyle: "data_table",
            stimulusTable: {
              title: "Effect of temperature on enzyme activity",
              columns: [
                { heading: "Temperature", unit: "°C" },
                { heading: "Rate", unit: "s⁻¹" },
              ],
              rows: [
                ["20", "0.013"],
                ["30", "0.022"],
                ["40", "0.040"],
              ],
            },
          },
        }}
        mode="student"
      />
    );
    expect(screen.getByTestId("exam-composite-stimulus-table")).toHaveTextContent("Temperature");
    expect(screen.getByTestId("exam-composite-stimulus-table")).toHaveTextContent("0.040");
    expect(screen.queryByTestId("exam-composite-table-0")).not.toBeInTheDocument();
    expect(screen.getByText(/State the temperature with the highest rate/i)).toBeInTheDocument();
  });
});

describe("ExamQuestionBlock inline exam images", () => {
  const DISPLAY_URL = "https://cdn.example.com/exam-questions/fetus-in-uterus.display.png";
  const ORIGINAL_URL = "https://cdn.example.com/exam-questions/fetus-in-uterus.png";

  test("single exam question uses original .png inline when stored URL is .display.png", () => {
    render(
      <ExamQuestionBlock
        question={{ ...SHORT_QUESTION, imageUrl: DISPLAY_URL }}
        mode="student"
      />
    );
    const img = screen.getByTestId("zoomable-image");
    expect(img).toHaveAttribute("src", ORIGINAL_URL);
    expect(img.getAttribute("src")).not.toContain(".display.png");
  });

  test("single exam question leaves non-display image URL unchanged", () => {
    render(
      <ExamQuestionBlock
        question={{ ...SHORT_QUESTION, imageUrl: ORIGINAL_URL }}
        mode="student"
      />
    );
    expect(screen.getByTestId("zoomable-image")).toHaveAttribute("src", ORIGINAL_URL);
  });

  test("composite exam question uses original .png inline when stored URL is .display.png", () => {
    render(
      <ExamQuestionBlock
        question={{ ...COMPOSITE_QUESTION, imageUrl: DISPLAY_URL }}
        mode="student"
      />
    );
    const img = screen.getByTestId("zoomable-image");
    expect(img).toHaveAttribute("src", ORIGINAL_URL);
    expect(img).toHaveClass("exam-composite__image");
  });
});
