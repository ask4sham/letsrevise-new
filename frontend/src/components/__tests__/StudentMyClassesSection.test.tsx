/**
 * Dashboard My classes section.
 */
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StudentMyClassesSection from "../StudentMyClassesSection";
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
const mockAccept = studentClassesApi.acceptClassInvitation as jest.MockedFunction<
  typeof studentClassesApi.acceptClassInvitation
>;
const mockDecline = studentClassesApi.declineClassInvitation as jest.MockedFunction<
  typeof studentClassesApi.declineClassInvitation
>;

beforeEach(() => {
  jest.clearAllMocks();
});

function renderSection() {
  return render(
    <MemoryRouter>
      <StudentMyClassesSection />
    </MemoryRouter>
  );
}

test("renders My classes empty states without Student ID or Teacher ID", async () => {
  mockGetIncoming.mockResolvedValue([]);
  mockGetMemberships.mockResolvedValue([]);
  renderSection();

  expect(await screen.findByRole("heading", { name: /My classes/i })).toBeInTheDocument();
  expect(await screen.findByText(/No new class invitations/i)).toBeInTheDocument();
  expect(screen.getByText(/You have not joined a class yet/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Manage classes/i })).toHaveAttribute(
    "href",
    "/student/classes"
  );
  expect(screen.queryByText(/Student ID/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Teacher ID/i)).not.toBeInTheDocument();
});

test("shows invitation and accepts with publicId only", async () => {
  mockGetIncoming.mockResolvedValue([
    {
      publicId: "inv-1",
      status: "pending",
      requestedAt: "2026-01-01T00:00:00.000Z",
      class: { publicId: "c1", name: "Year 11 Biology", subject: "Biology" },
      teacher: { displayName: "Sham Sharma" },
    },
  ] as any);
  mockGetMemberships.mockResolvedValue([]);
  mockAccept.mockResolvedValue({
    ok: true,
    invitation: { publicId: "inv-1", status: "accepted" },
    membership: { publicId: "mem-1", status: "active", joinedAt: "2026-01-02T00:00:00.000Z" },
    class: { publicId: "c1", name: "Year 11 Biology", subject: "Biology" },
    teacher: { displayName: "Sham Sharma" },
  } as any);

  renderSection();
  expect(await screen.findByText(/Sham Sharma has invited you to join/i)).toBeInTheDocument();
  expect(screen.getByText("Year 11 Biology")).toBeInTheDocument();
  expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  expect(screen.queryByText(/inv-1|mem-1/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Accept invitation to Year 11 Biology/i }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText(/Join Year 11 Biology/i)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: /^Join class$/i }));

  await waitFor(() => {
    expect(mockAccept).toHaveBeenCalledWith("inv-1");
  });
  expect(await screen.findByText(/You joined Year 11 Biology/i)).toBeInTheDocument();
  expect(screen.queryByText(/Sham Sharma has invited you to join/i)).not.toBeInTheDocument();
  expect(screen.getByText("Year 11 Biology")).toBeInTheDocument();
});

test("declines invitation without creating membership", async () => {
  mockGetIncoming.mockResolvedValue([
    {
      publicId: "inv-2",
      status: "pending",
      class: { publicId: "c2", name: "Chem" },
      teacher: { displayName: "Tina" },
    },
  ] as any);
  mockGetMemberships.mockResolvedValue([]);
  mockDecline.mockResolvedValue({
    ok: true,
    invitation: { publicId: "inv-2", status: "declined" },
  } as any);

  renderSection();
  await screen.findByText("Chem");
  fireEvent.click(screen.getByRole("button", { name: /Decline invitation to Chem/i }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /^Decline$/i }));

  await waitFor(() => {
    expect(mockDecline).toHaveBeenCalledWith("inv-2");
  });
  expect(await screen.findByText(/Invitation declined/i)).toBeInTheDocument();
  expect(mockAccept).not.toHaveBeenCalled();
});
