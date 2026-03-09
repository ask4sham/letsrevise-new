/**
 * Content Issues page tests — report flow, dashboard, ownership.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ContentIssuesPage from "../ContentIssuesPage";
import * as lessonIssuesApi from "../../api/lessonIssues";
import api from "../../services/api";

const mockApiGet = jest.fn();
const mockApiPatch = jest.fn();
const mockApiDelete = jest.fn();
jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockApiGet(...args),
    patch: (...args: any[]) => mockApiPatch(...args),
    delete: (...args: any[]) => mockApiDelete(...args),
    post: jest.fn(),
    interceptors: { request: { use: () => {} }, response: { use: () => {} } },
  },
}));

const mockReports: lessonIssuesApi.LessonIssueReport[] = [
  {
    id: "r1",
    lessonId: "l1",
    lessonTitle: "Cell Biology Basics",
    lessonTopicKey: "biology-aqa-cell-structure",
    lessonTopic: "Cell structure",
    lessonSubTopic: null,
    pageId: "p1",
    pageTitle: "Introduction",
    pageOrder: 1,
    blockId: "0",
    reportType: "incorrect_information",
    reportTypeLabel: "Incorrect information",
    description: "Wrong formula",
    suggestedFix: "Use correct formula",
    reportedByUserId: "u1",
    reportedByName: "Student One",
    userRole: "student",
    status: "open",
    createdAt: new Date().toISOString(),
  },
];

const mockStats: lessonIssuesApi.ReportStats = {
  openCount: 5,
  lessonsAffected: 2,
  topicsAffected: 2,
  resolvedThisWeek: 3,
};

function renderContentIssues() {
  return render(
    <MemoryRouter initialEntries={["/teacher/content-issues"]}>
      <Routes>
        <Route path="/teacher/content-issues" element={<ContentIssuesPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApiGet.mockImplementation((url: string) => {
    if (url?.includes?.("/stats")) return Promise.resolve({ data: mockStats });
    return Promise.resolve({ data: { reports: mockReports } });
  });
});

test("Content Issues page renders and shows summary cards", async () => {
  renderContentIssues();

  await waitFor(() => {
    expect(screen.getByText("Content Issues")).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText("Resolved this week")).toBeInTheDocument();
    expect(screen.getAllByText("Open issues").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lessons affected").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Topics affected").length).toBeGreaterThan(0);
  });
});

test("Content Issues page shows reports table when data loaded", async () => {
  renderContentIssues();

  await waitFor(() => {
    expect(screen.getAllByText("Cell Biology Basics").length).toBeGreaterThan(0);
    expect(screen.getByText("Incorrect information")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  expect(screen.getByText("All reports")).toBeInTheDocument();
});

test("Priority badge appears for report type", async () => {
  renderContentIssues();

  await waitFor(() => {
    expect(screen.getByText("High")).toBeInTheDocument();
  });
});

test("Edit lesson and View lesson links present", async () => {
  renderContentIssues();

  await waitFor(() => {
    const editLinks = screen.getAllByText("Edit lesson");
    expect(editLinks.length).toBeGreaterThan(0);
    expect(screen.getByText("View lesson (page)")).toBeInTheDocument();
  });
});

test("Mark resolved button calls API and refreshes", async () => {
  mockApiPatch.mockResolvedValue({ data: { ok: true, status: "resolved" } });

  renderContentIssues();

  await waitFor(() => {
    expect(screen.getAllByText("Mark resolved").length).toBeGreaterThan(0);
  });

  const resolveBtns = screen.getAllByText("Mark resolved");
  await userEvent.click(resolveBtns[0]);

  await waitFor(() => {
    expect(mockApiPatch).toHaveBeenCalledWith(
      "/lesson-issues/r1",
      expect.objectContaining({ status: "resolved" })
    );
  });
});

test("REPORT_PRIORITY maps report types correctly", () => {
  expect(lessonIssuesApi.REPORT_PRIORITY.incorrect_information).toBe("high");
  expect(lessonIssuesApi.REPORT_PRIORITY.question_incorrect).toBe("high");
  expect(lessonIssuesApi.REPORT_PRIORITY.typo_spelling).toBe("low");
  expect(lessonIssuesApi.REPORT_PRIORITY.image_problem).toBe("medium");
});
