/**
 * PR-W4.2: Minimal test for TeacherWorksheetReportPage — summary + attempts list.
 * Uses manual mock of react-router-dom (see src/__mocks__/react-router-dom.js) so tests run without resolving the real package.
 * Mocks axios so services/api.ts can load (real axios is ESM and breaks in Jest).
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TeacherWorksheetReportPage from "../TeacherWorksheetReportPage";
import * as worksheetAssignmentsApi from "../../api/worksheetAssignments";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: () => {} },
        response: { use: () => {} },
      },
    })),
  },
  AxiosError: class AxiosError extends Error {},
  AxiosHeaders: function AxiosHeaders() {},
  AxiosInstance: function AxiosInstance() {},
  AxiosRequestConfig: {},
  InternalAxiosRequestConfig: {},
}));
jest.mock("../../api/worksheetAssignments");

const mockGetReportSummary = worksheetAssignmentsApi.getReportSummary as jest.MockedFunction<
  typeof worksheetAssignmentsApi.getReportSummary
>;
const mockGetAssignmentAttempts = worksheetAssignmentsApi.getAssignmentAttempts as jest.MockedFunction<
  typeof worksheetAssignmentsApi.getAssignmentAttempts
>;

function renderReport(assignmentId = "a1") {
  return render(
    <MemoryRouter initialEntries={[`/teacher/worksheet-assignments/${assignmentId}/report`]}>
      <Routes>
        <Route path="/teacher/worksheet-assignments/:id/report" element={<TeacherWorksheetReportPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetReportSummary.mockResolvedValue({
    attemptsCount: 2,
    submittedCount: 1,
    avgScore: 0.5,
    maxScore: 10,
  });
  mockGetAssignmentAttempts.mockResolvedValue([]);
});

test("TeacherWorksheetReportPage shows loading then summary and attempts section", async () => {
  renderReport();

  expect(screen.getByText(/Loading report/)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: /Assignment results/i })).toBeInTheDocument();
  });

  expect(mockGetReportSummary).toHaveBeenCalledWith("a1");
  expect(mockGetAssignmentAttempts).toHaveBeenCalledWith("a1");
  expect(screen.getByRole("heading", { name: /Attempts/i })).toBeInTheDocument();
  expect(screen.getByText(/No attempts yet/)).toBeInTheDocument();
});

test("TeacherWorksheetReportPage shows attempts table when list is non-empty", async () => {
  mockGetAssignmentAttempts.mockResolvedValue([
    {
      _id: "att1",
      studentName: "Alice",
      status: "SUBMITTED",
      score: 8,
      maxScore: 10,
      submittedAt: "2025-01-15T12:00:00Z",
      updatedAt: "2025-01-15T12:00:00Z",
      createdAt: "2025-01-15T11:00:00Z",
    },
  ]);

  renderReport();

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: /Assignment results/i })).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
  expect(screen.getByRole("button", { name: /View attempt/i })).toBeInTheDocument();
});
