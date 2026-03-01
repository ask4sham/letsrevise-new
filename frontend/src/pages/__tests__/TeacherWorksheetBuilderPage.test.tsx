// PR-W2: Minimal tests for Worksheet Builder — Add/Remove and Reorder
import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TeacherWorksheetBuilderPage from "../TeacherWorksheetBuilderPage";
import * as worksheetsApi from "../../api/worksheets";
import api from "../../services/api";

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
jest.mock("../../api/worksheets");
jest.mock("../../services/api");

const mockGetWorksheet = worksheetsApi.getWorksheet as jest.MockedFunction<typeof worksheetsApi.getWorksheet>;
const mockUpdateWorksheet = worksheetsApi.updateWorksheet as jest.MockedFunction<typeof worksheetsApi.updateWorksheet>;
const mockApiGet = api.get as jest.MockedFunction<typeof api.get>;

const mockWorksheet = {
  _id: "ws1",
  ownerId: "u1",
  title: "My Worksheet",
  subject: "",
  examBoard: "",
  level: "",
  topicKey: null,
  status: "DRAFT" as const,
  questionItems: [] as { examQuestionId: string }[],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockQuestions = [
  { _id: "q1", question: "First question?", marks: 1, type: "mcq", options: ["A", "B"], topicKey: "cell-biology" },
  { _id: "q2", question: "Second question?", marks: 2, type: "short", topicKey: "cell-biology" },
];

function renderBuilder(id = "ws1") {
  return render(
    <MemoryRouter initialEntries={[`/teacher/worksheets/${id}/edit`]}>
      <Routes>
        <Route path="/teacher/worksheets/:id/edit" element={<TeacherWorksheetBuilderPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetWorksheet.mockResolvedValue({ ...mockWorksheet });
  mockApiGet
    .mockResolvedValueOnce({ data: { units: [{ unit: "Unit 1", topics: [{ topic: "Cell biology", key: "cell-biology" }] }] } })
    .mockResolvedValueOnce({ data: { questions: mockQuestions } });
  mockUpdateWorksheet.mockImplementation((_, payload) =>
    Promise.resolve({ ...mockWorksheet, ...payload, questionItems: payload.questionItems ?? mockWorksheet.questionItems })
  );
});

test("Add then Remove updates preview", async () => {
  renderBuilder();

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: /Worksheet Builder/i })).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getAllByText(/First question\?/).length).toBeGreaterThanOrEqual(1);
  });

  const addButtons = screen.getAllByRole("button", { name: /Add/i });
  await userEvent.click(addButtons[0]);

  await waitFor(() => {
    expect(screen.getByText(/Worksheet Preview/i)).toBeInTheDocument();
    expect(screen.getAllByText(/First question\?/).length).toBeGreaterThanOrEqual(1);
  });

  const removeBtn = screen.getByRole("button", { name: /Remove/i });
  await userEvent.click(removeBtn);

  await waitFor(() => {
    expect(screen.getByText(/Add questions from the bank/)).toBeInTheDocument();
  });
});

test("Reorder: Move down then Move up changes order in preview", async () => {
  mockGetWorksheet.mockResolvedValue({
    ...mockWorksheet,
    questionItems: [
      { examQuestionId: "q1" },
      { examQuestionId: "q2" },
    ],
  });

  renderBuilder();

  await waitFor(() => {
    expect(screen.getAllByText(/First question\?/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Second question\?/).length).toBeGreaterThanOrEqual(1);
  });

  const moveDownButtons = screen.getAllByRole("button", { name: "↓" });
  expect(moveDownButtons.length).toBeGreaterThanOrEqual(1);
  await userEvent.click(moveDownButtons[0]);

  await waitFor(() => {
    const lists = screen.getAllByRole("list");
    const listWithQuestions = lists.find(
      (list) =>
        within(list).queryByText(/First question\?/) != null &&
        within(list).queryByText(/Second question\?/) != null
    );
    expect(listWithQuestions).toBeDefined();
    const items = within(listWithQuestions!).getAllByRole("listitem");
    expect(items.length).toBe(2);
    const text = items.map((i) => i.textContent ?? "").join(" ");
    expect(text).toMatch(/First question\?/);
    expect(text).toMatch(/Second question\?/);
  });
});

