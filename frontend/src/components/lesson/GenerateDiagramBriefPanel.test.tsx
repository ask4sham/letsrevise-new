import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GenerateDiagramBriefPanel } from "./GenerateDiagramBriefPanel";
import { generateDiagramBriefFromBlock } from "../../api/diagramBriefs";

jest.mock("../../api/diagramBriefs", () => ({
  generateDiagramBriefFromBlock: jest.fn(),
}));

describe("GenerateDiagramBriefPanel", () => {
  beforeEach(() => {
    jest.mocked(generateDiagramBriefFromBlock).mockReset();
  });

  it("generates and shows copyable image prompt", async () => {
    jest.mocked(generateDiagramBriefFromBlock).mockResolvedValue({
      brief: "Create a GCSE AQA Higher Tier Biology diagram.\n\nRegion 1 highlighted",
      teacherMetadata: "Region 1 = Hypothalamus",
      warnings: [],
      metadata: { regionIdAbstracted: true },
    });

    render(
      <GenerateDiagramBriefPanel
        block={{ type: "dragDropMatch", pairs: [{ prompt: "A", answer: "B" }] }}
        lesson={{ subject: "Biology", board: "AQA", topic: "Brain" }}
        page={{ title: "Regions" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Generate Diagram Brief/i }));

    await waitFor(() => {
      expect(screen.getByText(/Region 1 highlighted/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Region 1 = Hypothalamus/i)).toBeInTheDocument();
    expect(generateDiagramBriefFromBlock).toHaveBeenCalled();
  });
});
