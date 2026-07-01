jest.mock("../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

import api from "../services/api";
import { fetchTaxonomy, getSpecFormMetadataFromTaxonomy, getSpecIdentity, getSpecTopicFieldLabel } from "./taxonomy";

describe("fetchTaxonomy", () => {
  beforeEach(() => {
    jest.mocked(api.get).mockReset();
  });

  it("calls /taxonomy/edexcel-igcse-biology for Edexcel IGCSE Biology", async () => {
    jest.mocked(api.get).mockResolvedValue({ data: { specKey: "edexcel-igcse-biology", units: [] } });
    await fetchTaxonomy("edexcel-igcse-biology");
    expect(api.get).toHaveBeenCalledWith("/taxonomy/edexcel-igcse-biology");
  });

  it("calls /taxonomy/aqa-gcse-biology for AQA GCSE Biology", async () => {
    jest.mocked(api.get).mockResolvedValue({ data: { specKey: "aqa-gcse-biology", units: [] } });
    await fetchTaxonomy("aqa-gcse-biology");
    expect(api.get).toHaveBeenCalledWith("/taxonomy/aqa-gcse-biology");
  });
});

describe("getSpecTopicFieldLabel", () => {
  it("returns dynamic label for Edexcel IGCSE Biology", () => {
    expect(getSpecTopicFieldLabel("edexcel-igcse-biology")).toBe("Topic (Edexcel IGCSE Biology)");
  });

  it("returns dynamic label for AQA GCSE Biology", () => {
    expect(getSpecTopicFieldLabel("aqa-gcse-biology")).toBe("Topic (AQA GCSE Biology)");
  });

  it("does not hardcode AQA Biology for all specs", () => {
    expect(getSpecTopicFieldLabel("aqa-gcse-chemistry")).toBe("Topic (AQA GCSE Chemistry)");
    expect(getSpecTopicFieldLabel("edexcel-igcse-biology")).not.toContain("AQA Biology");
  });
});

describe("getSpecFormMetadataFromTaxonomy", () => {
  it("derives Edexcel IGCSE metadata from taxonomy", () => {
    expect(
      getSpecFormMetadataFromTaxonomy({
        subject: "Biology",
        examBoard: "Edexcel",
        level: "IGCSE",
      })
    ).toEqual({
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
    });
  });

  it("derives AQA GCSE metadata from taxonomy", () => {
    expect(
      getSpecFormMetadataFromTaxonomy({
        subject: "Biology",
        examBoard: "AQA",
        level: "GCSE",
      })
    ).toEqual({
      subject: "Biology",
      examBoard: "AQA",
      level: "GCSE",
    });
  });
});

describe("getSpecIdentity", () => {
  it("returns Edexcel IGCSE 4BI1 identity", () => {
    expect(getSpecIdentity("edexcel-igcse-biology")).toEqual({
      board: "Edexcel",
      level: "IGCSE",
      examCode: "4BI1",
    });
  });

  it("returns null for unknown spec", () => {
    expect(getSpecIdentity("unknown-spec")).toBeNull();
  });
});
