/**
 * Student Classes page — invitations, joined, leave.
 */
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StudentClassesPage from "../StudentClassesPage";
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
    user: { _id: "s1", userType: "student", firstName: "Sam" },
  }),
}));

jest.mock("../../api/studentClasses", () => {
  const actual = jest.requireActual("../../api/studentClasses");
  return {
    ...actual,
    getIncomingClassInvitations: jest.fn(),
    getMyClassMemberships: jest.fn(),
    acceptClassInvitation: jest.fn(),
    declineClassInvitation: jest.fn(),
    leaveClass: jest.fn(),
  };
});

const mockGetIncoming = studentClassesApi.getIncomingClassInvitations as jest.MockedFunction<
  typeof studentClassesApi.getIncomingClassInvitations
>;
const mockGetMemberships = studentClassesApi.getMyClassMemberships as jest.MockedFunction<
  typeof studentClassesApi.getMyClassMemberships
>;
const mockLeave = studentClassesApi.leaveClass as jest.MockedFunction<
  typeof studentClassesApi.leaveClass
>;
const mockAccept = studentClassesApi.acceptClassInvitation as jest.MockedFunction<
  typeof studentClassesApi.acceptClassInvitation
>;

function renderPage(path = "/student/classes") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/student/classes" element={<StudentClassesPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetIncoming.mockResolvedValue([]);
  mockGetMemberships.mockResolvedValue([]);
});

test("shows invitations and joined empty states", async () => {
  renderPage();
  expect(await screen.findByRole("heading", { name: /^My classes$/i })).toBeInTheDocument();
  expect(await screen.findByText(/You have no class invitations/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: /Joined classes/i }));
  expect(await screen.findByText(/You have not joined a class yet/i)).toBeInTheDocument();
  expect(screen.queryByText(/Student ID|Teacher ID|@/i)).not.toBeInTheDocument();
});

test("leave class requires confirmation and calls membership publicId", async () => {
  mockGetMemberships.mockResolvedValue([
    {
      membershipPublicId: "mem-9",
      joinedAt: "2026-01-02T00:00:00.000Z",
      class: { publicId: "c9", name: "Year 11 Biology", subject: "Biology" },
      teacher: { displayName: "Sham Sharma" },
    },
  ] as any);
  mockLeave.mockResolvedValue({
    ok: true,
    membership: { publicId: "mem-9", status: "removed" },
  } as any);

  renderPage("/student/classes?tab=joined");
  expect(await screen.findByText("Year 11 Biology")).toBeInTheDocument();
  expect(screen.getByText("Sham Sharma")).toBeInTheDocument();
  expect(screen.queryByText(/mem-9|c9/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Leave Year 11 Biology/i }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText(/previous answers and work will not be deleted/i)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: /^Leave class$/i }));

  await waitFor(() => {
    expect(mockLeave).toHaveBeenCalledWith("mem-9");
  });
  expect(await screen.findByText(/You left Year 11 Biology/i)).toBeInTheDocument();
  expect(screen.queryByText("Year 11 Biology")).not.toBeInTheDocument();
});

test("accept on classes page moves invitation into joined list", async () => {
  mockGetIncoming.mockResolvedValue([
    {
      publicId: "inv-3",
      status: "pending",
      class: { publicId: "c3", name: "Physics" },
      teacher: { displayName: "Tina" },
    },
  ] as any);
  mockAccept.mockResolvedValue({
    ok: true,
    invitation: { publicId: "inv-3", status: "accepted" },
    membership: { publicId: "mem-3", status: "active" },
    class: { publicId: "c3", name: "Physics" },
    teacher: { displayName: "Tina" },
  } as any);

  renderPage();
  await screen.findByText("Physics");
  fireEvent.click(screen.getByRole("button", { name: /Accept invitation to Physics/i }));
  fireEvent.click(screen.getByRole("button", { name: /^Join class$/i }));

  await waitFor(() => {
    expect(mockAccept).toHaveBeenCalledWith("inv-3");
  });
  expect(await screen.findByText(/You joined Physics/i)).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Joined classes/i })).toHaveAttribute(
    "aria-selected",
    "true"
  );
});

test("error state offers retry", async () => {
  mockGetIncoming.mockRejectedValue({ response: { status: 500, data: { error: "fail" } } });
  renderPage();
  expect(await screen.findByText(/We could not load your classes/i)).toBeInTheDocument();
  mockGetIncoming.mockResolvedValue([]);
  mockGetMemberships.mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
  expect(await screen.findByText(/You have no class invitations/i)).toBeInTheDocument();
});

