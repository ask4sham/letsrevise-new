/**
 * Block 28 Integrity Gate V2 — unit tests.
 */
const {
  validateBlock28ShortForPersist,
  validateBlock28ShortForAttach,
  validateBlock28MasterForAttach,
} = require("../../lib/block28IntegrityGate");

describe("block28IntegrityGate", () => {
  test("rejects marks != scheme length without padding", () => {
    const out = validateBlock28ShortForPersist({
      marks: 4,
      markScheme: ["one point"],
      type: "short",
    });
    expect(out.ok).toBe(false);
    expect(out.code).toBe("MARK_SCHEME_COUNT_MISMATCH");
  });

  test("accepts valid short invariant", () => {
    const out = validateBlock28ShortForPersist({
      marks: 2,
      markScheme: ["Point A", "Point B"],
      type: "short",
    });
    expect(out.ok).toBe(true);
    expect(out.marks).toBe(2);
    expect(out.markScheme).toHaveLength(2);
  });

  test("trims empty scheme lines before validation", () => {
    const out = validateBlock28ShortForPersist({
      marks: 2,
      markScheme: [" Point A ", "", "Point B"],
      type: "short",
    });
    expect(out.ok).toBe(true);
    expect(out.markScheme).toEqual(["Point A", "Point B"]);
  });

  test("rejects unsupported type for attach", () => {
    const out = validateBlock28ShortForAttach({ type: "composite", marks: 2, markScheme: ["a", "b"] });
    expect(out.ok).toBe(false);
    expect(out.code).toBe("UNSUPPORTED_TYPE");
  });

  test("master attach rejects invalid short effective content", () => {
    const out = validateBlock28MasterForAttach(
      {
        _id: "abc",
        type: "short",
        question: "Explain DNA replication?",
        marks: 4,
        markScheme: ["one"],
      },
      null
    );
    expect(out.ok).toBe(false);
  });
});
