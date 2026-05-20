import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DragDropMatchBlock } from "./DragDropMatchBlock";

jest.mock("./LessonImageFrame", () => ({
  LessonImageFrame: (props) => (
    <div data-testid="lesson-image-frame">{props.children}</div>
  ),
}));

jest.mock("./LessonRichText", () => ({
  LessonRichText: ({ text }: { text?: string }) => (text ? <p>{text}</p> : null),
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

describe("DragDropMatchBlock text-to-image mode", () => {
  const ttiBlock = {
    matchMode: "text-to-image" as const,
    title: "Structure match",
    pairs: [
      {
        id: "p1",
        prompt: "ATP release",
        answer: "Mitochondria",
        imageUrl: "https://example.com/mito.png",
        explanation: "Mitochondria release energy during respiration.",
      },
      {
        id: "p2",
        prompt: "Photosynthesis",
        answer: "Chloroplast",
        imageUrl: "https://example.com/chloro.png",
      },
    ],
  };

  it("renders text-to-image grid with concept cards and image targets", () => {
    render(<DragDropMatchBlock block={ttiBlock} resolveImageUrl={(u) => u} />);
    expect(screen.getByTestId("drag-drop-tti-grid")).toBeInTheDocument();
    expect(screen.getByText(/ATP release/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /select concept:\s*ATP release/i })).toBeInTheDocument();
    const imgs = document.querySelectorAll("img.drag-drop-match__tti-image");
    expect(imgs.length).toBeGreaterThanOrEqual(1);
  });

  it("click-to-place: select concept then tap image drop zone", () => {
    render(<DragDropMatchBlock block={ttiBlock} resolveImageUrl={(u) => u} />);
    fireEvent.click(screen.getByRole("button", { name: /select concept:\s*Photosynthesis/i }));
    expect(screen.getByRole("button", { name: /select concept:\s*Photosynthesis/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(
      screen.getByRole("button", { name: /drop concept onto image target chloroplast/i })
    );
    expect(screen.getByText("Photosynthesis")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /select concept:\s*Photosynthesis/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /select concept:\s*ATP release/i })).toBeInTheDocument();
  });

  it("check answers shows correct label feedback", () => {
    render(<DragDropMatchBlock block={ttiBlock} resolveImageUrl={(u) => u} />);
    fireEvent.click(screen.getByRole("button", { name: /select concept:\s*ATP release/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /drop concept onto image target mitochondria/i })
    );
    fireEvent.click(screen.getByRole("button", { name: /check answers/i }));
    expect(screen.getAllByText("Mitochondria").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Mitochondria release energy during respiration/i)).toBeInTheDocument();
  });

  it("applies text-to-image layout modifier on root section", () => {
    const { container } = render(
      <DragDropMatchBlock block={ttiBlock} resolveImageUrl={(u) => u} />
    );
    expect(container.querySelector(".drag-drop-match--text-to-image.text-to-image")).toBeTruthy();
    expect(container.querySelector(".concept-card-column")).toBeTruthy();
    expect(container.querySelector(".image-target-list")).toBeTruthy();
  });
});

describe("DragDropMatchBlock text mode answer images", () => {
  const textBlockWithImage = {
    title: "Match cells",
    pairs: [
      {
        id: "p1",
        prompt: "White blood cell that produces a specific antibody",
        answer: "LYMPHOCYTE",
        answerImageUrl: "https://example.com/lymphocyte.png",
      },
      { id: "p2", prompt: "Another definition", answer: "OTHER" },
    ],
  };

  it("standard text mode unchanged when matchMode omitted", () => {
    render(<DragDropMatchBlock block={textBlockWithImage} resolveImageUrl={(u) => u} />);
    expect(screen.queryByTestId("drag-drop-tti-grid")).not.toBeInTheDocument();
    expect(screen.getByText(/drop your answers here/i)).toBeInTheDocument();
  });

  it("shows answer thumbnail in bank when answerImageUrl is set", () => {
    render(<DragDropMatchBlock block={textBlockWithImage} resolveImageUrl={(u) => u} />);
    const thumbs = document.querySelectorAll("img.drag-drop-match__answer-thumb");
    expect(thumbs).toHaveLength(1);
    expect(thumbs[0]).toHaveAttribute("src", "https://example.com/lymphocyte.png");
  });

  it("shows the same thumbnail in the target zone after placing", () => {
    render(<DragDropMatchBlock block={textBlockWithImage} resolveImageUrl={(u) => u} />);
    fireEvent.click(screen.getByRole("button", { name: /select answer:\s*LYMPHOCYTE/i }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /place answer into white blood cell that produces a specific antibody/i,
      })
    );
    const thumbs = document.querySelectorAll("img.drag-drop-match__answer-thumb");
    expect(thumbs).toHaveLength(1);
    expect(thumbs[0]).toHaveAttribute("src", "https://example.com/lymphocyte.png");
  });
});
