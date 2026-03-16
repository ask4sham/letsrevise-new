/**
 * Spec Document Ingestion Service tests.
 * Tests: raw sections normalize, duplicate skip, high-confidence mapping, unmapped, dryRun.
 */
const path = require("path");
const fs = require("fs");
const {
  extractRawSpecSections,
  normalizeSpecStatements,
  mapStatementsToTopics,
  makeCanonicalKey,
} = require("../services/specDocumentIngestionService");

describe("specDocumentIngestionService", () => {
  describe("extractRawSpecSections", () => {
    it("extracts markdown headings and bullet content", () => {
      const text = `
## Cell structure
- Describe the structure of eukaryotic cells
- Explain how mitochondria function

## Photosynthesis
- Describe the process of photosynthesis
`;
      const sections = extractRawSpecSections("test.md", text);
      expect(sections.length).toBeGreaterThanOrEqual(2);
      const cell = sections.find((s) => /cell/i.test(s.heading));
      expect(cell).toBeDefined();
      expect(cell.content.some((c) => /eukaryotic/i.test(c))).toBe(true);
    });

    it("extracts bullet and statement-like lines as content", () => {
      const text = `
## Topic
- First statement about cells and their structure
- Second statement about mitochondria
`;
      const sections = extractRawSpecSections("test.txt", text);
      expect(sections.length).toBeGreaterThanOrEqual(1);
      expect(sections.some((s) => s.content.some((c) => /First statement/i.test(c)))).toBe(true);
    });
  });

  describe("normalizeSpecStatements", () => {
    it("normalizes raw sections into statements", () => {
      const raw = [
        { heading: "Cell structure", level: 2, content: ["Describe cells", "Explain mitochondria"], pageHint: null },
      ];
      const out = normalizeSpecStatements(raw, "aqa-gcse-biology", "Biology", "spec.pdf");
      expect(out.length).toBe(2);
      expect(out[0].statementText).toContain("Describe cells");
      expect(out[0].sourceSectionHeading).toBe("Cell structure");
      expect(out[0].statementType).toBe("core");
    });

    it("detects required_practical type", () => {
      const raw = [
        { heading: "Required Practical: Microscopy", level: 2, content: ["Use a light microscope"], pageHint: null },
      ];
      const out = normalizeSpecStatements(raw, "aqa-gcse-biology", "Biology", "spec.pdf");
      expect(out.length).toBe(1);
      expect(out[0].statementType).toBe("required_practical");
    });
  });

  describe("mapStatementsToTopics", () => {
    it("maps statement with exact heading match to topic (high confidence)", () => {
      const statements = [
        {
          statementText: "Describe the structure of eukaryotic cells",
          sourceSectionHeading: "Cell structure",
          sourcePageNumber: null,
          statementType: "core",
          sourceDocumentName: "spec.pdf",
        },
      ];
      const mapped = mapStatementsToTopics(statements, "aqa-gcse-biology");
      expect(mapped.length).toBe(1);
      const m = mapped[0];
      expect(m.topicKey).toBe("cell-structure");
      expect(m.confidence).toBe("high");
    });

    it("returns unmapped for unknown heading", () => {
      const statements = [
        {
          statementText: "Some obscure curriculum point",
          sourceSectionHeading: "Unknown Section XYZ",
          sourcePageNumber: null,
          statementType: "core",
          sourceDocumentName: "spec.pdf",
        },
      ];
      const mapped = mapStatementsToTopics(statements, "aqa-gcse-biology");
      expect(mapped.length).toBe(1);
      expect(mapped[0].topicKey).toBeNull();
      expect(mapped[0].confidence).toBe("low");
    });
  });

  describe("makeCanonicalKey", () => {
    it("produces deterministic hash", () => {
      const k1 = makeCanonicalKey("aqa-gcse-biology", "cell-structure", "Describe cells");
      const k2 = makeCanonicalKey("aqa-gcse-biology", "cell-structure", "Describe cells");
      expect(k1).toBe(k2);
      expect(k1.length).toBe(32);
    });

    it("differs for different content", () => {
      const k1 = makeCanonicalKey("aqa-gcse-biology", "cell-structure", "Describe cells");
      const k2 = makeCanonicalKey("aqa-gcse-biology", "cell-structure", "Explain cells");
      expect(k1).not.toBe(k2);
    });
  });
});
