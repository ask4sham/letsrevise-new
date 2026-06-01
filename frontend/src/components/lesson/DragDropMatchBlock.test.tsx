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

  it("diagram worksheet uses side-by-side layout marker and stage wrapper", () => {
    render(<DragDropMatchBlock block={diagramBlock} resolveImageUrl={(u) => u} />);
    const worksheet = screen.getByTestId("drag-drop-diagram-worksheet");
    expect(worksheet).toHaveAttribute("data-ddm-diagram-layout", "side-by-side-v1");
    const stage = worksheet.querySelector(".drag-drop-match__diagram-worksheet-stage");
    expect(stage).toBeTruthy();
    expect(stage!.querySelector(".drag-drop-match__diagram-panel")).toBeTruthy();
    expect(stage!.querySelector(".drag-drop-match__diagram-bank")).toBeTruthy();
    expect(document.querySelector(".drag-drop-match--diagram")).toBeTruthy();
  });

  it("renders Your labels inside the diagram panel below the image", () => {
    const { container } = render(
      <DragDropMatchBlock block={diagramBlock} resolveImageUrl={(u) => u} />
    );
    const panel = container.querySelector(".drag-drop-match__diagram-panel");
    expect(panel).toBeTruthy();
    expect(panel!.querySelector(".drag-drop-match__diagram-summary--under-image")).toBeTruthy();
    expect(within(panel as HTMLElement).getByRole("list", { name: /your labels/i })).toBeInTheDocument();
    const stage = container.querySelector(".drag-drop-match__diagram-worksheet-stage");
    expect(stage?.querySelector(":scope > .drag-drop-match__diagram-summary")).toBeNull();
  });

  it("accepts drop on zone marker A and shows answer in summary", () => {
    render(<DragDropMatchBlock block={diagramBlock} resolveImageUrl={(u) => u} />);

    const zoneA = screen.getByRole("button", { name: /drop answer on marker a/i });
    expect(document.querySelector(".drag-drop-match__diagram-zone--tti-boxed")).toBeNull();
    expect(document.querySelector(".drag-drop-match__diagram-zone-letter")).toBeTruthy();
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

  const diagramBlockWithThumb = {
    matchMode: "diagram" as const,
    title: "Diagram with images",
    imageUrl: "https://example.com/diagram.png",
    pairs: [
      {
        id: "p1",
        prompt: "A",
        answer: "Phagocyte cell",
        answerImageUrl: "https://example.com/phago.png",
      },
      { id: "p2", prompt: "B", answer: "Lymphocyte only text" },
    ],
    dropZones: [
      { id: "z1", x: 50, y: 50, correctPairId: "p1" },
      { id: "z2", x: 60, y: 60, correctPairId: "p2" },
    ],
  };

  it("diagram answer bank still renders one card per pair with preview zoom affordance", () => {
    render(<DragDropMatchBlock block={diagramBlockWithThumb} resolveImageUrl={(u) => u} />);
    const bankCards = screen.getAllByRole("button", { name: /select answer:/i });
    expect(bankCards).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /enlarge preview:/i })).toHaveLength(2);
    expect(document.querySelectorAll("img.drag-drop-match__answer-thumb--diagram-card")).toHaveLength(1);
  });

  it("enlarged preview opens without removing bank cards; drag works after close", () => {
    render(<DragDropMatchBlock block={diagramBlockWithThumb} resolveImageUrl={(u) => u} />);
    fireEvent.click(
      screen.getByRole("button", { name: /enlarge preview:\s*phagocyte cell/i })
    );
    const dialog = screen.getByTestId("ddm-answer-preview-dialog");
    expect(dialog.textContent).toMatch(/phagocyte cell/i);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("ddm-answer-preview-dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /select answer:/i })).toHaveLength(2);

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
    dt.setData("application/x-letsrevise-dnd-pair", "p1");
    fireEvent.dragOver(zoneA, { dataTransfer: dt });
    fireEvent.drop(zoneA, { dataTransfer: dt });
    expect(screen.getByRole("list", { name: /your labels/i }).textContent).toMatch(/phagocyte/i);
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

describe("DragDropMatchBlock text-to-image main image mode", () => {
  const ttiMainBlock = {
    matchMode: "text-to-image" as const,
    title: "Label the diagram",
    imageUrl: "https://example.com/main-diagram.png",
    pairs: [
      { id: "p1", prompt: "ATP release", answer: "Mitochondria" },
      { id: "p2", prompt: "Photosynthesis", answer: "Chloroplast" },
    ],
  };

  it("renders main image worksheet with concept cards", () => {
    render(<DragDropMatchBlock block={ttiMainBlock} resolveImageUrl={(u) => u} />);
    expect(screen.getByTestId("drag-drop-tti-main-worksheet")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /label the diagram/i })).toHaveAttribute(
      "src",
      "https://example.com/main-diagram.png"
    );
    expect(screen.getByRole("button", { name: /select concept:\s*ATP release/i })).toBeInTheDocument();
    expect(screen.queryByTestId("drag-drop-tti-grid")).toBeNull();
  });

  it("uses rectangular boxed drop zones without circular marker letters", () => {
    const { container } = render(
      <DragDropMatchBlock block={ttiMainBlock} resolveImageUrl={(u) => u} />
    );
    expect(container.querySelectorAll(".drag-drop-match__diagram-zone--tti-boxed").length).toBe(2);
    expect(container.querySelector(".drag-drop-match__diagram-zone-letter")).toBeNull();
    expect(screen.getByRole("button", { name: /drop concept in box a/i })).toBeInTheDocument();
  });

  it("click-to-place concept into boxed drop zone on main image", () => {
    render(<DragDropMatchBlock block={ttiMainBlock} resolveImageUrl={(u) => u} />);
    fireEvent.click(screen.getByRole("button", { name: /select concept:\s*ATP release/i }));
    fireEvent.click(screen.getByRole("button", { name: /drop concept in box a/i }));
    expect(screen.getByText("ATP release")).toBeInTheDocument();
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

  it("renders text-to-image grid with clues-left layout marker", () => {
    render(<DragDropMatchBlock block={ttiBlock} resolveImageUrl={(u) => u} />);
    const grid = screen.getByTestId("drag-drop-tti-grid");
    expect(grid).toHaveAttribute("data-tti-layout", "clues-left-v1");
    expect(screen.getByText(/ATP release/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /select concept:\s*ATP release/i })).toBeInTheDocument();
    const imgs = document.querySelectorAll("img.drag-drop-match__tti-image");
    expect(imgs.length).toBeGreaterThanOrEqual(1);
  });

  it("places image targets column before concept cards in DOM (wide layout: clues left)", () => {
    const { container } = render(<DragDropMatchBlock block={ttiBlock} resolveImageUrl={(u) => u} />);
    const grid = container.querySelector(".drag-drop-match__tti-grid");
    expect(grid).toBeTruthy();
    const children = Array.from(grid!.children);
    expect(children[0]).toHaveClass("drag-drop-match__tti-targets-column");
    expect(children[1]).toHaveClass("drag-drop-match__tti-concept-column");
  });

  it("uses full-resolution png for text-to-image target when stored as display.png", () => {
    const displayBlock = {
      ...ttiBlock,
      pairs: [
        {
          id: "p1",
          prompt: "Clue A",
          answer: "Label A",
          imageUrl: "https://example.com/clue-a.display.png",
        },
      ],
    };
    render(<DragDropMatchBlock block={displayBlock} resolveImageUrl={(u) => u} />);
    const img = document.querySelector("img.drag-drop-match__tti-image");
    expect(img).toHaveAttribute("src", "https://example.com/clue-a.png");
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

  it("concept cards offer enlarge preview without breaking click-to-place", () => {
    render(<DragDropMatchBlock block={ttiBlock} resolveImageUrl={(u) => u} />);
    expect(screen.getByRole("button", { name: /enlarge preview:\s*ATP release/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /enlarge preview:\s*ATP release/i }));
    expect(screen.getByTestId("ddm-answer-preview-dialog").textContent).toMatch(/ATP release/i);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: /select concept:\s*Photosynthesis/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /drop concept onto image target chloroplast/i })
    );
    expect(screen.getByText("Photosynthesis")).toBeInTheDocument();
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

  it("diagram mode grid does not use text-to-image clues-left layout", () => {
    const diagramOnly = {
      matchMode: "diagram" as const,
      imageUrl: "https://example.com/d.png",
      pairs: [{ id: "p1", prompt: "A", answer: "B" }],
      dropZones: [{ id: "z1", x: 50, y: 50, correctPairId: "p1" }],
    };
    render(<DragDropMatchBlock block={diagramOnly} resolveImageUrl={(u) => u} />);
    expect(screen.queryByTestId("drag-drop-tti-grid")).not.toBeInTheDocument();
  });

  it("standard text mode bank has no enlarge preview controls", () => {
    render(<DragDropMatchBlock block={textBlockWithImage} resolveImageUrl={(u) => u} />);
    expect(screen.queryByRole("button", { name: /enlarge preview:/i })).not.toBeInTheDocument();
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
