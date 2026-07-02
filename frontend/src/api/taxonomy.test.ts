jest.mock("../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

import api from "../services/api";
import {
  fetchTaxonomy,
  getSpecFormMetadataFromTaxonomy,
  getSpecIdentity,
  getSpecTopicFieldLabel,
  getTaxonomyKeyToTopic,
  getTaxonomyOptionGroups,
  getTaxonomyTopicsFlat,
  getUnitTopics,
  type TaxonomyResponse,
} from "./taxonomy";

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

const edexcelLikeTaxonomy = {
  units: [
    {
      unit: "The nature and variety of living organisms",
      topics: [],
      sections: [
        {
          title: "Characteristics of living organisms",
          slug: "characteristics",
          topics: [
            {
              topic: "Characteristics of Living Organisms",
              key: "characteristics-of-living-organisms",
              tier: ["foundation"],
              requiredPractical: false,
            },
          ],
        },
      ],
    },
    {
      unit: "Cell Biology",
      topics: [
        {
          topic: "Cell structure",
          key: "cell-structure",
          tier: ["foundation"],
          requiredPractical: false,
        },
      ],
      sections: [],
    },
  ],
} as TaxonomyResponse;

describe("section-aware taxonomy helpers", () => {
  it("getUnitTopics merges flat and section-nested topics", () => {
    expect(getUnitTopics(edexcelLikeTaxonomy.units[0]).map((t) => t.key)).toEqual([
      "characteristics-of-living-organisms",
    ]);
    expect(getUnitTopics(edexcelLikeTaxonomy.units[1]).map((t) => t.key)).toEqual(["cell-structure"]);
  });

  it("getTaxonomyOptionGroups omits empty unit-only groups and surfaces section topics", () => {
    const groups = getTaxonomyOptionGroups(edexcelLikeTaxonomy);
    expect(groups.map((g) => g.label)).toEqual([
      "The nature and variety of living organisms — Characteristics of living organisms",
      "Cell Biology",
    ]);
    expect(groups[0].topics[0].key).toBe("characteristics-of-living-organisms");
    expect(groups[1].topics[0].key).toBe("cell-structure");
  });

  it("getTaxonomyTopicsFlat and getTaxonomyKeyToTopic include section topics", () => {
    const flat = getTaxonomyTopicsFlat(edexcelLikeTaxonomy);
    expect(flat.map((t) => t.key)).toEqual([
      "characteristics-of-living-organisms",
      "cell-structure",
    ]);
    expect(getTaxonomyKeyToTopic(edexcelLikeTaxonomy)).toEqual({
      "characteristics-of-living-organisms": "Characteristics of Living Organisms",
      "cell-structure": "Cell structure",
    });
  });
});
