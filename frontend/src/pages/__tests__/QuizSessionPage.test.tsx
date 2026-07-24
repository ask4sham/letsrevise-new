/**
 * @jest-environment jsdom
 *
 * PracticeSet resume must not require StudentTeacherLink / dashboard bootstrap.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import QuizSessionPage from "../QuizSessionPage";
import { generatePracticeSet, getPracticeSet } from "../../api/practiceSets";
import { getStudentDashboard } from "../../api/studentDashboard";
import { clearSingleFlightForTests } from "../../utils/freshPracticeSingleFlight";

jest.mock("../../api/practiceSets", () => ({
  generatePracticeSet: jest.fn(),
  getPracticeSet: jest.fn(),
}));

jest.mock("../../api/studentDashboard", () => ({
  getStudentDashboard: jest.fn(),
}));

jest.mock("../../components/practice/PracticeRunner", () => ({
  PracticeRunner: ({
    items,
    practiceSetId,
    teacherId,
    initialIndex,
  }: {
    items: { contentId: string }[];
    practiceSetId?: string | null;
    teacherId?: string;
    initialIndex?: number;
  }) => {
    const start = Math.max(0, Number(initialIndex) || 0);
    return (
      <div
        data-testid="practice-runner"
        data-practice-set-id={practiceSetId || ""}
        data-teacher-id={teacherId || ""}
        data-initial-index={String(start)}
      >
        <ul>
          {items.map((it) => (
            <li key={it.contentId}>{it.contentId}</li>
          ))}
        </ul>
      </div>
    );
  },
}));

const getSet = getPracticeSet as jest.MockedFunction<typeof getPracticeSet>;
const generate = generatePracticeSet as jest.MockedFunction<typeof generatePracticeSet>;
const getDash = getStudentDashboard as jest.MockedFunction<typeof getStudentDashboard>;

const TOPIC = "edexcel-igcse-biology:sexual-and-asexual-reproduction-differences";
const SET_ID = "507f1f77bcf86cd799439011";
const LESSON_ID = "6a5ff907bd802b4e9d85f8a9";
const TEACHER_ID = "507f1f77bcf86cd799439099";

const fiveItems = [1, 2, 3, 4, 5].map((n) => ({
  contentType: "quiz_mcq" as const,
  contentId: `q${n}`,
  topicKey: TOPIC,
  prompt: `Question ${n}`,
  choices: ["A", "B", "C", "D"],
}));

function renderQuiz(search: string) {
  const path = `/practice/quiz/${encodeURIComponent(TOPIC)}${search || ""}`;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/practice/quiz/:topicKey" element={<QuizSessionPage />} />
        <Route path="/lesson/:id" element={<div>Lesson page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  clearSingleFlightForTests();
});

afterEach(() => {
  clearSingleFlightForTests();
});

describe("QuizSessionPage practiceSetId resume", () => {
  test("practiceSetId + no linked teacher: loads set, Question 1 of 5, no teacher-link warning", async () => {
    getSet.mockResolvedValue({
      practiceSetId: SET_ID,
      items: fiveItems,
      selectedCount: 5,
      requestedCount: 5,
      availableFreshCount: 5,
      allQuestionsFresh: true,
      teacherId: TEACHER_ID,
    });

    renderQuiz(`?practiceSetId=${SET_ID}&fresh=1&limit=5&lessonId=${LESSON_ID}`);

    expect(await screen.findByTestId("focused-practice-header")).toBeInTheDocument();
    expect(screen.getByTestId("focused-practice-progress-label")).toHaveTextContent(
      "Question 1 of 5"
    );
    expect(screen.queryByText(/Link to a teacher/i)).not.toBeInTheDocument();
    expect(screen.getByText("← Back to lesson")).toBeInTheDocument();
    expect(getSet).toHaveBeenCalledWith(SET_ID);
    expect(getDash).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    const runner = screen.getByTestId("practice-runner");
    expect(runner).toHaveAttribute("data-practice-set-id", SET_ID);
    expect(runner).toHaveAttribute("data-teacher-id", TEACHER_ID);
  });

  test("focused practice header, human title, resume copy, no new-questions label", async () => {
    getSet.mockResolvedValue({
      practiceSetId: SET_ID,
      items: fiveItems,
      selectedCount: 5,
      teacherId: TEACHER_ID,
      lessonId: LESSON_ID,
    });

    renderQuiz(
      `?practiceSetId=${SET_ID}&fresh=1&limit=5&lessonId=${LESSON_ID}&startIndex=1`
    );

    expect(await screen.findByTestId("focused-practice-header")).toBeInTheDocument();
    expect(screen.getByText("Focused practice")).toBeInTheDocument();
    expect(screen.getByTestId("focused-practice-title")).toHaveTextContent(
      /Sexual & Asexual Reproduction Differences/i
    );
    expect(screen.getByTestId("focused-practice-copy")).toHaveTextContent(
      "Continue where you left off."
    );
    expect(screen.queryByText(/new questions available/i)).toBeNull();
    expect(screen.queryByText("Try another set")).toBeNull();
  });

  test("startIndex query begins runner at first unanswered question", async () => {
    getSet.mockResolvedValue({
      practiceSetId: SET_ID,
      items: fiveItems,
      selectedCount: 5,
      requestedCount: 5,
      availableFreshCount: 5,
      allQuestionsFresh: true,
      teacherId: TEACHER_ID,
      lessonId: LESSON_ID,
    });

    renderQuiz(
      `?practiceSetId=${SET_ID}&fresh=1&limit=5&lessonId=${LESSON_ID}&startIndex=1`
    );

    expect(await screen.findByTestId("focused-practice-progress-label")).toHaveTextContent(
      "Question 2 of 5"
    );
    expect(screen.getByTestId("focused-practice-remaining")).toHaveTextContent(
      "4 questions remaining"
    );
    const bar = screen.getByTestId("focused-practice-progress-bar");
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    expect(bar).toHaveAttribute("aria-valuemax", "5");
    expect(screen.getByTestId("practice-runner")).toHaveAttribute("data-initial-index", "1");
    expect(generate).not.toHaveBeenCalled();
  });

  test("uses server lessonId for Back to lesson when URL omits lessonId", async () => {
    getSet.mockResolvedValue({
      practiceSetId: SET_ID,
      items: fiveItems,
      selectedCount: 5,
      requestedCount: 5,
      availableFreshCount: 5,
      allQuestionsFresh: true,
      teacherId: TEACHER_ID,
      lessonId: LESSON_ID,
    });

    renderQuiz(`?practiceSetId=${SET_ID}&fresh=1&limit=5`);

    expect(await screen.findByTestId("focused-practice-progress-label")).toHaveTextContent(
      "Question 1 of 5"
    );
    const back = screen.getByText("← Back to lesson");
    expect(back).toHaveAttribute("href", `/lesson/${LESSON_ID}`);
  });

  test("refresh reloads identical item IDs and order without regenerating", async () => {
    getSet.mockResolvedValue({
      practiceSetId: SET_ID,
      items: fiveItems,
      selectedCount: 5,
      requestedCount: 5,
      availableFreshCount: 5,
      allQuestionsFresh: true,
      teacherId: TEACHER_ID,
    });

    const { unmount } = renderQuiz(`?practiceSetId=${SET_ID}&fresh=1&limit=5`);
    expect(await screen.findByTestId("focused-practice-progress-label")).toHaveTextContent(
      "Question 1 of 5"
    );
    expect(screen.getByText("q1")).toBeInTheDocument();
    expect(getSet).toHaveBeenCalled();
    const callsAfterFirstMount = getSet.mock.calls.length;
    unmount();

    renderQuiz(`?practiceSetId=${SET_ID}&fresh=1&limit=5`);
    expect(await screen.findByTestId("focused-practice-progress-label")).toHaveTextContent(
      "Question 1 of 5"
    );
    const ids = screen.getAllByRole("listitem").map((el) => el.textContent);
    expect(ids).toEqual(["q1", "q2", "q3", "q4", "q5"]);
    expect(getSet.mock.calls.length).toBeGreaterThan(callsAfterFirstMount);
    expect(generate).not.toHaveBeenCalled();
    expect(getDash).not.toHaveBeenCalled();
  });

  test("another student 403: recoverable error, no questions, no teacher-link message", async () => {
    getSet.mockRejectedValue({
      status: 403,
      message: "Forbidden",
      data: { error: "Forbidden" },
    });

    renderQuiz(`?practiceSetId=${SET_ID}&fresh=1&lessonId=${LESSON_ID}`);

    expect(await screen.findByText("You do not have access to this practice set.")).toBeInTheDocument();
    expect(screen.queryByText(/Link to a teacher/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("practice-runner")).not.toBeInTheDocument();
    expect(screen.getByText("← Back to lesson")).toBeInTheDocument();
    expect(generate).not.toHaveBeenCalled();
    expect(getDash).not.toHaveBeenCalled();
  });

  test("missing/deleted PracticeSet: recoverable error + Back to lesson", async () => {
    getSet.mockRejectedValue({
      status: 404,
      message: "Practice set not found",
      data: { error: "Practice set not found" },
    });

    renderQuiz(`?practiceSetId=${SET_ID}&fresh=1&lessonId=${LESSON_ID}`);

    expect(await screen.findByText("This practice set is no longer available.")).toBeInTheDocument();
    expect(screen.queryByText(/Link to a teacher/i)).not.toBeInTheDocument();
    expect(screen.getByText("← Back to lesson")).toBeInTheDocument();
  });

  test("focused shell uses centred max-width container", async () => {
    getSet.mockResolvedValue({
      practiceSetId: SET_ID,
      items: fiveItems,
      teacherId: TEACHER_ID,
      lessonId: LESSON_ID,
    });
    renderQuiz(`?practiceSetId=${SET_ID}&fresh=1&lessonId=${LESSON_ID}`);
    const shell = await screen.findByTestId("focused-practice-shell");
    expect(shell).toBeInTheDocument();
    expect(shell.innerHTML).toMatch(/fp-shell__inner/);
  });
});

describe("QuizSessionPage no practiceSetId (dashboard)", () => {
  test("without linked teacher: shows teacher-link message and does not call getPracticeSet", async () => {
    getDash.mockResolvedValue({
      studyPlan: { specKey: "aqa-gcse-biology" },
      linkedTeachers: [],
    } as any);

    renderQuiz("");

    expect(
      await screen.findByText(/Link to a teacher to access quiz practice/i)
    ).toBeInTheDocument();
    expect(getDash).toHaveBeenCalled();
    expect(getSet).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  test("with linked teacher: generates set (unchanged dashboard path)", async () => {
    getDash.mockResolvedValue({
      studyPlan: { specKey: "aqa-gcse-biology" },
      linkedTeachers: [{ teacherId: TEACHER_ID }],
    } as any);
    const twoItems = fiveItems.slice(0, 2);
    generate.mockResolvedValue({
      practiceSetId: SET_ID,
      items: twoItems,
      selectedCount: 2,
      requestedCount: 10,
      availableFreshCount: 2,
      allQuestionsFresh: false,
    });
    // After generate writes practiceSetId into the URL, resume path loads by ID.
    getSet.mockResolvedValue({
      practiceSetId: SET_ID,
      items: twoItems,
      selectedCount: 2,
      requestedCount: 10,
      availableFreshCount: 2,
      allQuestionsFresh: false,
      teacherId: TEACHER_ID,
    });

    renderQuiz("");

    await waitFor(() => {
      expect(generate).toHaveBeenCalledWith(
        expect.objectContaining({ teacherId: TEACHER_ID })
      );
    });
    expect(await screen.findByTestId("focused-practice-progress-label")).toHaveTextContent(
      "Question 1 of 2"
    );
    expect(getDash).toHaveBeenCalled();
  });
});
