/**
 * Frontend tests: V2.3B1 read-only MCQ rationale review page.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminMcqRationaleReviewPage from "./AdminMcqRationaleReviewPage";
import AdminMcqRationaleInventoryPage from "./AdminMcqRationaleInventoryPage";

jest.mock("../hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ user: { userType: "admin" } }),
}));

const mockFetchReview = jest.fn();
jest.mock("../api/mcqRationaleReviewContext", () => ({
  fetchMcqRationaleReviewContext: (...args: unknown[]) => mockFetchReview(...args),
}));

const mockFetchInventory = jest.fn();
jest.mock("../api/mcqRationaleInventory", () => ({
  fetchMcqRationaleInventory: (...args: unknown[]) => mockFetchInventory(...args),
}));

function renderReview(path = "/admin/exam-question-rationale-inventory/qid123/a/review") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin/exam-question-rationale-inventory/:questionId/:partLabel/review"
          element={<AdminMcqRationaleReviewPage />}
        />
        <Route path="/admin/exam-question-rationale-inventory" element={<div>Inventory</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const baseContext = {
  questionId: "qid123",
  partLabel: "a",
  taxonomy: {
    subject: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    tier: "",
    topic: "Photosynthesis",
    topicKey: "photosynthesis",
  },
  questionStatus: "draft",
  sharedStem: "A plant is placed in different conditions.",
  questionText: "Which factor is essential?",
  options: [
    { index: 0, text: "Water", isCorrect: false },
    { index: 1, text: "Oxygen", isCorrect: false },
    { index: 2, text: "Light", isCorrect: true },
    { index: 3, text: "Temperature", isCorrect: false },
  ],
  correctIndex: 2,
  correctOption: "Light",
  marks: 1,
  markScheme: ["Award 1 mark for selecting Light."],
  currentRationale: null,
  rationaleBucket: "missing" as const,
  potentiallyEligibleForBackfill: true,
  currentSourceFingerprint: "b".repeat(64),
  sourceUpdatedAt: new Date().toISOString(),
  imageContextAvailable: false,
  imageContextRequired: false,
  generationFeatureEnabled: false,
  publishedGenerationEnabled: false,
  canGenerate: true,
  canGenerateReason: "",
  latestCandidate: null,
  candidateIsStale: false,
  readOnly: true as const,
};

describe("AdminMcqRationaleReviewPage", () => {
  beforeEach(() => {
    mockFetchReview.mockReset();
    mockFetchReview.mockResolvedValue(baseContext);
  });

  test("loading then source metadata, question, options, correct indicator", async () => {
    renderReview();
    expect(screen.getByTestId("mcq-rationale-review-loading")).toBeInTheDocument();
    expect(await screen.findByTestId("mcq-rationale-review-body")).toBeInTheDocument();
    expect(screen.getByText("Biology")).toBeInTheDocument();
    expect(screen.getByTestId("mcq-rationale-review-shared-stem")).toHaveTextContent(/plant is placed/i);
    expect(screen.getByTestId("mcq-rationale-review-question-text")).toHaveTextContent(/Which factor/);
    expect(screen.getByTestId("mcq-rationale-review-options")).toBeInTheDocument();
    expect(screen.getByTestId("mcq-rationale-review-correct-badge")).toHaveTextContent(/Correct answer/i);
    expect(screen.getByTestId("mcq-rationale-review-mark-scheme")).toHaveTextContent(/Award 1 mark/);
    expect(screen.getByTestId("mcq-rationale-review-current-rationale")).toHaveTextContent(
      /No rationale currently stored/
    );
    expect(screen.getByTestId("mcq-rationale-review-candidate-empty")).toBeInTheDocument();
    expect(screen.getByTestId("mcq-rationale-review-feature-disabled")).toHaveTextContent(
      /Candidate generation is currently disabled/
    );
    expect(screen.getByTestId("mcq-rationale-review-back")).toBeInTheDocument();
    expect(screen.getByTestId("mcq-rationale-review-readonly-notice")).toBeInTheDocument();
  });

  test("candidate explanation, pending status, stale warning", async () => {
    mockFetchReview.mockResolvedValue({
      ...baseContext,
      candidateIsStale: true,
      latestCandidate: {
        candidateId: "c1",
        questionId: "qid123",
        partLabel: "a",
        status: "pending",
        attemptNumber: 1,
        sourceFingerprint: "a".repeat(64),
        sourceUpdatedAt: null,
        sourceSnapshot: {},
        explanation: "Light is needed for photosynthesis.",
        promptVersion: "v1",
        model: "gpt-4o-mini",
        generatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        validationIssueCodes: [],
        failureCode: "",
      },
    });
    renderReview();
    expect(await screen.findByTestId("mcq-rationale-review-candidate-status")).toHaveTextContent("pending");
    expect(screen.getByTestId("mcq-rationale-review-candidate-explanation")).toHaveTextContent(/Light is needed/);
    expect(screen.getByTestId("mcq-rationale-review-stale-warning")).toBeInTheDocument();
  });

  test("failed candidate and image-context warning appears exactly once", async () => {
    mockFetchReview.mockResolvedValue({
      ...baseContext,
      imageContextRequired: true,
      canGenerate: false,
      canGenerateReason: "IMAGE_CONTEXT_REQUIRED",
      latestCandidate: {
        candidateId: "c2",
        questionId: "qid123",
        partLabel: "a",
        status: "failed",
        attemptNumber: 1,
        sourceFingerprint: "b".repeat(64),
        sourceUpdatedAt: null,
        sourceSnapshot: {},
        explanation: "",
        promptVersion: "v1",
        model: "gpt-4o-mini",
        generatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        validationIssueCodes: ["TOO_SHORT"],
        failureCode: "LLM_ERROR",
      },
    });
    renderReview();
    expect(await screen.findByTestId("mcq-rationale-review-candidate-status")).toHaveTextContent("failed");
    expect(screen.getByTestId("mcq-rationale-review-failure-code")).toHaveTextContent("LLM_ERROR");
    expect(screen.getByTestId("mcq-rationale-review-image-context-warning")).toBeInTheDocument();
    expect(screen.queryByTestId("mcq-rationale-review-can-generate-reason")).not.toBeInTheDocument();
    const matches = screen.getAllByText(/Trusted image context text is required/i);
    expect(matches).toHaveLength(1);
  });

  test("feature-disabled plus image-context: each notice once", async () => {
    mockFetchReview.mockResolvedValue({
      ...baseContext,
      generationFeatureEnabled: false,
      imageContextRequired: true,
      canGenerate: false,
      canGenerateReason: "IMAGE_CONTEXT_REQUIRED",
    });
    renderReview();
    expect(await screen.findByTestId("mcq-rationale-review-feature-disabled")).toBeInTheDocument();
    expect(screen.getByTestId("mcq-rationale-review-image-context-warning")).toBeInTheDocument();
    expect(screen.getAllByText(/Trusted image context text is required/i)).toHaveLength(1);
    expect(screen.getAllByText(/Candidate generation is currently disabled/i)).toHaveLength(1);
  });

  test("text-only context: no image-context warning", async () => {
    mockFetchReview.mockResolvedValue({
      ...baseContext,
      imageContextRequired: false,
      canGenerateReason: "",
      canGenerate: true,
    });
    renderReview();
    await screen.findByTestId("mcq-rationale-review-body");
    expect(screen.queryByTestId("mcq-rationale-review-image-context-warning")).not.toBeInTheDocument();
    expect(screen.queryByText(/Trusted image context text is required/i)).not.toBeInTheDocument();
  });

  test("published-disabled notice once without duplicate generic reason", async () => {
    mockFetchReview.mockResolvedValue({
      ...baseContext,
      questionStatus: "published",
      canGenerate: false,
      canGenerateReason: "PUBLISHED_NOT_ENABLED",
    });
    renderReview();
    expect(await screen.findByTestId("mcq-rationale-review-published-disabled")).toBeInTheDocument();
    expect(screen.queryByTestId("mcq-rationale-review-can-generate-reason")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Published-question candidate generation is not enabled/i)).toHaveLength(1);
  });

  test("other eligibility reason still displays once", async () => {
    mockFetchReview.mockResolvedValue({
      ...baseContext,
      canGenerate: false,
      canGenerateReason: "RATIONALE_SUBSTANTIVE",
      imageContextRequired: false,
      rationaleBucket: "substantive",
      potentiallyEligibleForBackfill: false,
    });
    renderReview();
    expect(await screen.findByTestId("mcq-rationale-review-can-generate-reason")).toHaveTextContent(
      /substantive rationale already exists/i
    );
  });

  test("API error", async () => {
    mockFetchReview.mockRejectedValue({
      message: "Network down",
      response: { status: 500, data: { error: "Server error", code: "SERVER_ERROR" } },
    });
    renderReview();
    expect(await screen.findByTestId("mcq-rationale-review-error")).toHaveTextContent(/Server error/);
  });

  test("malformed route", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/exam-question-rationale-inventory/%20/%20/review"]}>
        <Routes>
          <Route
            path="/admin/exam-question-rationale-inventory/:questionId/:partLabel/review"
            element={<AdminMcqRationaleReviewPage />}
          />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId("mcq-rationale-review-error")).toHaveTextContent(/missing a valid question/i);
    });
  });

  test("absence of mutation controls and editable fields", async () => {
    renderReview();
    await screen.findByTestId("mcq-rationale-review-body");
    expect(screen.queryByRole("button", { name: /generate|approve|reject|regenerate|save|publish|backfill/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /generate|approve|reject|regenerate|save/i })).not.toBeInTheDocument();
  });
});

describe("Inventory Review link rules", () => {
  beforeEach(() => {
    mockFetchInventory.mockReset();
  });

  test("Review link on eligible draft row only", async () => {
    mockFetchInventory.mockResolvedValue({
      page: 1,
      pageSize: 25,
      totalMatchingParts: 3,
      totalPages: 1,
      readOnly: true,
      linkedLessonCount: { available: false, deferred: true, reason: "deferred" },
      summary: {
        countUnit: "mcq_parts",
        totalCompositeQuestions: 3,
        totalCompositeMcqParts: 3,
        missing: 2,
        empty: 0,
        generic: 0,
        substantive: 1,
        malformed: 0,
        potentiallyEligible: 1,
        published: 1,
        draft: 2,
      },
      items: [
        {
          questionId: "d1",
          partLabel: "a",
          subject: "Biology",
          examBoard: "AQA",
          level: "GCSE",
          topic: "X",
          topicKey: "x",
          status: "draft",
          sharedStem: "",
          questionText: "Draft eligible",
          options: ["A", "B"],
          correctOption: "A",
          correctIndex: 0,
          markScheme: [],
          currentRationale: null,
          rationaleBucket: "missing",
          potentiallyEligibleForBackfill: true,
          updatedAt: new Date().toISOString(),
          ownerId: "t1",
          ownerName: "T",
        },
        {
          questionId: "p1",
          partLabel: "a",
          subject: "Biology",
          examBoard: "AQA",
          level: "GCSE",
          topic: "X",
          topicKey: "x",
          status: "published",
          sharedStem: "",
          questionText: "Published eligible",
          options: ["A", "B"],
          correctOption: "A",
          correctIndex: 0,
          markScheme: [],
          currentRationale: null,
          rationaleBucket: "missing",
          potentiallyEligibleForBackfill: true,
          updatedAt: new Date().toISOString(),
          ownerId: "t1",
          ownerName: "T",
        },
        {
          questionId: "s1",
          partLabel: "a",
          subject: "Biology",
          examBoard: "AQA",
          level: "GCSE",
          topic: "X",
          topicKey: "x",
          status: "draft",
          sharedStem: "",
          questionText: "Substantive draft",
          options: ["A", "B"],
          correctOption: "A",
          correctIndex: 0,
          markScheme: [],
          currentRationale: "A full educational explanation about light energy.",
          rationaleBucket: "substantive",
          potentiallyEligibleForBackfill: false,
          updatedAt: new Date().toISOString(),
          ownerId: "t1",
          ownerName: "T",
        },
      ],
    });

    render(
      <MemoryRouter>
        <AdminMcqRationaleInventoryPage />
      </MemoryRouter>
    );

    await screen.findByText(/Draft eligible/);
    const links = screen.getAllByTestId("mcq-rationale-inventory-review-link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      "href",
      "/admin/exam-question-rationale-inventory/d1/a/review"
    );
    expect(screen.queryByRole("button", { name: /generate|approve|backfill/i })).not.toBeInTheDocument();
  });
});
