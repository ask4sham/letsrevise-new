import React from "react";
import { render, screen } from "@testing-library/react";
import { extractActivityQuestionsFromBlock } from "./activityQuestionsFromBlock";
import { ActivityQuestionPager } from "../components/lesson/ActivityQuestionPager";

describe("extractActivityQuestionsFromBlock", () => {
  test("reads questions[] when present", () => {
    const qs = extractActivityQuestionsFromBlock({
      type: "selfCheck",
      questions: [
        { prompt: "Q1?", questionType: "short", correctAnswer: "a" },
        { prompt: "Q2?", questionType: "short", correctAnswer: "b" },
        { prompt: "Q3?", questionType: "short", correctAnswer: "c" },
      ],
    });
    expect(qs).toHaveLength(3);
    expect(qs[0].prompt).toBe("Q1?");
  });

  test("legacy one-question self-check still extracts", () => {
    const qs = extractActivityQuestionsFromBlock({
      type: "selfCheck",
      prompt: "Only one?",
      questionType: "short",
      correctAnswer: "yes",
    });
    expect(qs).toHaveLength(1);
    expect(qs[0].prompt).toBe("Only one?");
  });

  test("legacy one-question checkpoint still extracts", () => {
    const qs = extractActivityQuestionsFromBlock({
      type: "checkpoint",
      prompt: "MCQ?",
      questionType: "mcq",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
    });
    expect(qs).toHaveLength(1);
  });

  test("does not invent questions when empty", () => {
    expect(extractActivityQuestionsFromBlock({ type: "selfCheck" })).toEqual([]);
  });
});

describe("ActivityQuestionPager", () => {
  test("shows Question n/total for multi-question activities", () => {
    render(<ActivityQuestionPager total={3} index={0} onChange={() => {}} />);
    expect(screen.getByTestId("activity-question-pager")).toHaveTextContent("Question 1/3");
  });

  test("hides pager for single-question legacy lessons", () => {
    const { container } = render(
      <ActivityQuestionPager total={1} index={0} onChange={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
