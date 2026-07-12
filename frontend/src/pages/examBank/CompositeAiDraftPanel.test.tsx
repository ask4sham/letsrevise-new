import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CompositeAiDraftPanel } from "./CompositeAiDraftPanel";

describe("CompositeAiDraftPanel", () => {
  test("sends difficulty selection and generate click", () => {
    const onDifficultyChange = jest.fn();
    const onGenerate = jest.fn();
    render(
      <CompositeAiDraftPanel
        questionStyle="standard"
        onQuestionStyleChange={() => {}}
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

  test("question style selector switches Standard/Data-table", () => {
    const onStyle = jest.fn();
    render(
      <CompositeAiDraftPanel
        questionStyle="standard"
        onQuestionStyleChange={onStyle}
        difficulty="easy"
        onDifficultyChange={() => {}}
        onGenerate={() => {}}
        generating={false}
        status={null}
        error={null}
      />
    );
    fireEvent.change(screen.getByTestId("composite-ai-question-style"), {
      target: { value: "data_table" },
    });
    expect(onStyle).toHaveBeenCalledWith("data_table");
  });

  test("data-table mode copy mentions read-only stimulus", () => {
    render(
      <CompositeAiDraftPanel
        questionStyle="data_table"
        onQuestionStyleChange={() => {}}
        difficulty="easy"
        onDifficultyChange={() => {}}
        onGenerate={() => {}}
        generating={false}
        status={null}
        error={null}
      />
    );
    expect(screen.getByTestId("composite-ai-draft-panel")).toHaveTextContent(
      /read-only data stimulus plus short-answer parts/i
    );
  });

  test("shows stimulus preview when provided", () => {
    render(
      <CompositeAiDraftPanel
        questionStyle="data_table"
        onQuestionStyleChange={() => {}}
        difficulty="easy"
        onDifficultyChange={() => {}}
        onGenerate={() => {}}
        generating={false}
        status="AI data-table draft filled — review before Save Draft."
        error={null}
        stimulusPreview={{
          title: "Results",
          columns: [
            { heading: "Temperature", unit: "°C" },
            { heading: "Rate", unit: "s⁻¹" },
          ],
          rows: [
            ["20", "0.01"],
            ["30", "0.02"],
            ["40", "0.03"],
          ],
        }}
      />
    );
    expect(screen.getByTestId("composite-ai-stimulus-preview")).toBeInTheDocument();
    expect(screen.getByTestId("composite-ai-stimulus-table")).toHaveTextContent("Temperature");
    expect(screen.getByTestId("composite-ai-status")).toHaveTextContent(/data-table draft filled/i);
  });

  test("shows error without wiping controls", () => {
    render(
      <CompositeAiDraftPanel
        questionStyle="standard"
        onQuestionStyleChange={() => {}}
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

  test("notes required MCQ mix and manual tables for standard", () => {
    render(
      <CompositeAiDraftPanel
        questionStyle="standard"
        onQuestionStyleChange={() => {}}
        difficulty="easy"
        onDifficultyChange={() => {}}
        onGenerate={() => {}}
        generating={false}
        status={null}
        error={null}
      />
    );
    expect(screen.getByTestId("composite-ai-draft-panel")).toHaveTextContent(
      /one multiple-choice part plus short-answer parts/i
    );
    expect(screen.getByTestId("composite-ai-draft-panel")).toHaveTextContent(/Table parts remain manual/i);
  });
});
