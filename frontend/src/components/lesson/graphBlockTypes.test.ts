import {
  contentLooksLikeGraphJson,
  graphBlockForPersist,
  normalizeGraphBlockForDisplay,
} from "./graphBlockTypes";
import { resolveLessonDisplayBlockType } from "../../types/lessonBlocks";

const GRAPH_JSON = JSON.stringify({
  graphType: "line",
  xAxisLabel: "Light intensity",
  graphSeries: [
    {
      id: "s1",
      label: "Series A",
      points: [{ x: 0, y: 0 }, { x: 10, y: 8 }],
    },
  ],
});

describe("contentLooksLikeGraphJson", () => {
  it("detects graph backup JSON in content", () => {
    expect(contentLooksLikeGraphJson(GRAPH_JSON)).toBe(true);
    expect(contentLooksLikeGraphJson("plain text")).toBe(false);
  });
});

describe("graphBlockForPersist", () => {
  it("hydrates graphSeries from JSON content backup on save", () => {
    const misSaved = {
      type: "text",
      content: GRAPH_JSON,
    };
    const out = graphBlockForPersist(misSaved);
    expect(out.type).toBe("graph");
    expect(out.content).toBe("");
    expect(Array.isArray(out.graphSeries)).toBe(true);
    expect((out.graphSeries as unknown[]).length).toBe(1);
  });
});

describe("normalizeGraphBlockForDisplay", () => {
  it("recovers graph from mis-tagged text block with JSON content", () => {
    const misTagged = {
      type: "text",
      content: GRAPH_JSON,
      title: "GRAPH / DATA VISUALISATION",
    };
    expect(resolveLessonDisplayBlockType(misTagged)).toBe("graph");
    const normalized = normalizeGraphBlockForDisplay(misTagged);
    expect(normalized.type).toBe("graph");
    expect(normalized.content).toBe("");
    expect(Array.isArray(normalized.graphSeries)).toBe(true);
    expect((normalized.graphSeries as unknown[]).length).toBe(1);
  });
});
