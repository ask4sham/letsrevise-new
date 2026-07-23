/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { RevisionQuizResultCard } from "./RevisionQuizResultCard";

describe("RevisionQuizResultCard", () => {
  test("perfect score shows Great job and 4/4", () => {
    render(<RevisionQuizResultCard score={4} questionCount={4} />);
    expect(screen.getByTestId("revision-quiz-result-card")).toHaveTextContent(
      /Great job — you understand this topic well/i
    );
    expect(screen.getByTestId("revision-quiz-result-score")).toHaveTextContent("4/4");
    expect(screen.queryByText(/1 \/ 1\.0/)).toBeNull();
    expect(screen.queryByText(/Your mastery/i)).toBeNull();
  });

  test("partial score shows honest fraction", () => {
    render(<RevisionQuizResultCard score={3} questionCount={4} />);
    expect(screen.getByTestId("revision-quiz-result-score")).toHaveTextContent("3/4");
    expect(screen.queryByText(/Great job — you understand this topic well/i)).toBeNull();
    expect(screen.queryByText(/1 \/ 1\.0/)).toBeNull();
  });

  test("unknown score renders nothing", () => {
    const { container } = render(<RevisionQuizResultCard score={null} questionCount={4} />);
    expect(container).toBeEmptyDOMElement();
  });
});
