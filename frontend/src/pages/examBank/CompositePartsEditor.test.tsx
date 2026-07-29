import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CompositePartsEditor } from "./CompositePartsEditor";
import {
  buildCompositeSaveParts,
  makeEmptyCompositePart,
  makeDefaultTablePartData,
  type CompositePartForm,
} from "./compositeTableEditorUtils";

function EditorHarness({
  initialParts,
  tablePartsEnabled,
}: {
  initialParts: CompositePartForm[];
  tablePartsEnabled: boolean;
}) {
  const [form, setForm] = useState({
    title: "",
    sharedStem: "Shared stem",
    parts: initialParts,
  });

  return (
    <div>
      <CompositePartsEditor form={form} setForm={setForm} tablePartsEnabled={tablePartsEnabled} />
      <pre data-testid="saved-payload">{JSON.stringify(buildCompositeSaveParts(form.parts))}</pre>
    </div>
  );
}

describe("CompositePartsEditor table authoring", () => {
  test("flag OFF: Table option hidden in part type select", () => {
    render(<EditorHarness initialParts={[makeEmptyCompositePart(0)]} tablePartsEnabled={false} />);

    const select = screen.getByTestId("part-type-select-0") as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.text);
    expect(labels).toEqual(["Short answer", "Multiple choice"]);
    expect(labels).not.toContain("Table");
    expect(screen.queryByTestId("composite-table-part-editor")).not.toBeInTheDocument();
  });

  test("flag ON: Table option visible in part type select", () => {
    render(<EditorHarness initialParts={[makeEmptyCompositePart(0)]} tablePartsEnabled />);

    const select = screen.getByTestId("part-type-select-0") as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.text);
    expect(labels).toContain("Table");

    fireEvent.change(select, { target: { value: "table" } });
    expect(screen.getByTestId("composite-table-part-editor")).toBeInTheDocument();
  });

  test("flag ON: table partData persists in save payload", () => {
    const part: CompositePartForm = {
      ...makeEmptyCompositePart(0),
      type: "table",
      questionText: "Complete the table.",
      partData: {
        headers: ["Name", "Role"],
        rows: [
          {
            cells: [
              { value: "", blank: true, correctAnswer: "FSH" },
              { value: "Stimulates follicles", blank: false },
            ],
          },
        ],
      },
    };

    render(<EditorHarness initialParts={[part]} tablePartsEnabled />);

    const correctInput = screen.getByLabelText("Row 1 column 1 correct answer");
    fireEvent.change(correctInput, { target: { value: "LH" } });

    const payload = JSON.parse(screen.getByTestId("saved-payload").textContent || "[]");
    expect(payload[0].type).toBe("table");
    expect(payload[0].partData.headers).toEqual(["Name", "Role"]);
    expect(payload[0].partData.rows[0].cells[0]).toMatchObject({
      blank: true,
      correctAnswer: "LH",
    });
    expect(payload[0].options).toEqual([]);
    expect(payload[0].correctIndex).toBeNull();
  });

  test("MCQ part fields unchanged when table flag is ON", () => {
    const part: CompositePartForm = {
      ...makeEmptyCompositePart(0),
      type: "mcq",
      questionText: "Pick the answer.",
      options: ["One", "Two", "", ""],
      correctIndex: 1,
      markScheme: "B is correct",
    };

    render(<EditorHarness initialParts={[part]} tablePartsEnabled />);

    expect(screen.getByDisplayValue("Pick the answer.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("One")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Two")).toBeInTheDocument();
    expect(screen.getByLabelText(/Why this answer is correct/i)).toBeInTheDocument();
    expect(screen.queryByTestId("composite-table-part-editor")).not.toBeInTheDocument();

    const payload = JSON.parse(screen.getByTestId("saved-payload").textContent || "[]");
    expect(payload[0]).toEqual({
      label: "a",
      type: "mcq",
      marks: 2,
      questionText: "Pick the answer.",
      markScheme: ["B is correct"],
      options: ["One", "Two"],
      correctIndex: 1,
    });
  });

  test("MCQ rationale textarea serialises to partData.explanation and clears when emptied", () => {
    const rationale =
      "Light is not essential for germination because the seed initially uses energy stored in its food reserves. Water activates enzymes, oxygen is required for aerobic respiration, and a suitable temperature allows enzyme-controlled reactions to occur.";
    const part: CompositePartForm = {
      ...makeEmptyCompositePart(0),
      type: "mcq",
      questionText: "Which factor is NOT essential for seed germination?",
      options: ["Water", "Oxygen", "Suitable temperature", "Light"],
      correctIndex: 3,
      markScheme: "Award 1 mark for selecting Light.",
    };

    render(<EditorHarness initialParts={[part]} tablePartsEnabled={false} />);

    const explanation = screen.getByTestId("mcq-explanation-0");
    fireEvent.change(explanation, { target: { value: rationale } });

    let payload = JSON.parse(screen.getByTestId("saved-payload").textContent || "[]");
    expect(payload[0].partData).toEqual({ explanation: rationale });
    expect(payload[0].markScheme).toEqual(["Award 1 mark for selecting Light."]);
    expect(payload[0].correctIndex).toBe(3);
    expect(payload[0].options).toEqual(["Water", "Oxygen", "Suitable temperature", "Light"]);
    expect(payload[0].marks).toBe(2);

    fireEvent.change(explanation, { target: { value: "" } });
    payload = JSON.parse(screen.getByTestId("saved-payload").textContent || "[]");
    expect(payload[0]).not.toHaveProperty("partData");
    expect(payload[0].markScheme).toEqual(["Award 1 mark for selecting Light."]);
    expect(payload[0].correctIndex).toBe(3);
  });

  test("existing API MCQ rationale loads into the textarea", () => {
    const part: CompositePartForm = {
      ...makeEmptyCompositePart(0),
      type: "mcq",
      questionText: "Pick one.",
      options: ["A", "B", "", ""],
      correctIndex: 0,
      markScheme: "",
      partData: { explanation: "Water activates enzymes." },
    };

    render(<EditorHarness initialParts={[part]} tablePartsEnabled={false} />);

    expect(screen.getByTestId("mcq-explanation-0")).toHaveValue("Water activates enzymes.");
    const payload = JSON.parse(screen.getByTestId("saved-payload").textContent || "[]");
    expect(payload[0].partData).toEqual({ explanation: "Water activates enzymes." });
  });

  test("short parts do not show Why this answer is correct", () => {
    render(<EditorHarness initialParts={[makeEmptyCompositePart(0)]} tablePartsEnabled={false} />);
    expect(screen.queryByLabelText(/Why this answer is correct/i)).not.toBeInTheDocument();
  });

  test("switching to table initializes default partData", () => {
    render(<EditorHarness initialParts={[makeEmptyCompositePart(0)]} tablePartsEnabled />);

    fireEvent.change(screen.getByTestId("part-type-select-0"), { target: { value: "table" } });

    const payload = JSON.parse(screen.getByTestId("saved-payload").textContent || "[]");
    expect(payload[0].partData).toEqual(makeDefaultTablePartData());
  });
});
