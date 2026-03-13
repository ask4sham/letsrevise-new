/**
 * Unit tests for topic drift validation (strict taxonomy scoping).
 * Ensures generated content stays within the selected sub-topic.
 */
const {
  validateGeneratedContentAgainstTopic,
  buildStrongDriftPhrases,
  extractTextFromLesson,
} = require("../utils/topicDriftValidation");

describe("topicDriftValidation", () => {
  const specKey = "aqa-gcse-biology";

  describe("validateGeneratedContentAgainstTopic", () => {
    test("returns valid when topicKey or specKey missing", () => {
      expect(validateGeneratedContentAgainstTopic({})).toEqual({
        valid: true,
        warnings: [],
        driftedPhrases: [],
      });
      expect(validateGeneratedContentAgainstTopic({ topicKey: "cell-structure" })).toEqual({
        valid: true,
        warnings: [],
        driftedPhrases: [],
      });
      expect(validateGeneratedContentAgainstTopic({ specKey })).toEqual({
        valid: true,
        warnings: [],
        driftedPhrases: [],
      });
    });

    test("returns valid when content is within cell-structure sub-topic", () => {
      const result = validateGeneratedContentAgainstTopic({
        topicKey: "cell-structure",
        specKey,
        subTopicLabel: "Cell structure",
        pages: [
          {
            blocks: [
              { content: "Eukaryotic cells have a nucleus, cytoplasm, and cell membrane." },
              { content: "Plant cells also have a cell wall and chloroplasts." },
            ],
          },
        ],
      });
      expect(result.valid).toBe(true);
      expect(result.driftedPhrases).toEqual([]);
    });

    test("flags drift when cell-structure content includes mitosis repeatedly", () => {
      const result = validateGeneratedContentAgainstTopic({
        topicKey: "cell-structure",
        specKey,
        subTopicLabel: "Cell structure",
        pages: [
          {
            blocks: [
              { content: "Cells have a nucleus. Mitosis is the process of cell division. Mitosis produces two identical cells." },
            ],
          },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.driftedPhrases).toContain("mitosis");
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toMatch(/drifted|sub-topic/i);
    });

    test("flags drift when content includes osmosis (sibling of cell-structure)", () => {
      // Need 2+ occurrences for short phrases; "osmotic" (7 chars) needs 2, "osmosis" (7) needs 2
      const result = validateGeneratedContentAgainstTopic({
        topicKey: "cell-structure",
        specKey,
        pages: [
          {
            blocks: [
              { content: "The cell membrane controls what enters. Osmosis is the movement of water. Osmosis occurs across membranes. Osmotic pressure affects cells." },
            ],
          },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.driftedPhrases.some((p) => p.includes("osmosis") || p.includes("osmotic"))).toBe(true);
    });

    test("flags drift when quiz questions mention stem cells", () => {
      const result = validateGeneratedContentAgainstTopic({
        topicKey: "cell-structure",
        specKey,
        textBlocks: ["Cells have a nucleus."],
        quizItems: [
          { question: "What is a stem cell? Stem cells can differentiate.", options: ["A", "B", "C", "D"] },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.driftedPhrases.some((p) => p.includes("stem"))).toBe(true);
    });

    test("REGRESSION: Cell Biology → Cell structure — expected terms pass, sibling terms fail", () => {
      // Expected: cell membrane, cytoplasm, nucleus, ribosomes, prokaryotic, eukaryotic
      const validContent = validateGeneratedContentAgainstTopic({
        topicKey: "cell-structure",
        specKey,
        pages: [
          {
            blocks: [
              {
                content:
                  "Eukaryotic cells have a nucleus, cytoplasm, and cell membrane. Prokaryotic cells lack a nucleus. Ribosomes are found in both.",
              },
            ],
          },
        ],
      });
      expect(validContent.valid).toBe(true);
      expect(validContent.driftedPhrases).toEqual([]);

      // Must NOT appear: mitosis, cell cycle, osmosis, diffusion, stem cells, microscopy
      const mitosisContent = validateGeneratedContentAgainstTopic({
        topicKey: "cell-structure",
        specKey,
        pages: [{ blocks: [{ content: "Cell membrane. Mitosis divides cells. Mitosis produces daughter cells." }] }],
      });
      expect(mitosisContent.valid).toBe(false);
      expect(mitosisContent.driftedPhrases).toContain("mitosis");

      const osmosisContent = validateGeneratedContentAgainstTopic({
        topicKey: "cell-structure",
        specKey,
        pages: [
          {
            blocks: [
              {
                content:
                  "The cell membrane is selectively permeable. Osmosis is water movement. Osmosis occurs across membranes. Osmotic pressure affects cells.",
              },
            ],
          },
        ],
      });
      expect(osmosisContent.valid).toBe(false);
      expect(osmosisContent.driftedPhrases.some((p) => p.includes("osmosis") || p.includes("osmotic"))).toBe(true);

      const microscopyContent = validateGeneratedContentAgainstTopic({
        topicKey: "cell-structure",
        specKey,
        pages: [{ blocks: [{ content: "Cells can be viewed with light microscopy and electron microscopy. Magnification reveals detail." }] }],
      });
      expect(microscopyContent.valid).toBe(false);
      expect(microscopyContent.driftedPhrases.some((p) => p.includes("microscopy") || p.includes("magnification"))).toBe(true);
    });

    test("returns valid for diffusion topic (not sibling drift)", () => {
      const result = validateGeneratedContentAgainstTopic({
        topicKey: "diffusion",
        specKey,
        pages: [
          {
            blocks: [
              { content: "Diffusion is the movement of particles from high to low concentration. It occurs in cells." },
            ],
          },
        ],
      });
      expect(result.valid).toBe(true);
    });

    test("flags drift when biodiversity content includes deforestation (different main/sub-topic pair)", () => {
      const result = validateGeneratedContentAgainstTopic({
        topicKey: "biodiversity",
        specKey,
        subTopicLabel: "Biodiversity",
        pages: [
          {
            blocks: [
              { content: "Biodiversity is the variety of life. Deforestation reduces biodiversity. Deforestation destroys habitats." },
            ],
          },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.driftedPhrases.some((p) => p.includes("deforestation"))).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("buildStrongDriftPhrases", () => {
    test("builds phrases from sibling keys", () => {
      const phrases = buildStrongDriftPhrases(["mitosis-cell-cycle", "stem-cells"]);
      expect(phrases).toContain("mitosis");
      expect(phrases).toContain("cell cycle");
      expect(phrases).toContain("stem cell");
    });

    test("deduplicates phrases when same key passed multiple times", () => {
      const phrases = buildStrongDriftPhrases(["stem-cells", "stem-cells"]);
      const stemPhrases = phrases.filter((p) => p.includes("stem"));
      // stem-cells adds: stem cell, stem cells, embryonic stem (3 phrases, each added once)
      expect(stemPhrases.length).toBe(3);
      expect(new Set(phrases).size).toBe(phrases.length);
    });
  });

  describe("extractTextFromLesson", () => {
    test("extracts content from blocks", () => {
      const text = extractTextFromLesson([
        { blocks: [{ content: "Hello" }, { content: "World" }] },
      ]);
      expect(text).toContain("hello");
      expect(text).toContain("world");
    });

    test("extracts checkpoint prompt and question", () => {
      const text = extractTextFromLesson([
        {
          blocks: [],
          checkpoint: { prompt: "Check this", question: "What is it?" },
        },
      ]);
      expect(text).toContain("check this");
      expect(text).toContain("what is it");
    });

    test("returns empty string for empty or invalid input", () => {
      expect(extractTextFromLesson([])).toBe("");
      expect(extractTextFromLesson(null)).toBe("");
    });
  });
});
