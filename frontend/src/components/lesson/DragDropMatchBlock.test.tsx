import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

  it("diagram zone D marks antitoxins correct and feedback uses zone.correctPairId (not pair index)", () => {
    const fourZoneBlock = {
      matchMode: "diagram" as const,
      title: "Diagram activity",
      imageUrl: "https://example.com/diagram.png",
      pairs: [
        { id: "p1", prompt: "A", answer: "MATCH_PHAGOCYTE" },
        { id: "p2", prompt: "B", answer: "MATCH_LYMPHOCYTE" },
        { id: "p3", prompt: "C", answer: "MATCH_ANTIBODIES" },
        { id: "p4", prompt: "D", answer: "MATCH_ANTITOXINS" },
      ],
      dropZones: [
        { id: "za", x: 10, y: 10, correctPairId: "p1" },
        { id: "zb", x: 20, y: 20, correctPairId: "p2" },
        { id: "zc", x: 30, y: 30, correctPairId: "p3" },
        { id: "zd", x: 40, y: 40, correctPairId: "p4" },
      ],
    };

    render(<DragDropMatchBlock block={fourZoneBlock} resolveImageUrl={(u) => u} />);

    fireEvent.click(screen.getByRole("button", { name: /select answer:\s*MATCH_ANTITOXINS/i }));
    fireEvent.click(screen.getByRole("button", { name: /drop answer on marker d/i }));

    fireEvent.click(screen.getByRole("button", { name: /check answers/i }));

    const summaryList = screen.getByRole("list", { name: /your labels/i });
    const rows = within(summaryList).getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(rows[3].textContent).toContain("MATCH_ANTITOXINS");
    expect(rows[3].textContent).toContain("Correct answer");
    expect(rows[3].textContent).not.toMatch(/MATCH_PHAGOCYTE/);
  });

  it("diagram zone D feedback uses zone.correctPairId lookup — not pairs[0] when pairs array order is shuffled", () => {
    const shuffledPairsBlock = {
      matchMode: "diagram" as const,
      title: "Diagram activity",
      imageUrl: "https://example.com/diagram.png",
      pairs: [
        { id: "p4", prompt: "D", answer: "TXT_ANTITOXINS" },
        { id: "p2", prompt: "B", answer: "TXT_LYMPHOCYTE" },
        { id: "p3", prompt: "C", answer: "TXT_ANTIBODIES" },
        { id: "p1", prompt: "A", answer: "TXT_PHAGOCYTE" },
      ],
      dropZones: [
        { id: "za", x: 10, y: 10, correctPairId: "p1" },
        { id: "zb", x: 20, y: 20, correctPairId: "p2" },
        { id: "zc", x: 30, y: 30, correctPairId: "p3" },
        { id: "zd", x: 40, y: 40, correctPairId: "p4" },
      ],
    };

    render(<DragDropMatchBlock block={shuffledPairsBlock} resolveImageUrl={(u) => u} />);

    fireEvent.click(screen.getByRole("button", { name: /select answer:\s*TXT_ANTITOXINS/i }));
    fireEvent.click(screen.getByRole("button", { name: /drop answer on marker d/i }));
    fireEvent.click(screen.getByRole("button", { name: /check answers/i }));

    const summaryList = screen.getByRole("list", { name: /your labels/i });
    const rows = within(summaryList).getAllByRole("listitem");
    expect(rows[3].textContent).toContain("TXT_ANTITOXINS");
    expect(rows[3].textContent).toContain("Correct answer");
    expect(rows[3].textContent).not.toContain("TXT_PHAGOCYTE");
  });
});
