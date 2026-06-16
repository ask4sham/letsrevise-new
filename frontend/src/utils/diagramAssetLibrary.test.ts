import { filterDiagramAssets } from "./diagramAssetLibrary";

describe("filterDiagramAssets", () => {
  const sample = [
    {
      id: "1",
      title: "Reflex arc overview",
      subject: "Biology",
      topic: "Reflex Arc",
      examBoard: "AQA",
      tier: "Higher",
      keywords: ["stimulus", "effector"],
      imageUrl: "https://cdn.example.com/reflex.png",
      activityTypes: ["view"] as const,
    },
    {
      id: "2",
      title: "Photosynthesis",
      subject: "Biology",
      topic: "Photosynthesis",
      examBoard: "AQA",
      tier: "Foundation",
      keywords: ["chloroplast"],
      imageUrl: "https://cdn.example.com/photo.png",
      activityTypes: ["view"] as const,
    },
  ];

  it("returns all assets when query is empty", () => {
    expect(filterDiagramAssets(sample, "")).toHaveLength(2);
  });

  it("filters by topic and keywords", () => {
    expect(filterDiagramAssets(sample, "reflex")).toHaveLength(1);
    expect(filterDiagramAssets(sample, "chloroplast")[0]?.title).toBe("Photosynthesis");
  });
});
