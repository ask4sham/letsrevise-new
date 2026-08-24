/**
 * Frontend tests: admin read-only Exam Question view + Question Banks View link.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminExamQuestionViewPage from "./AdminExamQuestionViewPage";
import AdminQuestionBanksPage from "./AdminQuestionBanksPage";

jest.mock("../hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ user: { userType: "admin" } }),
}));

jest.mock("../hooks/useTaxonomy", () => ({
  useTaxonomy: () => ({ data: { units: [] } }),
}));

jest.mock("../api/taxonomy", () => ({
  getUnitTopics: () => [],
  getTaxonomyOptionGroups: () => [],
}));

jest.mock("../utils/specKey", () => ({
  getStoredSpecKey: () => "",
}));

const mockFetchView = jest.fn();
jest.mock("../api/adminExamQuestionView", () => ({
  fetchAdminExamQuestionView: (...args: unknown[]) => mockFetchView(...args),
}));

const mockApiGet = jest.fn();
const mockApiDelete = jest.fn();
jest.mock("../services/api", () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
  },
}));

function renderView(path = "/admin/question-banks/exam-questions/6a588da077519cb09f0ae653") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin/question-banks/exam-questions/:questionId"
          element={<AdminExamQuestionViewPage />}
        />
        <Route path="/admin/question-banks" element={<div>Question Banks</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/teacher/exam-question-bank" element={<div>Teacher Exam Bank</div>} />
        <Route path="/teacher/topic-banks/flashcards" element={<div>Flashcard Bank</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const baseView = {
  id: "6a588da077519cb09f0ae653",
  question: "Composite gametes",
  title: "",
  sharedStem: "Gametes are specialised sex cells.",
  subject: "Biology",
  examBoard: "Edexcel",
  level: "IGCSE",
  topic: "Gametes and fertilisation",
  topicKey: "edexcel-igcse-biology:gametes-and-fertilisation",
  type: "composite",
  questionMode: "composite",
  status: "draft",
  marks: null,
  totalMarks: 2,
  options: [],
  correctIndex: null,
  correctAnswer: null,
  markScheme: [],
  parts: [
    {
      label: "a",
      type: "mcq",
      marks: 1,
      questionText: "Which statement about gametes is correct?",
      options: [
        { index: 0, text: "A", isCorrect: false },
        { index: 1, text: "B", isCorrect: false },
        { index: 2, text: "C", isCorrect: true },
        { index: 3, text: "D", isCorrect: false },
      ],
      correctIndex: 2,
      markScheme: ["Award 1 mark for C."],
    },
    {
      label: "b",
      type: "mcq",
      marks: 1,
      questionText: "Where does fertilisation usually occur?",
      options: [
        { index: 0, text: "W", isCorrect: true },
        { index: 1, text: "X", isCorrect: false },
      ],
      correctIndex: 0,
      markScheme: ["Award 1 mark for W."],
    },
  ],
  mediaSummary: {
    questionImagePresent: false,
    assetCount: 0,
    assets: [],
  },
  ownerName: "Admin View",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  readOnly: true as const,
};

describe("AdminExamQuestionViewPage", () => {
  beforeEach(() => {
    mockFetchView.mockReset();
    mockFetchView.mockResolvedValue(baseView);
  });

  test("loads exact record by ID and renders Composite parts in order", async () => {
    renderView();
    expect(screen.getByTestId("admin-exam-question-view-loading")).toBeInTheDocument();
    expect(await screen.findByTestId("admin-exam-question-view-body")).toBeInTheDocument();
    expect(mockFetchView).toHaveBeenCalledWith("6a588da077519cb09f0ae653");
    expect(screen.getByTestId("admin-exam-question-view-id")).toHaveTextContent(
      "6a588da077519cb09f0ae653"
    );
    expect(screen.getByTestId("admin-exam-question-view-shared-stem")).toHaveTextContent(/Gametes are specialised/);
    expect(screen.getByTestId("admin-exam-question-view-part-a")).toHaveTextContent(/gametes is correct/);
    expect(screen.getByTestId("admin-exam-question-view-part-b")).toHaveTextContent(/fertilisation usually occur/);
    const parts = screen.getByTestId("admin-exam-question-view-parts");
    expect(parts.children[0]).toHaveAttribute("data-testid", "admin-exam-question-view-part-a");
    expect(parts.children[1]).toHaveAttribute("data-testid", "admin-exam-question-view-part-b");
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Teacher Exam Bank")).not.toBeInTheDocument();
    expect(screen.queryByText("Flashcard Bank")).not.toBeInTheDocument();
  });

  test("missing/not found ID shows not-found state without dashboard redirect", async () => {
    mockFetchView.mockRejectedValue({
      response: { status: 404, data: { error: "Exam question not found", code: "QUESTION_NOT_FOUND" } },
    });
    renderView("/admin/question-banks/exam-questions/aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(await screen.findByTestId("admin-exam-question-view-error")).toHaveTextContent(
      /Exam Question not found|Exam question not found/i
    );
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  test("malformed route ID shows load error", async () => {
    renderView("/admin/question-banks/exam-questions/not-valid");
    expect(await screen.findByTestId("admin-exam-question-view-error")).toHaveTextContent(
      /could not be loaded/i
    );
    expect(mockFetchView).not.toHaveBeenCalled();
  });

  test("absence of mutation controls", async () => {
    renderView();
    await screen.findByTestId("admin-exam-question-view-body");
    expect(screen.queryByRole("button", { name: /generate|approve|reject|save|publish|backfill|edit|delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByTestId("admin-exam-question-view-readonly-notice")).toBeInTheDocument();
  });

  test("standard question rendering", async () => {
    mockFetchView.mockResolvedValue({
      ...baseView,
      id: "bbbbbbbbbbbbbbbbbbbbbbbb",
      type: "mcq",
      questionMode: "single",
      question: "Which organelle contains DNA?",
      sharedStem: "",
      parts: [],
      options: [
        { index: 0, text: "Mitochondrion", isCorrect: false },
        { index: 1, text: "Nucleus", isCorrect: true },
      ],
      correctIndex: 1,
      markScheme: ["Award 1 mark for Nucleus."],
      marks: 1,
    });
    renderView("/admin/question-banks/exam-questions/bbbbbbbbbbbbbbbbbbbbbbbb");
    expect(await screen.findByTestId("admin-exam-question-view-question-text")).toHaveTextContent(/organelle contains DNA/);
    expect(screen.getByTestId("admin-exam-question-view-correct-option")).toHaveTextContent(/Nucleus/);
    expect(screen.getByTestId("admin-exam-question-view-mark-scheme")).toHaveTextContent(/Nucleus/);
  });
});

describe("AdminQuestionBanksPage Exam Question View link", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiDelete.mockReset();
    mockApiGet.mockImplementation((url: string) => {
      if (String(url).includes("/admin/question-banks/exam-questions")) {
        return Promise.resolve({
          data: {
            items: [
              {
                id: "6a588da077519cb09f0ae653",
                question: "Which statement about gametes is correct?",
                subject: "Biology",
                examBoard: "Edexcel",
                level: "IGCSE",
                topic: "Gametes",
                topicKey: "edexcel-igcse-biology:gametes-and-fertilisation",
                type: "composite",
                status: "draft",
                marks: 1,
                teacherId: "t1",
                ownerName: "Teacher",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
            total: 1,
            limit: 50,
            offset: 0,
          },
        });
      }
      return Promise.resolve({ data: { items: [], total: 0, limit: 50, offset: 0 } });
    });
  });

  test("View link includes exact question ID and not topic-only teacher bank", async () => {
    render(
      <MemoryRouter>
        <AdminQuestionBanksPage />
      </MemoryRouter>
    );

    // Switch to Exam Questions tab
    const examTab = await screen.findByRole("button", { name: /Exam Questions/i });
    examTab.click();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        "/admin/question-banks/exam-questions",
        expect.any(Object)
      );
    });

    const viewLink = await screen.findByTestId(
      "admin-question-banks-exam-view-6a588da077519cb09f0ae653"
    );
    expect(viewLink).toHaveAttribute(
      "href",
      "/admin/question-banks/exam-questions/6a588da077519cb09f0ae653"
    );
    expect(viewLink.getAttribute("href")).not.toMatch(/teacher\/exam-question-bank/);
    expect(viewLink.getAttribute("href")).not.toMatch(/topic-banks\/flashcards/);
    expect(viewLink.getAttribute("href")).not.toMatch(/topicKey=/);
    expect(
      screen.getByTestId("admin-question-banks-exam-edit-unavailable-6a588da077519cb09f0ae653")
    ).toHaveTextContent(/Edit unavailable/i);
    expect(screen.queryByRole("link", { name: /^Edit$/i })).not.toBeInTheDocument();
  });
});
