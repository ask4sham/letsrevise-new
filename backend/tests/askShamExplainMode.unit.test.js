/**
 * Ask Sham — Explain mode must not force practice; cache keys keep responseMode.
 */
const path = require("path");
const backendRoot = path.join(__dirname, "..");

describe("Ask Sham explain-mode practice contract", () => {
  const prevProvider = process.env.LLM_PROVIDER;

  beforeAll(() => {
    process.env.LLM_PROVIDER = "mock";
  });

  afterAll(() => {
    if (prevProvider == null) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = prevProvider;
  });

  test("explain + includePractice false → explanation present, practice empty", async () => {
    const { generateEnquiryAnswer } = require(path.join(backendRoot, "services/llm/provider"));
    const out = await generateEnquiryAnswer({
      question: "How does sexual reproduction differ from asexual reproduction?",
      contextChunks: [
        {
          knowledgeDocumentId: "kd1",
          sourceType: "lessonBlock",
          sourceId: "b1",
          topicKey: "edexcel-igcse-biology:sexual-and-asexual-reproduction-differences",
          text: "Sexual reproduction involves gametes and fertilisation; asexual produces clones by mitosis.",
        },
      ],
      constraints: {
        includePractice: false,
        studentMode: true,
        responseMode: "explain",
      },
    });
    expect(String(out.explanation || "").length).toBeGreaterThan(20);
    expect(Array.isArray(out.practice)).toBe(true);
    expect(out.practice).toEqual([]);
  });

  test("quick + includePractice true → practice may be present after answer", async () => {
    const { generateEnquiryAnswer } = require(path.join(backendRoot, "services/llm/provider"));
    const out = await generateEnquiryAnswer({
      question: "What is asexual reproduction?",
      contextChunks: [
        {
          knowledgeDocumentId: "kd1",
          sourceType: "lessonBlock",
          sourceId: "b1",
          topicKey: "edexcel-igcse-biology:sexual-and-asexual-reproduction-differences",
          text: "Asexual reproduction involves one parent and produces genetically identical offspring.",
        },
      ],
      constraints: {
        includePractice: true,
        studentMode: true,
        responseMode: "quick",
      },
    });
    expect(String(out.explanation || "").length).toBeGreaterThan(5);
    expect(Array.isArray(out.practice)).toBe(true);
    expect(out.practice.length).toBeGreaterThan(0);
  });

  test("revision + includePractice true → flashcards available", async () => {
    const { generateEnquiryAnswer } = require(path.join(backendRoot, "services/llm/provider"));
    const out = await generateEnquiryAnswer({
      question: "Revise sexual vs asexual reproduction",
      contextChunks: [
        {
          knowledgeDocumentId: "kd1",
          sourceType: "lessonBlock",
          sourceId: "b1",
          topicKey: "edexcel-igcse-biology:sexual-and-asexual-reproduction-differences",
          text: "Sexual vs asexual: variation versus clones.",
        },
      ],
      constraints: {
        includePractice: true,
        studentMode: true,
        responseMode: "revision",
      },
    });
    expect(String(out.explanation || "").length).toBeGreaterThan(5);
    expect(out.practice.some((p) => p.type === "flashcard")).toBe(true);
  });

  test("fail-closed ungrounded student answer still has no practice-first requirement", () => {
    const { buildUngroundedStudentAnswer } = require(path.join(
      backendRoot,
      "services/enquiry/enquiryGroundingGate"
    ));
    const answer = buildUngroundedStudentAnswer({ nearestTopicKey: null });
    expect(Array.isArray(answer.practice)).toBe(true);
    expect(answer.warnings.some((w) => /insufficient trusted sources/i.test(w))).toBe(true);
  });

  test("cache key includes responseMode so modes do not collide", () => {
    const { buildCacheKey } = require(path.join(backendRoot, "services/enquiry/enquiryCache"));
    const e = buildCacheKey("spec", "topic", "lesson", "q", null, "explain", false, "L1", "student");
    const q = buildCacheKey("spec", "topic", "lesson", "q", null, "quick", false, "L1", "student");
    const r = buildCacheKey("spec", "topic", "lesson", "q", null, "revision", false, "L1", "student");
    expect(e).not.toBe(q);
    expect(e).not.toBe(r);
    expect(q).not.toBe(r);
  });
});
