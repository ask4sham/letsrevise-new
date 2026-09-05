/**
 * Guard against drift between backend (CJS) and frontend (TS) Block 28 policy mirrors.
 */
const fs = require("fs");
const path = require("path");
const backendPolicy = require("../../lib/block28PracticePolicy");

const FRONTEND_POLICY_PATH = path.join(
  __dirname,
  "../../frontend/src/lib/block28PracticePolicy.ts"
);

function readFrontendSupportedTypes() {
  const src = fs.readFileSync(FRONTEND_POLICY_PATH, "utf8");
  const match = src.match(
    /BLOCK28_SUPPORTED_TYPES\s*=\s*new Set\(\[([^\]]+)\]\)/
  );
  if (!match) throw new Error("Could not parse BLOCK28_SUPPORTED_TYPES from frontend policy");
  return match[1]
    .split(",")
    .map((s) => s.replace(/["'\s]/g, ""))
    .filter(Boolean)
    .sort();
}

function readFrontendUnsupportedTypes() {
  const src = fs.readFileSync(FRONTEND_POLICY_PATH, "utf8");
  const match = src.match(
    /BLOCK28_UNSUPPORTED_TYPES\s*=\s*new Set\(\[([^\]]+)\]\)/
  );
  if (!match) throw new Error("Could not parse BLOCK28_UNSUPPORTED_TYPES from frontend policy");
  return match[1]
    .split(",")
    .map((s) => s.replace(/["'\s]/g, ""))
    .filter(Boolean)
    .sort();
}

describe("block28PracticePolicy frontend/backend parity", () => {
  test("supported and unsupported type sets match", () => {
    const backendSupported = [...backendPolicy.BLOCK28_SUPPORTED_TYPES].sort();
    const backendUnsupported = [...backendPolicy.BLOCK28_UNSUPPORTED_TYPES].sort();
    expect(readFrontendSupportedTypes()).toEqual(backendSupported);
    expect(readFrontendUnsupportedTypes()).toEqual(backendUnsupported);
  });

  test("short invariant semantics match on representative cases", () => {
    const cases = [
      { marks: 4, scheme: ["A", "B", "C", "D"], expectOk: true },
      { marks: 4, scheme: ["A", "B"], expectOk: false },
      { marks: 2, scheme: ["A", "", "B"], expectOk: true },
    ];

    const frontendSrc = fs.readFileSync(FRONTEND_POLICY_PATH, "utf8");
    expect(frontendSrc).toContain("markScheme.length !== marks");
    expect(frontendSrc).toContain("normalizeMarkSchemeLines");

    for (const c of cases) {
      const out = backendPolicy.validateShortMarksMarkSchemeInvariant(c.marks, c.scheme);
      expect(out.ok).toBe(c.expectOk);
    }
  });
});
