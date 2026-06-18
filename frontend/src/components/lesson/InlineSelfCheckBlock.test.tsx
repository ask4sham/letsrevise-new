import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { InlineSelfCheckBlock } from "./InlineSelfCheckBlock";

describe("InlineSelfCheckBlock MCQ reveal", () => {
  it("reveals model answer without removing options after reveal click", () => {
    render(
      <InlineSelfCheckBlock
        prompt="Which organelle contains DNA?"
        questionType="mcq"
        options={["Mitochondria", "Nucleus", "Ribosome", "Cell wall"]}
        correctAnswer="Nucleus"
        explanation="DNA is in the nucleus."
      />
    );

    expect(screen.getByText("Mitochondria")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reveal answer/i }));

    expect(screen.getByText("Answer:")).toBeInTheDocument();
    expect(screen.getAllByText("Nucleus").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Mitochondria")).toBeInTheDocument();
    expect(screen.getByText(/DNA is in the nucleus/)).toBeInTheDocument();
  });
});
