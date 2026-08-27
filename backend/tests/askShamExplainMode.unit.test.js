/**
 * Ask Sham — direct AI answer path (no lesson retrieval for students).
 */
const path = require("path");
const backendRoot = path.join(__dirname, "..");

jest.mock("axios", () => ({
  post: jest.fn(),
}));

const axios = require("axios");

/** Test-only: classify mitosis-timing answers (not used in production). */
function isWrongMitosisReplicationTiming(text) {
  const t = String(text || "").toLowerCase();
  // Wrong: replication verbs tied to "during/in mitosis" (not already-duplicated chromosomes being separated).
  if (
    /\b(during|in)\s+mitosis\b[^.]{0,140}\b(are|is|get|become|were|was)\s+(duplicat\w*|replicat\w*|copied)\b/i.test(
      t
    )
  ) {
    return true;
  }
  if (
    /\b(duplicat\w*|replicat\w*|cop(?:y|ied|ies))\b[^.]{0,60}\b(during|in)\s+mitosis\b/i.test(t) &&
    !/\bduplicat\w*\s+(chromosomes?|chromatids?)\b[^.]{0,80}\b(separat|divid|split|pull)/i.test(t)
  ) {
    return true;
  }
  return false;
}

function isAcceptableMitosisTiming(text) {
  if (isWrongMitosisReplicationTiming(text)) return false;
  const t = String(text || "").toLowerCase();
  const replicationBefore =
    /\b(before|prior to|preceding)\s+mitosis\b/i.test(t) ||
    /\b(interphase|s phase)\b/i.test(t);
  const separationDuring =
    /\b(during|in)\s+mitosis\b[\s\S]{0,120}\b(separat|divid|split|pull)/i.test(t) ||
    /\b(separat|divid|split|pull)[\s\S]{0,120}\b(during|in)\s+mitosis\b/i.test(t);
  const identicalDaughters = /\b(identical|same)\b[\s\S]{0,60}\b(daughter|cell)/i.test(t);
  return replicationBefore || separationDuring || identicalDaughters;
}

describe("Ask Sham direct AI answer path", () => {
  const prevProvider = process.env.LLM_PROVIDER;
  const prevApiKey = process.env.LLM_API_KEY;
  const prevOpenAiKey = process.env.OPENAI_API_KEY;

  beforeAll(() => {
    process.env.LLM_PROVIDER = "mock";
  });

  afterAll(() => {
    if (prevProvider == null) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = prevProvider;
    if (prevApiKey == null) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = prevApiKey;
    if (prevOpenAiKey == null) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevOpenAiKey;
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

describe("Ask Sham V1 system prompt contract", () => {
  test("includes factual accuracy and process-timing requirements", () => {
    const { buildDirectStudentAskShamSystemPrompt } = require(path.join(
      backendRoot,
      "services/llm/provider"
    ));
    const prompt = buildDirectStudentAskShamSystemPrompt();

    expect(prompt).toMatch(/factually accurate/i);
    expect(prompt).toMatch(/check factual claims/i);
    expect(prompt).toMatch(/process or sequence/i);
    expect(prompt).toMatch(/preparation \(before\)/i);
    expect(prompt).toMatch(/process itself \(during\)/i);
    expect(prompt).toMatch(/result \(after\)/i);
    expect(prompt).toMatch(/Do not merge events from different stages/i);
    expect(prompt).toMatch(/omit it or state the uncertainty rather than guessing/i);
    expect(prompt).toMatch(/Keep the answer concise/i);
    expect(prompt).toMatch(/GCSE students aged 15–16/i);
    expect(prompt).toMatch(/Return valid JSON only/i);
  });

  test("includes presentation and Markdown formatting guidance", () => {
    const { buildDirectStudentAskShamSystemPrompt } = require(path.join(
      backendRoot,
      "services/llm/provider"
    ));
    const prompt = buildDirectStudentAskShamSystemPrompt();

    expect(prompt).toMatch(/Presentation:/i);
    expect(prompt).toMatch(/short Markdown paragraphs/i);
    expect(prompt).toMatch(/several points, stages, reasons, comparisons, steps, or exam reminders/i);
    expect(prompt).toMatch(/bullet or numbered line/i);
    expect(prompt).toMatch(/blank line before a list/i);
    expect(prompt).toMatch(/\*\*bold\*\* sparingly/i);
    expect(prompt).toMatch(/Do not force a list for a simple one- or two-sentence answer/i);
    expect(prompt).toMatch(/Avoid excessive headings, decoration, or unnecessary formatting/i);
    expect(prompt).toMatch(/\{ "explanation": "\.\.\." \}/);
  });

  test("does not hard-code topic-specific biology correction text", () => {
    const { buildDirectStudentAskShamSystemPrompt } = require(path.join(
      backendRoot,
      "services/llm/provider"
    ));
    const prompt = buildDirectStudentAskShamSystemPrompt().toLowerCase();

    expect(prompt).not.toContain("mitosis");
    expect(prompt).not.toContain("interphase");
    expect(prompt).not.toContain("chromosome");
    expect(prompt).not.toContain("dna replication");
    expect(prompt).not.toContain("biology");
    expect(prompt).not.toContain("photosynthesis");
    expect(prompt).not.toContain("respiration");
    expect(prompt).not.toContain("aqa");
    expect(prompt).not.toContain("edexcel");
    expect(prompt).not.toContain("ocr");
  });
});

describe("Ask Sham mitosis regression fixtures (test-only)", () => {
  test("rejects scientifically wrong replication-during-mitosis phrasing", () => {
    const wrong =
      "Mitosis is a process of cell division that results in two identical daughter cells. During mitosis, the cell's chromosomes are duplicated and then evenly divided between the two new cells.";
    expect(isWrongMitosisReplicationTiming(wrong)).toBe(true);
    expect(isAcceptableMitosisTiming(wrong)).toBe(false);
  });

  test("accepts correct before/during separation phrasing", () => {
    const good =
      "Mitosis produces two genetically identical daughter cells with the same chromosome number as the parent. Before mitosis, DNA is copied during interphase. During mitosis, the duplicated chromosomes are separated into two nuclei.";
    expect(isWrongMitosisReplicationTiming(good)).toBe(false);
    expect(isAcceptableMitosisTiming(good)).toBe(true);
  });
});

describe("Ask Sham openai path sends hardened prompt for mitosis question", () => {
  const prevProvider = process.env.LLM_PROVIDER;
  const prevApiKey = process.env.LLM_API_KEY;
  const prevOpenAiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    axios.post.mockReset();
    axios.post.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                explanation:
                  "Before mitosis, DNA is copied during interphase. During mitosis, duplicated chromosomes are separated so two genetically identical daughter cells form.",
              }),
            },
          },
        ],
      },
    });
    process.env.LLM_PROVIDER = "openai";
    process.env.LLM_API_KEY = "test-key-for-unit-test";
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (prevProvider == null) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = prevProvider;
    if (prevApiKey == null) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = prevApiKey;
    if (prevOpenAiKey == null) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevOpenAiKey;
  });

  test("What is mitosis? uses strengthened subject-agnostic system prompt", async () => {
    axios.post.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                explanation:
                  "Before mitosis, DNA is copied during interphase. During mitosis, duplicated chromosomes are separated so two genetically identical daughter cells form.",
              }),
            },
          },
        ],
      },
    });

    const { generateDirectStudentAskShamAnswer, buildDirectStudentAskShamSystemPrompt } = require(
      path.join(backendRoot, "services/llm/provider")
    );

    const out = await generateDirectStudentAskShamAnswer({
      question: "What is mitosis?",
      constraints: { specKey: "aqa-gcse-biology", topicKey: "aqa-gcse-biology:mitosis-cell-cycle" },
    });

    expect(axios.post).toHaveBeenCalledTimes(1);
    const payload = axios.post.mock.calls[0][1];
    const systemMsg = payload.messages.find((m) => m.role === "system")?.content || "";
    expect(systemMsg).toBe(buildDirectStudentAskShamSystemPrompt());
    expect(systemMsg).toMatch(/Do not merge events from different stages/i);
    expect(systemMsg).toMatch(/Presentation:/i);
    expect(systemMsg).toMatch(/short Markdown paragraphs/i);
    expect(systemMsg).toMatch(/bullet or numbered line/i);
    expect(systemMsg.toLowerCase()).not.toContain("mitosis");

    const userMsg = payload.messages.find((m) => m.role === "user")?.content || "";
    expect(userMsg).toContain("What is mitosis?");

    expect(isWrongMitosisReplicationTiming(out.explanation)).toBe(false);
    expect(isAcceptableMitosisTiming(out.explanation)).toBe(true);
  });
});
