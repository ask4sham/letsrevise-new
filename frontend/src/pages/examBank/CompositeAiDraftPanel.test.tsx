import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CompositeAiDraftPanel } from "./CompositeAiDraftPanel";

describe("CompositeAiDraftPanel", () => {
  test("sends difficulty selection and generate click", () => {
    const onDifficultyChange = jest.fn();
    const onGenerate = jest.fn();
    render(
      <CompositeAiDraftPanel
        difficulty="easy"
        onDifficultyChange={onDifficultyChange}
        onGenerate={onGenerate}
        generating={false}
        status={null}
        error={null}
      />
    );
    fireEvent.change(screen.getByTestId("composite-ai-difficulty"), { target: { value: "hard" } });
    expect(onDifficultyChange).toHaveBeenCalledWith("hard");
    fireEvent.click(screen.getByTestId("composite-ai-generate"));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  test("shows error without wiping controls", () => {
    render(
      <CompositeAiDraftPanel
        difficulty="medium"
        onDifficultyChange={() => {}}
        onGenerate={() => {}}
        generating={false}
        status={null}
        error="Select a topic before generating."
      />
    );
    expect(screen.getByTestId("composite-ai-error")).toHaveTextContent("Select a topic before generating.");
    expect(screen.getByTestId("composite-ai-generate")).toBeInTheDocument();
  });
});
