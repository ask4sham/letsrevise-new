/**
 * Student My Work page — status-first accordion layout tests.
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import StudentMyWorkPage from "../StudentMyWorkPage";
import * as studentMyWorkApi from "../../api/studentMyWork";
import type { MyWorkItem, MyWorkResponse } from "../../api/studentMyWork";

jest.mock("../../api/studentMyWork", () => ({
  __esModule: true,
  getStudentMyWork: jest.fn(),
}));

const getStudentMyWork = studentMyWorkApi.getStudentMyWork as jest.MockedFunction<
  typeof studentMyWorkApi.getStudentMyWork
>;

function item(overrides: Partial<MyWorkItem> & Pick<MyWorkItem, "id" | "title">): MyWorkItem {
  return {
    type: "worksheet",
    status: "In progress",
    rawStatus: "IN_PROGRESS",
    dueAt: null,
    released: false,
    score: null,
    maxScore: null,
    submittedAt: null,
    linkTo: `/w/${overrides.id}`,
    ...overrides,
  };
}

const NOW_ISO_PAST = "2020-01-01T00:00:00.000Z";
const NOW_ISO_SOON = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
const NOW_ISO_LATER = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

function mockPayload(partial?: Partial<MyWorkResponse>): MyWorkResponse {
  return {
    worksheets: [],
    quizzes: [],
    assessments: [],
    ...partial,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <StudentMyWorkPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("loads once and shows compact loading state", async () => {
  let resolveFn: (value: MyWorkResponse) => void = () => undefined;
  getStudentMyWork.mockImplementation(
    () =>
      new Promise<MyWorkResponse>((resolve) => {
        resolveFn = resolve;
      })
  );

  renderPage();
  expect(screen.getByRole("status")).toHaveTextContent(/loading your work/i);
  expect(getStudentMyWork).toHaveBeenCalledTimes(1);

  resolveFn(mockPayload());
  await waitFor(() => {
    expect(screen.getByText("No work here yet")).toBeInTheDocument();
  });
});

test("completely empty result shows empty copy and browse CTA without accordions", async () => {
  getStudentMyWork.mockResolvedValue(mockPayload());
  renderPage();

  await waitFor(() => {
    expect(screen.getByText("No work here yet")).toBeInTheDocument();
  });
  expect(
    screen.getByText(/When you begin a worksheet, quiz or assessment/i)
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /browse lessons/i })).toHaveAttribute(
    "href",
    "/browse-lessons"
  );
  expect(screen.queryByRole("button", { name: /Needs your attention/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /In progress/i })).not.toBeInTheDocument();
});

test("type filter counts and accessible selected state", async () => {
  getStudentMyWork.mockResolvedValue(
    mockPayload({
      worksheets: [item({ id: "w1", title: "WS One", dueAt: NOW_ISO_LATER })],
      quizzes: [item({ id: "q1", type: "quiz", title: "Quiz One", linkTo: "/q/q1", dueAt: NOW_ISO_LATER })],
      assessments: [
        item({
          id: "a1",
          type: "assessment",
          title: "Assessment One",
          linkTo: "/q/a1",
          dueAt: NOW_ISO_LATER,
        }),
      ],
    })
  );
  renderPage();

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /All \(3\)/i })).toBeInTheDocument();
  });
  expect(screen.getByRole("button", { name: /Worksheets \(1\)/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Quizzes \(1\)/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Assessments \(1\)/i })).toBeInTheDocument();

  const allBtn = screen.getByRole("button", { name: /All \(3\)/i });
  expect(allBtn).toHaveAttribute("aria-pressed", "true");

  await userEvent.click(screen.getByRole("button", { name: /Quizzes \(1\)/i }));
  expect(screen.getByRole("button", { name: /Quizzes \(1\)/i })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  expect(allBtn).toHaveAttribute("aria-pressed", "false");
  expect(getStudentMyWork).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Quiz One")).toBeInTheDocument();
  expect(screen.queryByText("WS One")).not.toBeInTheDocument();
});

test("mutually exclusive grouping and classification precedence", async () => {
  getStudentMyWork.mockResolvedValue(
    mockPayload({
      worksheets: [
        item({
          id: "released",
          title: "Released WS",
          released: true,
          rawStatus: "MARKED",
          status: "Released",
          score: 9,
          maxScore: 10,
          viewLink: "/student/worksheet-attempts/released",
        }),
        item({
          id: "waiting",
          title: "Waiting WS",
          rawStatus: "SUBMITTED",
          status: "Awaiting release",
          dueAt: NOW_ISO_PAST,
          viewLink: "/student/worksheet-attempts/waiting",
        }),
        item({
          id: "overdue",
          title: "Overdue WS",
          dueAt: NOW_ISO_PAST,
        }),
        item({
          id: "duesoon",
          title: "Due Soon WS",
          dueAt: NOW_ISO_SOON,
        }),
        item({
          id: "active",
          title: "Active WS",
          dueAt: NOW_ISO_LATER,
        }),
      ],
    })
  );
  renderPage();

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Needs your attention \(2\)/i })).toBeInTheDocument();
  });

  expect(screen.getByRole("button", { name: /In progress \(1\)/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Waiting for results \(1\)/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Completed & results \(1\)/i })).toBeInTheDocument();

  // Default: first non-empty (attention) expanded
  const attention = screen.getByRole("button", { name: /Needs your attention \(2\)/i });
  expect(attention).toHaveAttribute("aria-expanded", "true");
  expect(attention).toHaveAttribute("aria-controls", "my-work-panel-attention");
  expect(screen.getByText("Overdue WS")).toBeVisible();
  expect(screen.getByText("Due Soon WS")).toBeVisible();
  expect(screen.getByText("Overdue")).toBeVisible();
  expect(screen.getByText("Due soon")).toBeVisible();

  // Collapsed sections hide items until opened
  expect(screen.getByText("Active WS")).not.toBeVisible();
  expect(screen.getByText("Waiting WS")).not.toBeVisible();
  expect(screen.getByText("Released WS")).not.toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: /Waiting for results \(1\)/i }));
  expect(screen.getByText("Waiting WS")).toBeVisible();
  const waitingCard = screen.getByRole("listitem", { name: /Waiting WS/i });
  expect(within(waitingCard).queryByText("Overdue")).not.toBeInTheDocument();
  expect(within(waitingCard).getByText("Waiting for results")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /Completed & results \(1\)/i }));
  expect(screen.getByText("Released WS")).toBeVisible();
  expect(screen.getByText("Score 9 / 10")).toBeVisible();
});

test("accordion keyboard semantics via native button", async () => {
  getStudentMyWork.mockResolvedValue(
    mockPayload({
      worksheets: [item({ id: "w1", title: "Only Item", dueAt: NOW_ISO_LATER })],
    })
  );
  renderPage();

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /In progress \(1\)/i })).toBeInTheDocument();
  });

  const header = screen.getByRole("button", { name: /In progress \(1\)/i });
  expect(header).toHaveAttribute("aria-expanded", "true");
  await userEvent.click(header);
  expect(header).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByText("Only Item")).not.toBeVisible();
  await userEvent.click(header);
  expect(header).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Only Item")).toBeVisible();
});

test("preserves worksheet/quiz/assessment actions and release-gated scores", async () => {
  getStudentMyWork.mockResolvedValue(
    mockPayload({
      worksheets: [
        item({
          id: "w-active",
          title: "WS Active",
          linkTo: "/w/share-w",
          dueAt: NOW_ISO_LATER,
        }),
        item({
          id: "w-released",
          title: "WS Released",
          released: true,
          rawStatus: "MARKED",
          status: "Released",
          score: 4,
          maxScore: 5,
          linkTo: "/w/share-w2",
          viewLink: "/student/worksheet-attempts/w2",
        }),
        item({
          id: "w-hidden-score",
          title: "WS Hidden Score",
          rawStatus: "SUBMITTED",
          status: "Awaiting release",
          released: false,
          score: 99,
          maxScore: 100,
          viewLink: "/student/worksheet-attempts/wh",
        }),
      ],
      quizzes: [
        item({
          id: "q1",
          type: "quiz",
          title: "Quiz Item",
          linkTo: "/q/quiz-share",
          dueAt: NOW_ISO_LATER,
        }),
      ],
      assessments: [
        item({
          id: "a1",
          type: "assessment",
          title: "Assessment Item",
          linkTo: "/q/assess-share",
          dueAt: NOW_ISO_LATER,
        }),
      ],
    })
  );
  renderPage();

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /In progress/i })).toBeInTheDocument();
  });

  // Expand all needed
  const inProgress = screen.getByRole("button", { name: /In progress \(3\)/i });
  expect(inProgress).toHaveAttribute("aria-expanded", "true");

  const activeCard = screen.getByRole("listitem", { name: /WS Active/i });
  expect(within(activeCard).getByRole("link", { name: "Continue" })).toHaveAttribute(
    "href",
    "/w/share-w"
  );

  const quizCard = screen.getByRole("listitem", { name: /Quiz Item/i });
  expect(within(quizCard).getByRole("link", { name: "Continue" })).toHaveAttribute(
    "href",
    "/q/quiz-share"
  );
  const assessCard = screen.getByRole("listitem", { name: /Assessment Item/i });
  expect(within(assessCard).getByRole("link", { name: "Continue" })).toHaveAttribute(
    "href",
    "/q/assess-share"
  );

  await userEvent.click(screen.getByRole("button", { name: /Completed & results \(1\)/i }));
  const releasedCard = screen.getByRole("listitem", { name: /WS Released/i });
  expect(within(releasedCard).getByRole("link", { name: "View result" })).toHaveAttribute(
    "href",
    "/student/worksheet-attempts/w2"
  );
  expect(within(releasedCard).getByRole("link", { name: "Open" })).toHaveAttribute(
    "href",
    "/w/share-w2"
  );
  expect(within(releasedCard).getByText("Score 4 / 5")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /Waiting for results \(1\)/i }));
  const waitingCard = screen.getByRole("listitem", { name: /WS Hidden Score/i });
  expect(within(waitingCard).queryByText(/Score 99/)).not.toBeInTheDocument();
  expect(within(waitingCard).getByRole("link", { name: "View submission" })).toHaveAttribute(
    "href",
    "/student/worksheet-attempts/wh"
  );

  // Security: no raw IDs rendered as visible text
  expect(screen.queryByText("w-active")).not.toBeInTheDocument();
  expect(screen.queryByText("/student/worksheet-attempts/w2")).not.toBeInTheDocument();
});

test("error state with try again and no raw stack", async () => {
  getStudentMyWork
    .mockRejectedValueOnce({
      response: { data: { error: "Internal Mongo stack at Object.connect" } },
    })
    .mockResolvedValueOnce(mockPayload());

  renderPage();

  await waitFor(() => {
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  expect(screen.getByRole("alert")).toHaveTextContent(/could not load your work/i);
  expect(screen.queryByText(/Mongo stack/i)).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /try again/i }));
  await waitFor(() => {
    expect(screen.getByText("No work here yet")).toBeInTheDocument();
  });
  expect(getStudentMyWork).toHaveBeenCalledTimes(2);
});

test("type filter empty state", async () => {
  getStudentMyWork.mockResolvedValue(
    mockPayload({
      worksheets: [item({ id: "w1", title: "Only WS", dueAt: NOW_ISO_LATER })],
    })
  );
  renderPage();

  await waitFor(() => {
    expect(screen.getByText("Only WS")).toBeInTheDocument();
  });

  await userEvent.click(screen.getByRole("button", { name: /Quizzes \(0\)/i }));
  expect(screen.getByText("No quizzes here yet.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /In progress/i })).not.toBeInTheDocument();
});
