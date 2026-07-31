/**
 * Frontend tests: V2.3B1 review page + V2.3B2a Generate + V2.3B2b1 Reject.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminMcqRationaleReviewPage from "./AdminMcqRationaleReviewPage";
import AdminMcqRationaleInventoryPage from "./AdminMcqRationaleInventoryPage";
import * as candidatesApi from "../api/mcqRationaleCandidates";

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

const mockCreateCandidate = jest.fn();
const mockRejectCandidate = jest.fn();
let mockIdempotencySeq = 0;
jest.mock("../api/mcqRationaleCandidates", () => ({
  createMcqRationaleCandidate: (...args: unknown[]) => mockCreateCandidate(...args),
  rejectMcqRationaleCandidate: (...args: unknown[]) => mockRejectCandidate(...args),
  createMcqRationaleCandidateIdempotencyKey: () => {
    mockIdempotencySeq += 1;
    return `cand_test_key_${mockIdempotencySeq}_xxxxxxxx`;
  },
  readMcqRationaleCandidateError: (err: unknown) => {
    const ax = err as {
      message?: string;
      code?: string;
      response?: {
        status?: number;
        data?: { error?: string; code?: string; candidate?: unknown };
      };
    };
    const status = ax.response?.status;
    const hasResponse = ax.response != null;
    const networkUncertain =
      !hasResponse ||
      ax.code === "ERR_NETWORK" ||
      ax.code === "ECONNABORTED" ||
      /network error/i.test(String(ax.message || ""));
    const code =
      (ax.response?.data?.code && String(ax.response.data.code)) ||
      (networkUncertain
        ? "NETWORK_UNCERTAIN"
        : status === 401 || status === 403
          ? "ACCESS_DENIED"
          : "SERVER_ERROR");
    return {
      status,
      code,
      message: String(ax.response?.data?.error || ax.message || "Candidate request failed"),
      candidate:
        ax.response?.data?.candidate && typeof ax.response.data.candidate === "object"
          ? ax.response.data.candidate
          : null,
      networkUncertain,
    };
  },
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

const fingerprint = "b".repeat(64);

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
  currentSourceFingerprint: fingerprint,
  sourceUpdatedAt: new Date().toISOString(),
  imageContextAvailable: false,
  imageContextRequired: false,
  mediaContext: {
    referencePresent: false,
    scope: "none" as const,
    trustedContextAvailable: false,
  },
  generationFeatureEnabled: false,
  publishedGenerationEnabled: false,
  canGenerate: true,
  canGenerateReason: "",
  rejectionFeatureEnabled: false,
  canReject: false,
  rejectDisabledReason: "FEATURE_DISABLED",
  latestCandidate: null,
  candidateIsStale: false,
  readOnly: true as const,
};

const eligibleContext = {
  ...baseContext,
  generationFeatureEnabled: true,
  canGenerate: true,
  canGenerateReason: "",
  imageContextRequired: false,
};

const pendingCandidate = {
  candidateId: "c1",
  questionId: "qid123",
  partLabel: "a",
  status: "pending",
  attemptNumber: 1,
  sourceFingerprint: fingerprint,
  sourceUpdatedAt: null,
  sourceSnapshot: {},
  explanation: "Light is needed for photosynthesis.",
  promptVersion: "v1",
  model: "gpt-4o-mini",
  generatedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  validationIssueCodes: [] as string[],
  failureCode: "",
};

const SHARED_MEDIA_WARNING =
  /This Composite Exam Question has shared media attached, but no trusted description is available\. Candidate generation remains blocked\./;

const OUT_OF_SCOPE =
  /^(Generate replacement candidate|Regenerate|Approve|Save|Publish|Backfill|Apply rationale|Replace rationale)$/i;

describe("AdminMcqRationaleReviewPage", () => {
  beforeEach(() => {
    mockFetchReview.mockReset();
    mockCreateCandidate.mockReset();
    mockRejectCandidate.mockReset();
    mockIdempotencySeq = 0;
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
    expect(screen.getByTestId("mcq-rationale-review-readonly-notice")).toHaveTextContent(
      /Candidate generation and rejection are available only when enabled/
    );
    expect(screen.getByTestId("mcq-rationale-review-readonly-notice")).toHaveTextContent(
      /Candidate actions do not change the Exam Question/
    );
  });

  test("A: feature disabled — no Generate candidate; explanation remains", async () => {
    renderReview();
    await screen.findByTestId("mcq-rationale-review-body");
    expect(screen.queryByRole("button", { name: /^Generate candidate$/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("mcq-rationale-review-feature-disabled")).toBeInTheDocument();
  });

  test("B: eligible draft — Generate candidate appears once and is enabled", async () => {
    mockFetchReview.mockResolvedValue(eligibleContext);
    renderReview();
    const btn = await screen.findByRole("button", { name: /^Generate candidate$/i });
    expect(btn).toBeEnabled();
    expect(screen.getAllByRole("button", { name: /^Generate candidate$/i })).toHaveLength(1);
  });

  test("C: shared media blocked — no Generate; warning once", async () => {
    mockFetchReview.mockResolvedValue({
      ...eligibleContext,
      imageContextRequired: true,
      canGenerate: false,
      canGenerateReason: "IMAGE_CONTEXT_REQUIRED",
      mediaContext: {
        referencePresent: true,
        scope: "question_shared",
        trustedContextAvailable: false,
      },
    });
    renderReview();
    await screen.findByTestId("mcq-rationale-review-body");
    expect(screen.queryByRole("button", { name: /^Generate candidate$/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(SHARED_MEDIA_WARNING)).toHaveLength(1);
  });

  test("D: published/status blocked — no Generate; reason remains", async () => {
    mockFetchReview.mockResolvedValue({
      ...baseContext,
      generationFeatureEnabled: true,
      questionStatus: "published",
      canGenerate: false,
      canGenerateReason: "PUBLISHED_NOT_ENABLED",
    });
    renderReview();
    await screen.findByTestId("mcq-rationale-review-published-disabled");
    expect(screen.queryByRole("button", { name: /^Generate candidate$/i })).not.toBeInTheDocument();
  });

  test("E/G/H: one click posts correct body, loading label, then shows candidate", async () => {
    mockFetchReview
      .mockResolvedValueOnce(eligibleContext)
      .mockResolvedValueOnce({
        ...eligibleContext,
        canGenerate: false,
        canGenerateReason: "ACTIVE_CANDIDATE_EXISTS",
        latestCandidate: pendingCandidate,
      });
    mockCreateCandidate.mockResolvedValue({ candidate: pendingCandidate, replayed: false });

    renderReview();
    const btn = await screen.findByRole("button", { name: /^Generate candidate$/i });

    fireEvent.click(btn);
    expect(await screen.findByRole("button", { name: /Generating candidate…/i })).toBeDisabled();

    await waitFor(() => {
      expect(mockCreateCandidate).toHaveBeenCalledTimes(1);
    });
    expect(mockCreateCandidate).toHaveBeenCalledWith({
      questionId: "qid123",
      partLabel: "a",
      idempotencyKey: expect.stringMatching(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
      expectedSourceFingerprint: fingerprint,
    });

    expect(await screen.findByTestId("mcq-rationale-review-candidate-status")).toHaveTextContent("pending");
    expect(screen.getByTestId("mcq-rationale-review-candidate-explanation")).toHaveTextContent(/Light is needed/);
    expect(mockCreateCandidate).toHaveBeenCalledTimes(1);
    expect(mockFetchReview).toHaveBeenCalledTimes(2);
  });

  test("F: double click — only one in-flight POST", async () => {
    let resolveCreate: (v: unknown) => void = () => undefined;
    mockFetchReview.mockResolvedValue(eligibleContext);
    mockCreateCandidate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    renderReview();
    const btn = await screen.findByRole("button", { name: /^Generate candidate$/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);

    await waitFor(() => expect(mockCreateCandidate).toHaveBeenCalledTimes(1));

    resolveCreate({ candidate: pendingCandidate, replayed: false });
    mockFetchReview.mockResolvedValue({
      ...eligibleContext,
      canGenerate: false,
      canGenerateReason: "ACTIVE_CANDIDATE_EXISTS",
      latestCandidate: pendingCandidate,
    });
    await screen.findByTestId("mcq-rationale-review-candidate-status");
    expect(mockCreateCandidate).toHaveBeenCalledTimes(1);
  });

  test("I: idempotent replay treated as success; same candidate; no duplicate POST", async () => {
    mockFetchReview
      .mockResolvedValueOnce(eligibleContext)
      .mockResolvedValueOnce({
        ...eligibleContext,
        canGenerate: false,
        canGenerateReason: "ACTIVE_CANDIDATE_EXISTS",
        latestCandidate: pendingCandidate,
      });
    mockCreateCandidate.mockResolvedValue({ candidate: pendingCandidate, replayed: true });

    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Generate candidate$/i }));

    expect(await screen.findByTestId("mcq-rationale-review-replayed")).toBeInTheDocument();
    expect(screen.getByTestId("mcq-rationale-review-candidate-status")).toHaveTextContent("pending");
    expect(mockCreateCandidate).toHaveBeenCalledTimes(1);
  });

  test("J: network uncertainty — safe error; manual retry reuses same key", async () => {
    mockFetchReview.mockResolvedValue(eligibleContext);
    mockCreateCandidate
      .mockRejectedValueOnce({ message: "Network Error", code: "ERR_NETWORK" })
      .mockResolvedValueOnce({ candidate: pendingCandidate, replayed: true });

    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Generate candidate$/i }));

    expect(await screen.findByTestId("mcq-rationale-review-generate-error")).toHaveTextContent(
      /may not have completed/i
    );

    mockFetchReview.mockResolvedValue({
      ...eligibleContext,
      canGenerate: false,
      canGenerateReason: "ACTIVE_CANDIDATE_EXISTS",
      latestCandidate: pendingCandidate,
    });

    fireEvent.click(screen.getByRole("button", { name: /^Generate candidate$/i }));
    await waitFor(() => expect(mockCreateCandidate).toHaveBeenCalledTimes(2));

    const key1 = mockCreateCandidate.mock.calls[0][0].idempotencyKey;
    const key2 = mockCreateCandidate.mock.calls[1][0].idempotencyKey;
    expect(key1).toBe(key2);
  });

  test("K: confirmed failed terminal — later eligible retry uses a new key", async () => {
    const failedCandidate = {
      ...pendingCandidate,
      candidateId: "c-fail",
      status: "failed",
      explanation: "",
      failureCode: "LLM_ERROR",
    };

    mockFetchReview
      .mockResolvedValueOnce(eligibleContext)
      .mockResolvedValueOnce({
        ...eligibleContext,
        canGenerate: true,
        latestCandidate: failedCandidate,
      })
      .mockResolvedValueOnce({
        ...eligibleContext,
        canGenerate: false,
        canGenerateReason: "ACTIVE_CANDIDATE_EXISTS",
        latestCandidate: pendingCandidate,
      });

    mockCreateCandidate
      .mockRejectedValueOnce({
        response: {
          status: 503,
          data: { error: "Rationale generation failed", code: "LLM_ERROR", candidate: failedCandidate },
        },
      })
      .mockResolvedValueOnce({ candidate: pendingCandidate, replayed: false });

    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Generate candidate$/i }));

    expect(await screen.findByTestId("mcq-rationale-review-failure-code")).toHaveTextContent("LLM_ERROR");
    expect(await screen.findByRole("button", { name: /^Generate candidate$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Generate candidate$/i }));
    await waitFor(() => expect(mockCreateCandidate).toHaveBeenCalledTimes(2));

    const key1 = mockCreateCandidate.mock.calls[0][0].idempotencyKey;
    const key2 = mockCreateCandidate.mock.calls[1][0].idempotencyKey;
    expect(key1).not.toBe(key2);
  });

  test("L: stale source — no automatic retry; context refreshes; explanation shown", async () => {
    mockFetchReview
      .mockResolvedValueOnce(eligibleContext)
      .mockResolvedValueOnce({
        ...eligibleContext,
        currentSourceFingerprint: "c".repeat(64),
      });
    mockCreateCandidate.mockRejectedValue({
      response: {
        status: 409,
        data: { error: "Source fingerprint does not match", code: "STALE_SOURCE_FINGERPRINT" },
      },
    });

    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Generate candidate$/i }));

    expect(await screen.findByTestId("mcq-rationale-review-generate-error")).toHaveTextContent(
      /source changed/i
    );
    await waitFor(() => expect(mockFetchReview).toHaveBeenCalledTimes(2));
    expect(mockCreateCandidate).toHaveBeenCalledTimes(1);
  });

  test("M: active candidate — context refreshes; no second generation", async () => {
    mockFetchReview
      .mockResolvedValueOnce(eligibleContext)
      .mockResolvedValueOnce({
        ...eligibleContext,
        canGenerate: false,
        canGenerateReason: "ACTIVE_CANDIDATE_EXISTS",
        latestCandidate: pendingCandidate,
      });
    mockCreateCandidate.mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: "An active candidate already exists",
          code: "ACTIVE_CANDIDATE_EXISTS",
          candidate: pendingCandidate,
        },
      },
    });

    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Generate candidate$/i }));

    expect(await screen.findByTestId("mcq-rationale-review-candidate-status")).toHaveTextContent("pending");
    expect(screen.getByTestId("mcq-rationale-review-generate-error")).toHaveTextContent(/already exists/i);
    expect(screen.queryByRole("button", { name: /^Generate candidate$/i })).not.toBeInTheDocument();
    expect(mockCreateCandidate).toHaveBeenCalledTimes(1);
  });

  test("N: rate/daily cap — bounded error; no automatic retry", async () => {
    mockFetchReview.mockResolvedValue(eligibleContext);
    mockCreateCandidate.mockRejectedValue({
      response: {
        status: 429,
        data: { error: "Daily cap", code: "ACTOR_DAILY_CAP" },
      },
    });

    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Generate candidate$/i }));

    expect(await screen.findByTestId("mcq-rationale-review-generate-error")).toHaveTextContent(
      /daily candidate generation limit/i
    );
    expect(mockCreateCandidate).toHaveBeenCalledTimes(1);
  });

  test("O: permission failure — safe error", async () => {
    mockFetchReview.mockResolvedValue(eligibleContext);
    mockCreateCandidate.mockRejectedValue({
      response: {
        status: 403,
        data: { error: "Forbidden", code: "ACCESS_DENIED" },
      },
    });

    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Generate candidate$/i }));

    expect(await screen.findByTestId("mcq-rationale-review-generate-error")).toHaveTextContent(
      /do not have permission/i
    );
  });

  test("P: shared-media endpoint rejection keeps diagnostic authoritative", async () => {
    mockFetchReview
      .mockResolvedValueOnce(eligibleContext)
      .mockResolvedValueOnce({
        ...eligibleContext,
        imageContextRequired: true,
        canGenerate: false,
        canGenerateReason: "IMAGE_CONTEXT_REQUIRED",
        mediaContext: {
          referencePresent: true,
          scope: "question_shared",
          trustedContextAvailable: false,
        },
      });
    mockCreateCandidate.mockRejectedValue({
      response: {
        status: 422,
        data: { error: "Image context required", code: "IMAGE_CONTEXT_REQUIRED" },
      },
    });

    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Generate candidate$/i }));

    expect(await screen.findByTestId("mcq-rationale-review-shared-media-warning")).toBeInTheDocument();
    expect(screen.getAllByText(SHARED_MEDIA_WARNING)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^Generate candidate$/i })).not.toBeInTheDocument();
  });

  test("Q/R: no out-of-scope controls; create + reject APIs only", async () => {
    mockFetchReview.mockResolvedValue(eligibleContext);
    renderReview();
    await screen.findByRole("button", { name: /^Generate candidate$/i });

    expect(screen.queryByRole("button", { name: OUT_OF_SCOPE })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: OUT_OF_SCOPE })).not.toBeInTheDocument();
    expect(document.querySelector("[contenteditable='true']")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Generate replacement candidate$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Regenerate$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Save$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Publish$/i })).not.toBeInTheDocument();

    expect(typeof candidatesApi.createMcqRationaleCandidate).toBe("function");
    expect(typeof candidatesApi.rejectMcqRationaleCandidate).toBe("function");
    expect((candidatesApi as { approveMcqRationaleCandidate?: unknown }).approveMcqRationaleCandidate).toBeUndefined();
    expect((candidatesApi as { regenerateMcqRationaleCandidate?: unknown }).regenerateMcqRationaleCandidate).toBeUndefined();
  });

  test("candidate explanation, pending status, stale warning", async () => {
    mockFetchReview.mockResolvedValue({
      ...baseContext,
      candidateIsStale: true,
      latestCandidate: {
        ...pendingCandidate,
        sourceFingerprint: "a".repeat(64),
      },
    });
    renderReview();
    expect(await screen.findByTestId("mcq-rationale-review-candidate-status")).toHaveTextContent("pending");
    expect(screen.getByTestId("mcq-rationale-review-candidate-explanation")).toHaveTextContent(/Light is needed/);
    expect(screen.getByTestId("mcq-rationale-review-stale-warning")).toBeInTheDocument();
  });

  test("shared media without trusted context: explanatory warning once, no legacy sentence", async () => {
    mockFetchReview.mockResolvedValue({
      ...baseContext,
      imageContextRequired: true,
      canGenerate: false,
      canGenerateReason: "IMAGE_CONTEXT_REQUIRED",
      mediaContext: {
        referencePresent: true,
        scope: "question_shared",
        trustedContextAvailable: false,
      },
      latestCandidate: {
        ...pendingCandidate,
        candidateId: "c2",
        status: "failed",
        explanation: "",
        validationIssueCodes: ["TOO_SHORT"],
        failureCode: "LLM_ERROR",
      },
    });
    renderReview();
    expect(await screen.findByTestId("mcq-rationale-review-candidate-status")).toHaveTextContent("failed");
    expect(screen.getByTestId("mcq-rationale-review-failure-code")).toHaveTextContent("LLM_ERROR");
    expect(screen.getByTestId("mcq-rationale-review-shared-media-warning")).toBeInTheDocument();
    expect(screen.getAllByText(SHARED_MEDIA_WARNING)).toHaveLength(1);
    expect(screen.queryByTestId("mcq-rationale-review-image-context-warning")).not.toBeInTheDocument();
    expect(screen.queryByText(/Trusted image context text is required/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("mcq-rationale-review-can-generate-reason")).not.toBeInTheDocument();
  });

  test("feature-disabled plus shared-media warning: each notice once", async () => {
    mockFetchReview.mockResolvedValue({
      ...baseContext,
      generationFeatureEnabled: false,
      imageContextRequired: true,
      canGenerate: false,
      canGenerateReason: "IMAGE_CONTEXT_REQUIRED",
      mediaContext: {
        referencePresent: true,
        scope: "question_shared",
        trustedContextAvailable: false,
      },
    });
    renderReview();
    expect(await screen.findByTestId("mcq-rationale-review-feature-disabled")).toBeInTheDocument();
    expect(screen.getByTestId("mcq-rationale-review-shared-media-warning")).toBeInTheDocument();
    expect(screen.getAllByText(SHARED_MEDIA_WARNING)).toHaveLength(1);
    expect(screen.getAllByText(/Candidate generation is currently disabled/i)).toHaveLength(1);
    expect(screen.queryByText(/Trusted image context text is required/i)).not.toBeInTheDocument();
  });

  test("shared media with trusted context: neutral status once, no blocked warning", async () => {
    mockFetchReview.mockResolvedValue({
      ...baseContext,
      imageContextRequired: false,
      imageContextAvailable: true,
      canGenerateReason: "",
      canGenerate: true,
      mediaContext: {
        referencePresent: true,
        scope: "question_shared",
        trustedContextAvailable: true,
      },
    });
    renderReview();
    await screen.findByTestId("mcq-rationale-review-body");
    expect(screen.getByTestId("mcq-rationale-review-shared-media-trusted")).toHaveTextContent(
      /Trusted context is available for the shared media/
    );
    expect(screen.getAllByText(/Trusted context is available for the shared media/i)).toHaveLength(1);
    expect(screen.queryByTestId("mcq-rationale-review-shared-media-warning")).not.toBeInTheDocument();
    expect(screen.queryByText(SHARED_MEDIA_WARNING)).not.toBeInTheDocument();
  });

  test("no media: no media warning or trusted status", async () => {
    mockFetchReview.mockResolvedValue({
      ...baseContext,
      imageContextRequired: false,
      canGenerateReason: "",
      canGenerate: true,
      mediaContext: {
        referencePresent: false,
        scope: "none",
        trustedContextAvailable: false,
      },
    });
    renderReview();
    await screen.findByTestId("mcq-rationale-review-body");
    expect(screen.queryByTestId("mcq-rationale-review-shared-media-warning")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mcq-rationale-review-shared-media-trusted")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mcq-rationale-review-image-context-warning")).not.toBeInTheDocument();
    expect(screen.queryByText(/Trusted image context text is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(SHARED_MEDIA_WARNING)).not.toBeInTheDocument();
  });

  test("backward-compatible response without mediaContext: legacy warning, no crash", async () => {
    const { mediaContext: _omit, ...legacy } = baseContext;
    mockFetchReview.mockResolvedValue({
      ...legacy,
      imageContextRequired: true,
      canGenerate: false,
      canGenerateReason: "IMAGE_CONTEXT_REQUIRED",
    });
    renderReview();
    expect(await screen.findByTestId("mcq-rationale-review-image-context-warning")).toBeInTheDocument();
    expect(screen.getAllByText(/Trusted image context text is required/i)).toHaveLength(1);
    expect(screen.queryByTestId("mcq-rationale-review-shared-media-warning")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mcq-rationale-review-can-generate-reason")).not.toBeInTheDocument();
  });

  test.each([
    ["empty diagnostic object", {}],
    [
      "unknown scope",
      { referencePresent: true, scope: "part_visual", trustedContextAvailable: false },
    ],
    [
      "inconsistent false reference with shared scope",
      { referencePresent: false, scope: "question_shared", trustedContextAvailable: false },
    ],
    [
      "inconsistent true reference with none scope",
      { referencePresent: true, scope: "none", trustedContextAvailable: false },
    ],
    [
      "trusted true while imageContextRequired true",
      { referencePresent: true, scope: "question_shared", trustedContextAvailable: true },
    ],
  ] as const)(
    "malformed mediaContext (%s): legacy warning once, no shared/trusted wording",
    async (_name, mediaContext) => {
      mockFetchReview.mockResolvedValue({
        ...baseContext,
        imageContextRequired: true,
        canGenerate: false,
        canGenerateReason: "IMAGE_CONTEXT_REQUIRED",
        // Intentionally malformed / inconsistent diagnostic shapes.
        mediaContext: mediaContext as never,
      });
      renderReview();
      expect(await screen.findByTestId("mcq-rationale-review-image-context-warning")).toBeInTheDocument();
      expect(screen.getAllByText(/Trusted image context text is required/i)).toHaveLength(1);
      expect(screen.queryByTestId("mcq-rationale-review-shared-media-warning")).not.toBeInTheDocument();
      expect(screen.queryByText(SHARED_MEDIA_WARNING)).not.toBeInTheDocument();
      expect(screen.queryByTestId("mcq-rationale-review-shared-media-trusted")).not.toBeInTheDocument();
      expect(screen.queryByTestId("mcq-rationale-review-can-generate-reason")).not.toBeInTheDocument();
    }
  );

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

  test("absence of mutation controls when feature disabled", async () => {
    renderReview();
    await screen.findByTestId("mcq-rationale-review-body");
    expect(screen.queryByRole("button", { name: /^Generate candidate$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Reject candidate$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Regenerate$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Save$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Publish$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

const rejectEligibleContext = {
  ...baseContext,
  generationFeatureEnabled: false,
  canGenerate: false,
  canGenerateReason: "ACTIVE_CANDIDATE_EXISTS",
  rejectionFeatureEnabled: true,
  canReject: true,
  rejectDisabledReason: null,
  latestCandidate: pendingCandidate,
  candidateIsStale: false,
};

const rejectedCandidate = {
  ...pendingCandidate,
  status: "rejected",
  rejectedAt: new Date("2026-07-21T12:00:00.000Z").toISOString(),
  rejectionReasonCode: "too_generic",
};

describe("AdminMcqRationaleReviewPage V2.3B2b1 Reject", () => {
  beforeEach(() => {
    mockFetchReview.mockReset();
    mockCreateCandidate.mockReset();
    mockRejectCandidate.mockReset();
    mockIdempotencySeq = 0;
    mockFetchReview.mockResolvedValue(rejectEligibleContext);
  });

  test("feature disabled → no Reject button; modest notice when pending", async () => {
    mockFetchReview.mockResolvedValue({
      ...rejectEligibleContext,
      rejectionFeatureEnabled: false,
      canReject: false,
      rejectDisabledReason: "FEATURE_DISABLED",
    });
    renderReview();
    await screen.findByTestId("mcq-rationale-review-body");
    expect(screen.queryByRole("button", { name: /^Reject candidate$/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("mcq-rationale-review-reject-feature-disabled")).toHaveTextContent(
      /Candidate rejection is currently disabled/
    );
    expect(mockRejectCandidate).not.toHaveBeenCalled();
  });

  test("pending + eligible → Reject candidate appears once", async () => {
    renderReview();
    const btn = await screen.findByRole("button", { name: /^Reject candidate$/i });
    expect(btn).toBeEnabled();
    expect(screen.getAllByRole("button", { name: /^Reject candidate$/i })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^Generate replacement candidate$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Regenerate$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Save$/i })).not.toBeInTheDocument();
  });

  test("non-pending → no Reject", async () => {
    mockFetchReview.mockResolvedValue({
      ...rejectEligibleContext,
      canReject: false,
      rejectDisabledReason: "NOT_PENDING",
      latestCandidate: { ...pendingCandidate, status: "failed" },
    });
    renderReview();
    await screen.findByTestId("mcq-rationale-review-candidate-status");
    expect(screen.queryByRole("button", { name: /^Reject candidate$/i })).not.toBeInTheDocument();
  });

  test("stale Candidate → no Reject", async () => {
    mockFetchReview.mockResolvedValue({
      ...rejectEligibleContext,
      canReject: false,
      rejectDisabledReason: "STALE_SOURCE",
      candidateIsStale: true,
      latestCandidate: { ...pendingCandidate, sourceFingerprint: "a".repeat(64) },
    });
    renderReview();
    await screen.findByTestId("mcq-rationale-review-stale-warning");
    expect(screen.queryByRole("button", { name: /^Reject candidate$/i })).not.toBeInTheDocument();
  });

  test("confirmation opens; reason required; Cancel performs no POST", async () => {
    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Reject candidate$/i }));
    expect(await screen.findByTestId("mcq-rationale-review-reject-confirm")).toBeInTheDocument();
    expect(screen.getByTestId("mcq-rationale-review-reject-eq-notice")).toHaveTextContent(
      /Rejecting this candidate does not change the Exam Question/
    );
    expect(screen.getByTestId("mcq-rationale-review-candidate-explanation")).toHaveTextContent(/Light is needed/);

    fireEvent.click(screen.getByRole("button", { name: /^Confirm rejection$/i }));
    expect(await screen.findByTestId("mcq-rationale-review-reject-validation")).toHaveTextContent(
      /Choose a rejection reason/
    );
    expect(mockRejectCandidate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByTestId("mcq-rationale-review-reject-confirm")).not.toBeInTheDocument();
    });
    expect(mockRejectCandidate).not.toHaveBeenCalled();
  });

  test("optional note bounded; confirm sends exact payload", async () => {
    mockFetchReview
      .mockResolvedValueOnce(rejectEligibleContext)
      .mockResolvedValueOnce({
        ...rejectEligibleContext,
        canReject: false,
        rejectDisabledReason: "ALREADY_REJECTED",
        latestCandidate: rejectedCandidate,
      });
    mockRejectCandidate.mockResolvedValue({ candidate: rejectedCandidate, replayed: false });

    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Reject candidate$/i }));
    fireEvent.change(screen.getByTestId("mcq-rationale-review-reject-reason"), {
      target: { value: "unsupported_detail" },
    });
    fireEvent.change(screen.getByTestId("mcq-rationale-review-reject-note"), {
      target: { value: "  needs clearer mark scheme link  " },
    });
    expect(screen.getByTestId("mcq-rationale-review-reject-note-count")).toHaveTextContent(/34\/300/);

    fireEvent.click(screen.getByRole("button", { name: /^Confirm rejection$/i }));
    expect(await screen.findByRole("button", { name: /Rejecting candidate…/i })).toBeDisabled();

    await waitFor(() => expect(mockRejectCandidate).toHaveBeenCalledTimes(1));
    expect(mockRejectCandidate).toHaveBeenCalledWith({
      candidateId: "c1",
      questionId: "qid123",
      partLabel: "a",
      expectedSourceFingerprint: fingerprint,
      reasonCode: "unsupported_detail",
      note: "needs clearer mark scheme link",
    });
    expect(mockCreateCandidate).not.toHaveBeenCalled();
    expect(await screen.findByTestId("mcq-rationale-review-candidate-status")).toHaveTextContent("REJECTED");
    expect(screen.getByTestId("mcq-rationale-review-candidate-explanation")).toHaveTextContent(/Light is needed/);
    expect(screen.getByTestId("mcq-rationale-review-rejection-reason")).toHaveTextContent(/Too generic/);
    expect(screen.getByTestId("mcq-rationale-review-rejected-at")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Reject candidate$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Generate replacement candidate$/i })).not.toBeInTheDocument();
  });

  test("rapid multi-click sends one POST", async () => {
    let resolveReject: (v: unknown) => void = () => undefined;
    mockRejectCandidate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReject = resolve;
        })
    );

    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Reject candidate$/i }));
    fireEvent.change(screen.getByTestId("mcq-rationale-review-reject-reason"), {
      target: { value: "inaccurate" },
    });
    const confirm = screen.getByRole("button", { name: /^Confirm rejection$/i });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(mockRejectCandidate).toHaveBeenCalledTimes(1));
    resolveReject({ candidate: rejectedCandidate, replayed: false });
    mockFetchReview.mockResolvedValue({
      ...rejectEligibleContext,
      canReject: false,
      latestCandidate: rejectedCandidate,
    });
    await screen.findByTestId("mcq-rationale-review-candidate-status");
    expect(mockRejectCandidate).toHaveBeenCalledTimes(1);
  });

  test("replay treated as success", async () => {
    mockFetchReview
      .mockResolvedValueOnce(rejectEligibleContext)
      .mockResolvedValueOnce({
        ...rejectEligibleContext,
        canReject: false,
        latestCandidate: rejectedCandidate,
      });
    mockRejectCandidate.mockResolvedValue({ candidate: rejectedCandidate, replayed: true });

    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Reject candidate$/i }));
    fireEvent.change(screen.getByTestId("mcq-rationale-review-reject-reason"), {
      target: { value: "too_generic" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirm rejection$/i }));

    expect(await screen.findByTestId("mcq-rationale-review-replayed")).toHaveTextContent(/idempotent replay/i);
    expect(screen.getByTestId("mcq-rationale-review-candidate-status")).toHaveTextContent("REJECTED");
    expect(mockRejectCandidate).toHaveBeenCalledTimes(1);
  });

  test("network uncertainty safe; no automatic retry", async () => {
    mockRejectCandidate.mockRejectedValue({ message: "Network Error", code: "ERR_NETWORK" });
    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Reject candidate$/i }));
    fireEvent.change(screen.getByTestId("mcq-rationale-review-reject-reason"), {
      target: { value: "unclear" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirm rejection$/i }));

    expect(await screen.findByTestId("mcq-rationale-review-reject-error")).toHaveTextContent(
      /may not have completed/i
    );
    expect(mockRejectCandidate).toHaveBeenCalledTimes(1);
  });

  test("status conflict refreshes context and removes Reject", async () => {
    mockRejectCandidate.mockRejectedValue({
      response: {
        status: 409,
        data: { error: "Not pending", code: "CANDIDATE_NOT_PENDING" },
      },
    });
    mockFetchReview
      .mockResolvedValueOnce(rejectEligibleContext)
      .mockResolvedValueOnce({
        ...rejectEligibleContext,
        canReject: false,
        rejectDisabledReason: "NOT_PENDING",
        latestCandidate: { ...pendingCandidate, status: "failed" },
      });

    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Reject candidate$/i }));
    fireEvent.change(screen.getByTestId("mcq-rationale-review-reject-reason"), {
      target: { value: "other" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirm rejection$/i }));

    expect(await screen.findByTestId("mcq-rationale-review-reject-error")).toHaveTextContent(/no longer pending/i);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^Reject candidate$/i })).not.toBeInTheDocument();
    });
    expect(mockFetchReview).toHaveBeenCalledTimes(2);
  });

  test("permission failure safe", async () => {
    mockRejectCandidate.mockRejectedValue({
      response: { status: 403, data: { error: "Forbidden", code: "ACCESS_DENIED" } },
    });
    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Reject candidate$/i }));
    fireEvent.change(screen.getByTestId("mcq-rationale-review-reject-reason"), {
      target: { value: "other" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirm rejection$/i }));

    expect(await screen.findByTestId("mcq-rationale-review-reject-error")).toHaveTextContent(
      /do not have permission/i
    );
  });

  test("rejected + generation flag false → no Generate; replacement message; explanation kept", async () => {
    mockFetchReview.mockResolvedValue({
      ...rejectEligibleContext,
      generationFeatureEnabled: false,
      canGenerate: false,
      canGenerateReason: "REPLACEMENT_GENERATION_NOT_ENABLED",
      canReject: false,
      rejectDisabledReason: "ALREADY_REJECTED",
      latestCandidate: rejectedCandidate,
    });
    renderReview();
    expect(await screen.findByTestId("mcq-rationale-review-candidate-status")).toHaveTextContent("REJECTED");
    expect(screen.getByTestId("mcq-rationale-review-candidate-explanation")).toHaveTextContent(/Light is needed/);
    expect(screen.getByTestId("mcq-rationale-review-rejection-reason")).toHaveTextContent(/Too generic/);
    expect(screen.getByTestId("mcq-rationale-review-rejected-at")).toBeInTheDocument();
    expect(screen.getByTestId("mcq-rationale-review-replacement-disabled")).toHaveTextContent(
      /Replacement generation is not available yet/
    );
    expect(screen.queryByRole("button", { name: /^Generate candidate$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Reject candidate$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Generate replacement candidate$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Regenerate$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Save$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Publish$/i })).not.toBeInTheDocument();
    expect(mockCreateCandidate).not.toHaveBeenCalled();
    expect(mockRejectCandidate).not.toHaveBeenCalled();
  });

  test("rejected + generation flag true → still no Generate; bounded message", async () => {
    mockFetchReview.mockResolvedValue({
      ...rejectEligibleContext,
      generationFeatureEnabled: true,
      canGenerate: false,
      canGenerateReason: "REPLACEMENT_GENERATION_NOT_ENABLED",
      canReject: false,
      rejectDisabledReason: "ALREADY_REJECTED",
      latestCandidate: rejectedCandidate,
    });
    renderReview();
    await screen.findByTestId("mcq-rationale-review-replacement-disabled");
    expect(screen.queryByRole("button", { name: /^Generate candidate$/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("mcq-rationale-review-candidate-explanation")).toHaveTextContent(/Light is needed/);
    expect(mockCreateCandidate).not.toHaveBeenCalled();
  });

  test("direct create error REPLACEMENT_GENERATION_NOT_ENABLED refreshes context safely", async () => {
    mockFetchReview
      .mockResolvedValueOnce(eligibleContext)
      .mockResolvedValueOnce({
        ...eligibleContext,
        canGenerate: false,
        canGenerateReason: "REPLACEMENT_GENERATION_NOT_ENABLED",
        rejectionFeatureEnabled: true,
        canReject: false,
        rejectDisabledReason: "ALREADY_REJECTED",
        latestCandidate: rejectedCandidate,
      });
    mockCreateCandidate.mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: "This candidate was rejected. Replacement generation is not available yet.",
          code: "REPLACEMENT_GENERATION_NOT_ENABLED",
        },
      },
    });

    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: /^Generate candidate$/i }));

    expect(await screen.findByTestId("mcq-rationale-review-generate-error")).toHaveTextContent(
      /Replacement generation is not available yet/
    );
    expect(await screen.findByTestId("mcq-rationale-review-candidate-status")).toHaveTextContent("REJECTED");
    expect(screen.queryByRole("button", { name: /^Generate candidate$/i })).not.toBeInTheDocument();
    expect(mockCreateCandidate).toHaveBeenCalledTimes(1);
    expect(mockFetchReview).toHaveBeenCalledTimes(2);
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
