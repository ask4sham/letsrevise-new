import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DragDropMatchBlock } from "./DragDropMatchBlock";

jest.mock("./LessonImageFrame", () => ({
  LessonImageFrame: (props: React.PropsWithChildren<unknown>) => (
    <div data-testid="lesson-image-frame">{props.children}</div>
  ),
}));

describe("DragDropMatchBlock diagram mode", () => {
  const diagramBlock = {
    matchMode: "diagram" as const,
    title: "Diagram activity",
    imageUrl: "https://example.com/diagram.png",
    pairs: [
      { id: "p1", prompt: "Zone 1", answer: "Phagocyte" },
      { id: "p2", prompt: "Zone 2", answer: "Lymphocyte" },
    ],
    dropZones: [{ id: "z1", x: 50, y: 50, correctPairId: "p1" }],
  };

  it("accepts drop on zone marker A and shows answer in summary", () => {
    render(<DragDropMatchBlock block={diagramBlock} resolveImageUrl={(u) => u} />);

    const zoneA = screen.getByRole("button", { name: /drop answer on marker a/i });
    const store: Record<string, string> = {};
    const dt = {
      effectAllowed: "move",
      dropEffect: "move",
      setData: (mime: string, v: string) => {
        store[mime] = v;
      },
      getData: (mime: string) => store[mime] ?? "",
    };

    fireEvent.dragEnter(zoneA, { dataTransfer: dt });
    fireEvent.dragOver(zoneA, { dataTransfer: dt });
    dt.setData("application/x-letsrevise-dnd-pair", "p1");
    dt.setData("text/plain", "p1");
    fireEvent.drop(zoneA, { dataTransfer: dt });

    const summary = screen.getByRole("list", { name: /your labels/i });
    expect(summary.textContent).toMatch(/phagocyte/i);
    expect(screen.getByText(/placed:\s*a/i)).toBeInTheDocument();
  });

  it("places answer when only text/plain is available (browser MIME quirks)", () => {
    render(<DragDropMatchBlock block={diagramBlock} resolveImageUrl={(u) => u} />);

    const zoneA = screen.getByRole("button", { name: /drop answer on marker a/i });
    const store: Record<string, string> = {};
    const dt = {
      effectAllowed: "move",
      dropEffect: "move",
      setData: (mime: string, v: string) => {
        store[mime] = v;
      },
      getData: (mime: string) => {
        if (mime === "text/plain") return store["text/plain"] ?? "";
        return store[mime] ?? "";
      },
    };
    dt.setData("text/plain", "p1");

    fireEvent.dragOver(zoneA, { dataTransfer: dt });
    fireEvent.drop(zoneA, { dataTransfer: dt });

    expect(screen.getByRole("list", { name: /your labels/i }).textContent).toMatch(/phagocyte/i);
  });
});
