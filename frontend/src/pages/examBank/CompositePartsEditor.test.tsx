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

  test("switching to table initializes default partData", () => {
    render(<EditorHarness initialParts={[makeEmptyCompositePart(0)]} tablePartsEnabled />);

    fireEvent.change(screen.getByTestId("part-type-select-0"), { target: { value: "table" } });

    const payload = JSON.parse(screen.getByTestId("saved-payload").textContent || "[]");
    expect(payload[0].partData).toEqual(makeDefaultTablePartData());
  });
});
