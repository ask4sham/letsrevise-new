/**
 * Integration tests for LessonViewPage: quiz rendering and access gating.
 * - When accessDecision.allowed === true and lesson has quiz questions: renders QuizView (Multiple choice or Short answer).
 * - When accessDecision.allowed === false and reason === FREE_PREVIEW: shows locked message, no QuizView.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LessonViewPage from "../LessonViewPage";
import { fetchLessonById } from "../../api/lessons";

jest.mock("axios", () => {
  const thenable = { then: (cb: (v: any) => any) => Promise.resolve(cb({ data: {} })), catch: () => thenable };
  return {
    __esModule: true,
    default: {
      get: () => thenable,
      post: () => thenable,
      create: () => ({
        get: () => thenable,
        post: () => thenable,
        interceptors: {
          request: { use: () => {} },
          response: { use: () => {} },
        },
      }),
    },
    AxiosError: class AxiosError extends Error {},
    AxiosHeaders: function AxiosHeaders() {},
    AxiosInstance: function AxiosInstance() {},
    AxiosRequestConfig: {},
    InternalAxiosRequestConfig: {},
  };
});
jest.mock("../../api/lessons");
jest.mock("react-markdown", () => ({ __esModule: true, default: (props: { children?: React.ReactNode }) => props.children ?? null }));
jest.mock("../../hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    user: { _id: "u1", userType: "student" },
    token: "test-token",
    refresh: jest.fn(),
  }),
}));

const mockFetchLessonById = fetchLessonById as jest.MockedFunction<typeof fetchLessonById>;

// Valid 24-char hex MongoDB ObjectId (LessonViewPage rejects other formats)
const validLessonId = "507f1f77bcf86cd799439011";

function renderLesson(lessonId = validLessonId) {
  return render(
    <MemoryRouter initialEntries={[`/lesson/${lessonId}`]}>
      <Routes>
        <Route path="/lesson/:id" element={<LessonViewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const baseLessonData = {
  _id: validLessonId,
  title: "Test Lesson",
  content: "Some content",
  isPublished: true,
  subject: "Biology",
  level: "GCSE",
  topic: "Cell biology",
  teacherName: "Teacher",
  teacherId: "t1",
  estimatedDuration: 10,
  views: 0,
  averageRating: 0,
  totalRatings: 0,
  createdAt: new Date().toISOString(),
  pages: [],
  flashcards: [],
  pastPapers: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("when access allowed and lesson has quiz questions, renders QuizView with Multiple choice or Short answer", async () => {
  mockFetchLessonById.mockResolvedValue({
    ok: true,
    data: {
      ...baseLessonData,
      quiz: {
        timeSeconds: 600,
        questions: [
          {
            id: "q1",
            type: "mcq",
            question: "What is a nucleus?",
            options: ["Control center", "Membrane", "Ribosome"],
            correctAnswer: "Control center",
          },
        ],
      },
    },
    accessDecision: { allowed: true },
  });

  renderLesson();

  await waitFor(() => {
    expect(screen.getByText(/Check your understanding/i)).toBeInTheDocument();
  });

  expect(screen.getByText("Multiple choice")).toBeInTheDocument();
  expect(screen.getByText("What is a nucleus?")).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: /Control center/i })).toBeInTheDocument();
  expect(screen.queryByText(/Quiz available after unlocking/i)).not.toBeInTheDocument();
});

test("when access allowed and lesson has short-answer quiz, renders QuizView with Short answer and textarea", async () => {
  mockFetchLessonById.mockResolvedValue({
    ok: true,
    data: {
      ...baseLessonData,
      quiz: {
        timeSeconds: 600,
        questions: [
          {
            id: "q2",
            type: "short",
            question: "Describe the function of the nucleus.",
            correctAnswer: "Contains DNA and controls cell activities.",
          },
        ],
      },
    },
    accessDecision: { allowed: true },
  });

  renderLesson();

  await waitFor(() => {
    expect(screen.getByText(/Check your understanding/i)).toBeInTheDocument();
  });

  expect(screen.getByText("Short answer")).toBeInTheDocument();
  expect(screen.getByText("Describe the function of the nucleus.")).toBeInTheDocument();
  expect(screen.getByRole("textbox")).toBeInTheDocument();
  expect(screen.queryByText(/Quiz available after unlocking/i)).not.toBeInTheDocument();
});

test("when access denied with FREE_PREVIEW, shows locked message and does not render QuizView", async () => {
  mockFetchLessonById.mockResolvedValue({
    ok: true,
    data: {
      ...baseLessonData,
      quiz: {
        timeSeconds: 600,
        questions: [
          {
            id: "q1",
            type: "mcq",
            question: "What is a nucleus?",
            options: ["A", "B", "C"],
            correctAnswer: "A",
          },
        ],
      },
    },
    accessDecision: { allowed: false, reason: "FREE_PREVIEW" },
  });

  renderLesson();

  await waitFor(() => {
    expect(screen.getByText(/Check your understanding/i)).toBeInTheDocument();
  });

  expect(screen.getByText(/Quiz available after unlocking the full lesson\./)).toBeInTheDocument();
  expect(screen.queryByText("Multiple choice")).not.toBeInTheDocument();
  expect(screen.queryByText("Short answer")).not.toBeInTheDocument();
});

test("student view does not render page kicker/subtitle block (e.g. Animal and plant cell structure (GCSE))", async () => {
  mockFetchLessonById.mockResolvedValue({
    ok: true,
    data: {
      ...baseLessonData,
      pages: [
        {
          pageId: "p1",
          title: "Simple Living Cell",
          order: 0,
          blocks: [
            { type: "text", content: "Animal and plant cell structure (GCSE)" },
            { type: "text", content: "Cells are the basic unit of life." },
          ],
        },
      ],
      quiz: { timeSeconds: 600, questions: [] },
    },
    accessDecision: { allowed: true },
  });

  renderLesson();

  await waitFor(() => {
    expect(screen.getByText("Simple Living Cell")).toBeInTheDocument();
  });

  expect(screen.getByText("Cells are the basic unit of life.")).toBeInTheDocument();
  expect(screen.queryByText(/Animal and plant cell structure\s*\(GCSE\)/i)).not.toBeInTheDocument();
});

/** Regression: hero caption must not render when SHOW_PAGE_KICKER is false (caption = page kicker). */
test("student view does not render page kicker (hero caption) when SHOW_PAGE_KICKER is false", async () => {
  mockFetchLessonById.mockResolvedValue({
    ok: true,
    data: {
      ...baseLessonData,
      pages: [
        {
          pageId: "p1",
          title: "Simple Living Cell",
          order: 0,
          hero: { type: "image", src: "/visuals/cell.png", caption: "Animal and plant cell structure (GCSE)" },
          blocks: [{ type: "text", content: "Main content here." }],
        },
      ],
      quiz: { timeSeconds: 600, questions: [] },
    },
    accessDecision: { allowed: true },
  });

  renderLesson();

  await waitFor(() => {
    expect(screen.getByText("Simple Living Cell")).toBeInTheDocument();
  });

  expect(screen.getByText("Main content here.")).toBeInTheDocument();
  expect(screen.queryByTestId("page-kicker")).not.toBeInTheDocument();
  expect(screen.queryByText(/Animal and plant cell structure\s*\(GCSE\)/i)).not.toBeInTheDocument();
});
