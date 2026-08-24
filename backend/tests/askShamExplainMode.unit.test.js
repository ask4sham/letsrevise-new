/**
 * Ask Sham — direct AI answer path (no lesson retrieval for students).
 */
const path = require("path");
const backendRoot = path.join(__dirname, "..");

describe("Ask Sham direct AI answer path", () => {
  const prevProvider = process.env.LLM_PROVIDER;

  beforeAll(() => {
    process.env.LLM_PROVIDER = "mock";
  });

  afterAll(() => {
    if (prevProvider == null) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = prevProvider;
  });

  test("direct student mock returns simple test answer without retrieval chunks", async () => {
    const { generateDirectStudentAskShamAnswer } = require(path.join(
      backendRoot,
      "services/llm/provider"
    ));
    const out = await generateDirectStudentAskShamAnswer({
      question: "Can you explain why gametes are important during fertilisation?",
      constraints: {},
    });
    expect(out.explanation).toBe("This is a simple Ask Sham test answer.");
    expect(out.practice).toEqual([]);
    expect(out.citations).toEqual([]);
    expect(out.warnings).toEqual([]);
  });

  test("direct student answer does not require context chunks or weak-evidence gate", async () => {
    const { generateDirectStudentAskShamAnswer } = require(path.join(
      backendRoot,
      "services/llm/provider"
    ));
    const out = await generateDirectStudentAskShamAnswer({
      question: "What is photosynthesis?",
      constraints: { specKey: "example-spec", topicKey: "example-spec:topic/a" },
    });
    expect(String(out.explanation || "").length).toBeGreaterThan(5);
    expect(out.practice).toEqual([]);
  });

  test("student enquiry handler uses direct path before retrieval (static contract)", () => {
    const controllerSrc = require("fs").readFileSync(
      path.join(backendRoot, "controllers/enquiry.controller.js"),
      "utf8"
    );
    expect(controllerSrc).toContain("generateDirectStudentAskShamAnswer");
    expect(controllerSrc).toMatch(/if \(isStudentUser\) \{[\s\S]*generateDirectStudentAskShamAnswer/);
    expect(controllerSrc).toMatch(/Ask Sham V1 — direct AI for students/);
    expect(controllerSrc).not.toContain("enrichStudentMetaQuestionRetrievalQuery");
  });

  test("grounding gate module remains available for non-student paths", () => {
    const { shouldShortCircuitUngroundedStudentAnswer } = require(path.join(
      backendRoot,
      "services/enquiry/enquiryGroundingGate"
    ));
    expect(
      shouldShortCircuitUngroundedStudentAnswer({
        isStudentUser: true,
        weakEvidence: true,
      })
    ).toBe(true);
  });
});
