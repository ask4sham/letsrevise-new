/**
 * Teacher class detail — invite preview, status actions, roster.
 */
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TeacherClassDetailPage from "../TeacherClassDetailPage";
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
    user: { _id: "t1", userType: "teacher", firstName: "Tina" },
  }),
}));

jest.mock("../../api/studentClasses");

const mockGetClass = studentClassesApi.getClass as jest.MockedFunction<
  typeof studentClassesApi.getClass
>;
const mockGetInvitations = studentClassesApi.getInvitations as jest.MockedFunction<
  typeof studentClassesApi.getInvitations
>;
const mockGetClassStudents = studentClassesApi.getClassStudents as jest.MockedFunction<
  typeof studentClassesApi.getClassStudents
>;
const mockPreviewEmailInput = studentClassesApi.previewEmailInput as jest.MockedFunction<
  typeof studentClassesApi.previewEmailInput
>;
const mockPreviewCsv = studentClassesApi.previewCsv as jest.MockedFunction<
  typeof studentClassesApi.previewCsv
>;
const mockCreateInvitations = studentClassesApi.createInvitations as jest.MockedFunction<
  typeof studentClassesApi.createInvitations
>;
const mockCancelInvitation = studentClassesApi.cancelInvitation as jest.MockedFunction<
  typeof studentClassesApi.cancelInvitation
>;
const mockResendInvitation = studentClassesApi.resendInvitation as jest.MockedFunction<
  typeof studentClassesApi.resendInvitation
>;
const mockRemoveClassStudent = studentClassesApi.removeClassStudent as jest.MockedFunction<
  typeof studentClassesApi.removeClassStudent
>;

function renderDetail(path = "/teacher/classes/class-1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/teacher/classes/:classPublicId" element={<TeacherClassDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetClass.mockResolvedValue({
    publicId: "class-1",
    name: "Year 11 Biology",
    status: "active",
    subject: "Biology",
  } as any);
  mockGetInvitations.mockResolvedValue([
    {
      publicId: "inv-pending",
      targetEmail: "pending@ex.com",
      status: "pending",
      requestedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      publicId: "inv-accepted",
      targetEmail: "linked@ex.com",
      status: "accepted",
      student: { displayName: "Sam Student" },
    },
    {
      publicId: "inv-declined",
      targetEmail: "declined@ex.com",
      status: "declined",
    },
  ] as any);
  mockGetClassStudents.mockResolvedValue([
    {
      membershipPublicId: "mem-1",
      status: "active",
      joinedAt: "2026-01-02T00:00:00.000Z",
      student: { displayName: "Sam Student" },
    },
  ] as any);
});

test("renders class header and roster without raw IDs or pre-consent names for pending", async () => {
  renderDetail();
  await screen.findByRole("heading", { name: "Year 11 Biology" });

  fireEvent.click(screen.getByRole("tab", { name: "Students" }));
  expect(screen.getByText("Sam Student")).toBeInTheDocument();
  expect(screen.getAllByText("Linked").length).toBeGreaterThan(0);
  expect(screen.queryByText(/class-1|mem-1|inv-pending/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Invitations" }));
  expect(screen.getByText("pending@ex.com")).toBeInTheDocument();
  expect(screen.getByText("Cancel request")).toBeInTheDocument();
  expect(screen.getByText("Resend invitation")).toBeInTheDocument();
  expect(screen.getByText(/Sam Student/)).toBeInTheDocument();
});

test("paste preview then sends only validEmails", async () => {
  mockPreviewEmailInput.mockResolvedValue({
    ok: true,
    summary: { totalSubmitted: 3, validCount: 2, duplicateCount: 1, invalidCount: 0 },
    validEmails: ["a@ex.com", "b@ex.com"],
    duplicateEntries: ["a@ex.com"],
    invalidEntries: [],
  });
  mockCreateInvitations.mockResolvedValue({
    ok: true,
    message: "Invitations processed.",
    summary: { submitted: 2, invalid: 0, duplicates: 0 },
  });

  renderDetail("/teacher/classes/class-1?add=1");
  const emailField = await screen.findByLabelText(/Email addresses/i);

  fireEvent.change(emailField, {
    target: { value: "a@ex.com\nb@ex.com\na@ex.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Review invitations/i }));

  expect(await screen.findByText(/2 valid/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Send 2 invitations/i }));

  await waitFor(() => {
    expect(mockCreateInvitations).toHaveBeenCalledWith("class-1", ["a@ex.com", "b@ex.com"]);
  });
});

test("csv preview then sends validEmails from preview", async () => {
  mockPreviewCsv.mockResolvedValue({
    ok: true,
    summary: { totalRows: 2, validCount: 1, duplicateCount: 0, invalidCount: 1 },
    validEmails: ["csv@ex.com"],
    duplicateEntries: [],
    invalidEntries: [{ row: 2, value: "not-an-email", reason: "Invalid email" }],
  } as any);
  mockCreateInvitations.mockResolvedValue({
    ok: true,
    message: "Invitations processed.",
    summary: { submitted: 1, invalid: 0, duplicates: 0 },
  });

  renderDetail("/teacher/classes/class-1?add=1");
  await screen.findByLabelText(/Email addresses/i);
  fireEvent.click(screen.getByRole("tab", { name: /Upload CSV/i }));

  const fileInput = screen.getByLabelText(/CSV file/i);
  const file = new File(["email\ncsv@ex.com\n"], "students.csv", { type: "text/csv" });
  fireEvent.change(fileInput, { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: /Review CSV/i }));

  expect(await screen.findByText(/1 valid/i)).toBeInTheDocument();
  expect(screen.getByText(/Invalid email/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Send invitation$/i }));

  await waitFor(() => {
    expect(mockPreviewCsv).toHaveBeenCalledWith("class-1", file);
  });
  expect(mockCreateInvitations).toHaveBeenCalledWith("class-1", ["csv@ex.com"]);
});

test("rejects non-csv extension client-side", async () => {
  renderDetail("/teacher/classes/class-1?add=1");
  await screen.findByLabelText(/Email addresses/i);
  fireEvent.click(screen.getByRole("tab", { name: /Upload CSV/i }));

  const fileInput = screen.getByLabelText(/CSV file/i);
  const file = new File(["email\na@ex.com\n"], "students.txt", { type: "text/plain" });
  fireEvent.change(fileInput, { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: /Review CSV/i }));

  expect(await screen.findByText(/Only \.csv files are allowed/i)).toBeInTheDocument();
  expect(mockPreviewCsv).not.toHaveBeenCalled();
});

test("cancel and resend invitation actions call API", async () => {
  mockCancelInvitation.mockResolvedValue({
    publicId: "inv-pending",
    targetEmail: "pending@ex.com",
    status: "cancelled",
  } as any);
  mockResendInvitation.mockResolvedValue({
    publicId: "inv-declined",
    targetEmail: "declined@ex.com",
    status: "pending",
  } as any);

  renderDetail();
  await screen.findByRole("heading", { name: "Year 11 Biology" });
  fireEvent.click(screen.getByRole("tab", { name: "Invitations" }));

  fireEvent.click(screen.getByRole("button", { name: /Cancel request/i }));
  fireEvent.click(screen.getByRole("button", { name: /^Cancel invitation$/i }));
  await waitFor(() => {
    expect(mockCancelInvitation).toHaveBeenCalledWith("class-1", "inv-pending");
  });
  expect(await screen.findByText("Invitation cancelled.")).toBeInTheDocument();

  const declinedRegion = await screen.findByLabelText(/Invitation for declined@ex.com/i);
  await waitFor(() => {
    expect(
      within(declinedRegion).getByRole("button", { name: /Resend invitation/i })
    ).not.toBeDisabled();
  });

  fireEvent.click(within(declinedRegion).getByRole("button", { name: /Resend invitation/i }));
  await waitFor(() => {
    expect(mockResendInvitation).toHaveBeenCalledWith("class-1", "inv-declined");
  });
});

test("remove student requires confirmation and calls remove endpoint", async () => {
  mockRemoveClassStudent.mockResolvedValue({
    publicId: "mem-1",
    status: "removed",
  } as any);
  mockGetInvitations.mockResolvedValue([]);

  renderDetail();
  await screen.findByRole("heading", { name: "Year 11 Biology" });
  fireEvent.click(screen.getByRole("tab", { name: "Students" }));
  fireEvent.click(screen.getByRole("button", { name: /Remove from class/i }));

  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText(/Remove this student from Year 11 Biology/i)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: /^Remove student$/i }));

  await waitFor(() => {
    expect(mockRemoveClassStudent).toHaveBeenCalledWith("class-1", "mem-1");
  });
});

test("archived class disables add students", async () => {
  mockGetClass.mockResolvedValue({
    publicId: "class-1",
    name: "Year 11 Biology",
    status: "archived",
  } as any);
  mockGetInvitations.mockResolvedValue([]);
  mockGetClassStudents.mockResolvedValue([]);

  renderDetail();
  await screen.findByText("Archived");
  expect(screen.queryByRole("button", { name: /^Add students$/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Archive class/i })).not.toBeInTheDocument();
});
