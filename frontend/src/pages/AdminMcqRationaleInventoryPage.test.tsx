/**
 * Frontend tests: V2.2 read-only MCQ rationale inventory page.
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminMcqRationaleInventoryPage from "./AdminMcqRationaleInventoryPage";

jest.mock("../hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ user: { userType: "admin" } }),
}));

const mockFetch = jest.fn();
jest.mock("../api/mcqRationaleInventory", () => ({
  fetchMcqRationaleInventory: (...args: unknown[]) => mockFetch(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminMcqRationaleInventoryPage />
    </MemoryRouter>
  );
}

const sampleResponse = {
  page: 1,
  pageSize: 25,
  totalMatchingParts: 1,
  totalPages: 1,
  readOnly: true as const,
  linkedLessonCount: { available: false, deferred: true, reason: "deferred" },
  summary: {
    countUnit: "mcq_parts" as const,
    totalCompositeQuestions: 1,
    totalCompositeMcqParts: 1,
    missing: 1,
    empty: 0,
    generic: 0,
    substantive: 0,
    malformed: 0,
    potentiallyEligible: 1,
    published: 1,
    draft: 0,
  },
  items: [
    {
      questionId: "abc",
      partLabel: "a",
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "Germination",
      topicKey: "edexcel-igcse-biology:germination",
      status: "published",
      sharedStem: "Stem",
      questionText: "Which factor is not essential?",
      options: ["Water", "Oxygen", "Light", "Temperature"],
      correctOption: "Light",
      correctIndex: 2,
      markScheme: ["Award 1 mark for selecting Option C."],
      currentRationale: null,
      rationaleBucket: "missing" as const,
      potentiallyEligibleForBackfill: true,
      updatedAt: new Date().toISOString(),
      ownerId: "t1",
      ownerName: "Owner Teacher",
    },
  ],
};

describe("AdminMcqRationaleInventoryPage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(sampleResponse);
  });

  test("renders summary, readonly notice, and row", async () => {
    renderPage();
    expect(screen.getByTestId("mcq-rationale-inventory-readonly-notice")).toBeInTheDocument();
    expect(await screen.findByTestId("mcq-rationale-inventory-summary")).toBeInTheDocument();
    expect(screen.getByText("MCQ Rationale Inventory")).toBeInTheDocument();
    expect(screen.getByTestId("mcq-rationale-inventory-row")).toHaveTextContent("Which factor is not essential?");
    expect(screen.queryByRole("button", { name: /save|approve|generate|backfill|reject/i })).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalled();
  });

  test("bucket filter triggers refetch", async () => {
    renderPage();
    await screen.findByTestId("mcq-rationale-inventory-summary");
    fireEvent.change(screen.getByTestId("filter-rationale-bucket"), { target: { value: "missing" } });
    await waitFor(() => {
      const last = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0];
      expect(last.rationaleBucket).toBe("missing");
    });
  });

  test("empty state", async () => {
    mockFetch.mockResolvedValue({
      ...sampleResponse,
      totalMatchingParts: 0,
      items: [],
      summary: { ...sampleResponse.summary, totalCompositeMcqParts: 0, missing: 0, potentiallyEligible: 0 },
    });
    renderPage();
    expect(await screen.findByTestId("mcq-rationale-inventory-empty")).toBeInTheDocument();
  });

  test("API failure handled", async () => {
    mockFetch.mockRejectedValue(new Error("Network down"));
    renderPage();
    expect(await screen.findByTestId("mcq-rationale-inventory-error")).toHaveTextContent(/Network down/);
  });
});
