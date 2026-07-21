import React from "react";
import { render, screen } from "@testing-library/react";
import { LessonStudentBlockRenderer } from "./LessonStudentBlockRenderer";
import { TEACHER_BRAIN_DESIGN_BRIEF_MARKER } from "../../../utils/teacherBrainDesignBrief";

jest.mock("../InlineSelfCheckBlock", () => ({
  InlineSelfCheckBlock: ({
    hideHeadingLabel,
    prompt,
  }: {
    hideHeadingLabel?: boolean;
    prompt?: string;
  }) => (
    <div
      data-testid="self-check"
      data-hide-heading={hideHeadingLabel ? "1" : "0"}
      data-prompt={prompt ?? ""}
    />
  ),
}));

jest.mock("../LessonCheckpoint", () => ({
  LessonCheckpoint: ({ prompt }: { prompt?: string }) => (
    <div data-testid="lesson-checkpoint" data-prompt={prompt ?? ""} />
  ),
}));

jest.mock("../DragDropMatchBlock", () => ({
  DragDropMatchBlock: ({
    block,
    hideTitle,
  }: {
    block: { matchMode?: string };
    hideTitle?: boolean;
  }) => (
    <div
      data-testid="drag-drop-match"
      data-match-mode={block.matchMode ?? ""}
      data-hide-title={hideTitle ? "1" : "0"}
    />
  ),
}));

jest.mock("../InteractiveSequenceBlock", () => ({
  InteractiveSequenceBlock: ({ hideBlockTitle }: { hideBlockTitle?: boolean }) => (
    <div data-testid="interactive-sequence" data-hide-title={hideBlockTitle ? "1" : "0"} />
  ),
}));

jest.mock("../InteractiveDiagramBlock", () => ({
  InteractiveDiagramBlock: () => <div data-testid="interactive-diagram" />,
}));

jest.mock("../GraphBlock", () => ({
  GraphBlock: () => <div data-testid="graph-block" />,
}));

jest.mock("./studentLessonBlocks", () => ({
  StudentExplanationBlock: () => <div data-testid="explanation" />,
  StudentExamTechniqueBlock: () => <div data-testid="exam-technique" />,
  StudentExamTipBlock: () => <div data-testid="exam-tip" />,
  StudentSynopticLinkBlock: () => <div data-testid="synoptic" />,
  StudentWhyThisMattersBlock: () => <div data-testid="why" />,
  StudentHookBlock: () => <div data-testid="hook" />,
  StudentKeyIdeaBlock: () => <div data-testid="key-idea" />,
  StudentKeyWordsBlock: () => <div data-testid="keywords" />,
  StudentMisconceptionBlock: () => <div data-testid="misconception" />,
  StudentSynthesisBlock: () => <div data-testid="synthesis" />,
  StudentWorkedExampleBlock: () => <div data-testid="worked-example" />,
}));

jest.mock("../../revision/QuizView", () => ({
  QuizView: (props) => (
    <div data-testid="quiz-view" data-count={(props.questions || []).length}>
      {(props.questions && props.questions[0] && props.questions[0].question) || ""}
    </div>
  ),
}));

const baseProps = {
  blockIndex: 0,
  markdownComponents: {},
  stripVideoMarkdown: (s: string) => s,
  maybeParseKeywordsFromText: () => null,
  renderDiagramBlock: () => null,
};

describe("LessonStudentBlockRenderer", () => {
  it("renders checkpoint blocks inline", () => {
    render(
      <LessonStudentBlockRenderer
        {...baseProps}
        block={{
          type: "checkpoint",
          prompt: "Pick one",
          options: ["A", "B"],
          correctAnswer: "A",
        }}
      />
    );
    expect(screen.getByTestId("lesson-checkpoint")).toBeInTheDocument();
  });

  it("renders multi-question checkpoint with pager (no Question 1/1)", () => {
    render(
      <LessonStudentBlockRenderer
        {...baseProps}
        block={{
          type: "checkpoint",
          prompt: "Legacy",
          options: ["A", "B"],
          correctAnswer: "A",
          questions: [
            {
              prompt: "CP Q1?",
              questionType: "mcq",
              options: ["A", "B", "C", "D"],
              correctAnswer: "A",
            },
            {
              prompt: "CP Q2?",
              questionType: "mcq",
              options: ["A", "B", "C", "D"],
              correctAnswer: "B",
            },
            {
              prompt: "CP Q3?",
              questionType: "mcq",
              options: ["A", "B", "C", "D"],
              correctAnswer: "C",
            },
          ],
        }}
      />
    );
    expect(screen.getByTestId("activity-question-pager")).toHaveTextContent("Question 1/3");
    expect(screen.getByTestId("lesson-checkpoint")).toHaveAttribute("data-prompt", "CP Q1?");
  });

  it("renders multi-question self-check with pager", () => {
    render(
      <LessonStudentBlockRenderer
        {...baseProps}
        block={{
          type: "selfCheck",
          prompt: "Legacy SC",
          questionType: "short",
          correctAnswer: "x",
          questions: [
            { prompt: "SC1?", questionType: "short", correctAnswer: "a" },
            { prompt: "SC2?", questionType: "short", correctAnswer: "b" },
            { prompt: "SC3?", questionType: "short", correctAnswer: "c" },
          ],
        }}
      />
    );
    expect(screen.getByTestId("activity-question-pager")).toHaveTextContent("Question 1/3");
    expect(screen.getByTestId("self-check")).toHaveAttribute("data-prompt", "SC1?");
  });

  it("legacy one-question self-check still renders without pager", () => {
    render(
      <LessonStudentBlockRenderer
        {...baseProps}
        block={{
          type: "selfCheck",
          prompt: "Only one self-check?",
          questionType: "short",
          correctAnswer: "yes",
        }}
      />
    );
    expect(screen.getByTestId("self-check")).toHaveAttribute(
      "data-prompt",
      "Only one self-check?"
    );
    expect(screen.queryByTestId("activity-question-pager")).not.toBeInTheDocument();
  });

  it("does not surface Teacher Brain design brief note in student view", () => {
    const { container } = render(
      <LessonStudentBlockRenderer
        {...baseProps}
        block={{
          type: "dragDropMatch",
          title: "Drag and Drop",
          instructions: "Match each label.",
          note: `${TEACHER_BRAIN_DESIGN_BRIEF_MARKER}\n\nDRAG & DROP BRIEF\n\nTitle:\nMetabolism`,
          pairs: [{ id: "p1", prompt: "ATP", answer: "Energy currency" }],
        }}
      />
    );
    expect(screen.getByTestId("drag-drop-match")).toBeInTheDocument();
    expect(screen.queryByText(/Teacher Brain Design Brief/i)).not.toBeInTheDocument();
    expect(String(container.textContent ?? "")).not.toMatch(/TEACHER BRAIN DESIGN BRIEF/);
    expect(String(container.textContent ?? "")).not.toMatch(/DRAG & DROP BRIEF/);
  });

  it("passes text-to-image matchMode from dragDropLayout after reload", () => {
    render(
      <LessonStudentBlockRenderer
        {...baseProps}
        block={{
          type: "dragDropMatch",
          dragDropLayout: "textToImage",
          pairs: [
            {
              id: "p1",
              prompt: "Aerobic respiration",
              answer: "Mitochondria",
              imageUrl: "https://example.com/mito.png",
            },
          ],
        }}
      />
    );
    expect(screen.getByTestId("drag-drop-match")).toHaveAttribute(
      "data-match-mode",
      "text-to-image"
    );
  });

  it("shows outer SS1 heading and suppresses duplicate inner activity titles", () => {
    render(
      <LessonStudentBlockRenderer
        {...baseProps}
        block={{
          type: "interactiveSequence",
          number: 14,
          title: "STEP-BY-STEP PROCESS",
          sequenceSteps: [
            {
              id: "s1",
              title: "Glucose uptake",
              description: "Glucose enters the cell through transport proteins.",
              imageUrl: "https://example.com/step1.png",
              caption: "",
            },
          ],
        }}
      />
    );
    expect(screen.getByRole("heading", { level: 2, name: /14 — STEP-BY-STEP PROCESS/i })).toBeInTheDocument();
    expect(screen.getByTestId("interactive-sequence")).toHaveAttribute("data-hide-title", "1");
  });

  it("suppresses duplicate drag-drop inner title when outer heading is present", () => {
    render(
      <LessonStudentBlockRenderer
        {...baseProps}
        block={{
          type: "dragDropMatch",
          number: 12,
          title: "DRAG AND DROP MATCH",
          pairs: [{ id: "p1", prompt: "ATP", answer: "Energy currency" }],
        }}
      />
    );
    expect(screen.getByRole("heading", { level: 2, name: /12 — DRAG AND DROP MATCH/i })).toBeInTheDocument();
    expect(screen.getByTestId("drag-drop-match")).toHaveAttribute("data-hide-title", "1");
  });

  it("renders pageQuiz from questions[] via QuizView (not empty markdown)", () => {
    render(
      <LessonStudentBlockRenderer
        {...baseProps}
        block={{
          type: "pageQuiz",
          number: 25,
          title: "Quiz Page",
          content: "",
          questions: [
            {
              prompt: "Why is water needed for germination?",
              questionType: "mcq",
              options: ["A", "B", "C", "D"],
              correctAnswer: "A",
            },
            {
              prompt: "Why is oxygen needed?",
              questionType: "mcq",
              options: ["A", "B", "C", "D"],
              correctAnswer: "B",
            },
          ],
        }}
      />
    );
    expect(screen.getByRole("heading", { level: 2, name: /25 — QUIZ PAGE/i })).toBeInTheDocument();
    expect(screen.getByTestId("quiz-view")).toHaveAttribute("data-count", "2");
    expect(screen.getByTestId("quiz-view")).toHaveTextContent("Why is water needed for germination?");
  });

  it("renders pageQuiz from fallback bank when questions[] is empty", () => {
    render(
      <LessonStudentBlockRenderer
        {...baseProps}
        pageQuizFallbackQuestions={[
          {
            id: "pq1",
            type: "mcq",
            question: "Fallback stem from lesson.quiz?",
            options: ["A", "B", "C", "D"],
            correctAnswer: "C",
            tags: ["page-quiz"],
          },
        ]}
        block={{
          type: "pageQuiz",
          number: 25,
          title: "Quiz Page",
          content: "",
          questions: [],
        }}
      />
    );
    expect(screen.getByTestId("quiz-view")).toHaveAttribute("data-count", "1");
    expect(screen.getByTestId("quiz-view")).toHaveTextContent("Fallback stem from lesson.quiz?");
  });

  it("hides empty pageQuiz shells with no bank", () => {
    const { container } = render(
      <LessonStudentBlockRenderer
        {...baseProps}
        block={{
          type: "pageQuiz",
          number: 25,
          title: "Quiz Page",
          content: "",
          questions: [],
        }}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
