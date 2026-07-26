/**
 * Dashboard My classes section — invitation actions + contextual nav.
 */
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StudentMyClassesSection, {
  getStudentClassesNavLabel,
} from "../StudentMyClassesSection";
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

describe("getStudentClassesNavLabel", () => {
  test("pending invitations → View all class invitations", () => {
    expect(getStudentClassesNavLabel(1, 0)).toBe("View all class invitations");
    expect(getStudentClassesNavLabel(2, 3)).toBe("View all class invitations");
  });

  test("joined only → Manage my classes", () => {
    expect(getStudentClassesNavLabel(0, 1)).toBe("Manage my classes");
  });

  test("empty → View my classes", () => {
    expect(getStudentClassesNavLabel(0, 0)).toBe("View my classes");
  });
});

test("renders My classes empty states without Student ID or Teacher ID", async () => {
  mockGetIncoming.mockResolvedValue([]);
  mockGetMemberships.mockResolvedValue([]);
  renderSection();

  expect(await screen.findByRole("heading", { name: /My classes/i })).toBeInTheDocument();
  expect(await screen.findByText(/No new class invitations/i)).toBeInTheDocument();
  expect(screen.getByText(/You have not joined a class yet/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /View my classes/i })).toHaveAttribute(
    "href",
    "/student/classes"
  );
  expect(screen.queryByRole("link", { name: /^Manage classes$/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/Student ID/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Teacher ID/i)).not.toBeInTheDocument();
});

test("pending invitation card shows Accept invitation, Decline, and View all class invitations", async () => {
  mockGetIncoming.mockResolvedValue([
    {
      publicId: "inv-1",
      status: "pending",
      requestedAt: "2026-01-01T00:00:00.000Z",
      class: { publicId: "c1", name: "Year 11 Biology Smoke Test", subject: "Biology" },
      teacher: { displayName: "Sham Sharma" },
    },
  ] as any);
  mockGetMemberships.mockResolvedValue([]);

  renderSection();

  expect(await screen.findByText(/Sham Sharma has invited you to join/i)).toBeInTheDocument();
  expect(screen.getByText("Year 11 Biology Smoke Test")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Accept invitation to Year 11 Biology Smoke Test/i })
  ).toHaveTextContent("Accept invitation");
  expect(
    screen.getByRole("button", { name: /Decline invitation to Year 11 Biology Smoke Test/i })
  ).toBeInTheDocument();
  const nav = screen.getByRole("link", { name: /View all class invitations/i });
  expect(nav).toHaveAttribute("href", "/student/classes?tab=invitations");
  expect(nav).toHaveClass("student-classes-dash__nav-link");
  expect(screen.queryByRole("link", { name: /^Manage classes$/i })).not.toBeInTheDocument();
});

test("accept opens confirmation, does not call API until confirm, then updates counts", async () => {
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

  const summary = screen.getByLabelText("Class summary");
  expect(summary).toHaveTextContent(/Invitations\s*1/);
  expect(summary).toHaveTextContent(/Joined\s*0/);

  fireEvent.click(screen.getByRole("button", { name: /Accept invitation to Year 11 Biology/i }));
  expect(mockAccept).not.toHaveBeenCalled();

  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText(/Join Year 11 Biology/i)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: /^Join class$/i }));

  await waitFor(() => {
    expect(mockAccept).toHaveBeenCalledTimes(1);
  });
  expect(mockAccept).toHaveBeenCalledWith("inv-1");
  expect(await screen.findByText(/You joined Year 11 Biology/i)).toBeInTheDocument();
  expect(screen.queryByText(/Sham Sharma has invited you to join/i)).not.toBeInTheDocument();
  expect(screen.getByText("Year 11 Biology")).toBeInTheDocument();
  expect(summary).toHaveTextContent(/Invitations\s*0/);
  expect(summary).toHaveTextContent(/Joined\s*1/);
  expect(screen.getByRole("link", { name: /Manage my classes/i })).toHaveAttribute(
    "href",
    "/student/classes"
  );
});

test("decline remains visible and keeps confirmation behaviour", async () => {
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
  expect(screen.getByRole("button", { name: /Decline invitation to Chem/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Decline invitation to Chem/i }));
  expect(mockDecline).not.toHaveBeenCalled();

  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /^Decline$/i }));

  await waitFor(() => {
    expect(mockDecline).toHaveBeenCalledWith("inv-2");
  });
  expect(await screen.findByText(/Invitation declined/i)).toBeInTheDocument();
  expect(mockAccept).not.toHaveBeenCalled();
});

test("joined-only state shows Manage my classes", async () => {
  mockGetIncoming.mockResolvedValue([]);
  mockGetMemberships.mockResolvedValue([
    {
      membershipPublicId: "mem-9",
      joinedAt: "2026-01-02T00:00:00.000Z",
      class: { publicId: "c9", name: "Biology A" },
      teacher: { displayName: "Sham Sharma" },
    },
  ] as any);

  renderSection();
  expect(await screen.findByText("Biology A")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Manage my classes/i })).toHaveAttribute(
    "href",
    "/student/classes"
  );
  expect(screen.queryByRole("link", { name: /View all class invitations/i })).not.toBeInTheDocument();
});

test("primary Accept and nav link styles are not hover-only", async () => {
  mockGetIncoming.mockResolvedValue([
    {
      publicId: "inv-1",
      status: "pending",
      class: { publicId: "c1", name: "Physics" },
      teacher: { displayName: "Ada" },
    },
  ] as any);
  mockGetMemberships.mockResolvedValue([]);

  renderSection();
  const accept = await screen.findByRole("button", { name: /Accept invitation to Physics/i });
  expect(accept).toHaveClass("student-classes__btn--primary");
  expect(accept).not.toHaveClass("student-classes__btn--ghost");

  const nav = screen.getByRole("link", { name: /View all class invitations/i });
  expect(nav).toHaveClass("student-classes-dash__nav-link");
  expect(nav).not.toHaveClass("student-classes__btn--primary");
});
