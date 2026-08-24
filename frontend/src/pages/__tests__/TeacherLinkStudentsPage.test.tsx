/**
 * Teacher class hub — no raw Student ID UI.
 */
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TeacherLinkStudentsPage from "../TeacherLinkStudentsPage";
import * as studentClassesApi from "../../api/studentClasses";

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
}));

jest.mock("../../hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    user: { _id: "t1", userType: "teacher", firstName: "Tina", email: "t@test.com" },
  }),
}));

jest.mock("../../api/studentClasses");

const mockGetMyClasses = studentClassesApi.getMyClasses as jest.MockedFunction<
  typeof studentClassesApi.getMyClasses
>;
const mockCreateClass = studentClassesApi.createClass as jest.MockedFunction<
  typeof studentClassesApi.createClass
>;

function renderHub() {
  return render(
    <MemoryRouter initialEntries={["/teacher/ops/link-students"]}>
      <Routes>
        <Route path="/teacher/ops/link-students" element={<TeacherLinkStudentsPage />} />
        <Route path="/teacher/classes/:classPublicId" element={<div>Class detail</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("shows empty state and no Student ID / Teacher ID fields", async () => {
  mockGetMyClasses.mockResolvedValue([]);
  renderHub();

  await waitFor(() => {
    expect(screen.getByText(/You have not created a class yet/i)).toBeInTheDocument();
  });

  expect(screen.getByRole("heading", { name: /Link students/i })).toBeInTheDocument();
  expect(screen.queryByLabelText(/Student ID/i)).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText(/Paste student/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Teacher ID/i)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Create your first class/i })).toBeInTheDocument();
});

test("lists active classes and separates archived", async () => {
  mockGetMyClasses.mockResolvedValue([
    {
      publicId: "active-1",
      name: "Year 11 Biology",
      status: "active",
      subject: "Biology",
      board: "AQA",
    },
    {
      publicId: "arch-1",
      name: "Old Class",
      status: "archived",
    },
  ] as any);

  renderHub();

  await waitFor(() => {
    expect(screen.getByText("Year 11 Biology")).toBeInTheDocument();
  });
  expect(screen.getByText("Old Class")).toBeInTheDocument();
  expect(screen.getByText("Archived classes")).toBeInTheDocument();
  expect(screen.getAllByText("Open class").length).toBeGreaterThan(0);
});

test("create class navigates using returned publicId and does not send teacherId", async () => {
  mockGetMyClasses.mockResolvedValue([]);
  mockCreateClass.mockResolvedValue({
    publicId: "new-class",
    name: "Year 10 Chem",
    status: "active",
  } as any);

  renderHub();
  fireEvent.click(await screen.findByRole("button", { name: /Create your first class/i }));

  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(/Class name/i), {
    target: { value: "Year 10 Chem" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: /^Create class$/i }));

  await waitFor(() => {
    expect(mockCreateClass).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Year 10 Chem" })
    );
  });
  const payload = mockCreateClass.mock.calls[0][0] as Record<string, unknown>;
  expect(payload).not.toHaveProperty("teacherId");
  await waitFor(() => {
    expect(screen.getByText("Class detail")).toBeInTheDocument();
  });
});
