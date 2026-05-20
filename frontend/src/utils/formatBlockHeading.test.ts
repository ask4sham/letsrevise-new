import {
  formatStudentBlockHeading,
  normalizeLegacyBlockLabel,
  normalizeLegacySs1Heading,
  normalizePersistedBlockTitle,
} from "./formatBlockHeading";

describe("normalizeLegacyBlockLabel", () => {
  it("renames Core teaching variants to Core Learning", () => {
    expect(normalizeLegacyBlockLabel("CORE TEACHING")).toBe("CORE LEARNING");
    expect(normalizeLegacyBlockLabel("Core Teaching")).toBe("Core Learning");
    expect(normalizeLegacyBlockLabel("Core teaching")).toBe("Core Learning");
  });

  it("renames Scenario / Hook to Scenario", () => {
    expect(normalizeLegacyBlockLabel("SCENARIO / HOOK")).toBe("SCENARIO");
    expect(normalizeLegacyBlockLabel("Scenario / Hook")).toBe("Scenario");
  });

  it("leaves unrelated labels unchanged", () => {
    expect(normalizeLegacyBlockLabel("Core rule")).toBe("Core rule");
    expect(normalizeLegacyBlockLabel("Hook")).toBe("Hook");
  });
});

describe("legacy SS1 headings", () => {
  it("renames numbered legacy titles", () => {
    expect(normalizeLegacySs1Heading("5 — CORE TEACHING")).toBe("5 — CORE LEARNING");
    expect(normalizeLegacySs1Heading("4 — SCENARIO / HOOK")).toBe("4 — SCENARIO");
    expect(formatStudentBlockHeading({ number: 5, title: "CORE TEACHING" })).toBe(
      "5 — CORE LEARNING"
    );
    expect(normalizePersistedBlockTitle({ title: "Core teaching" }).title).toBe("Core Learning");
  });
});
