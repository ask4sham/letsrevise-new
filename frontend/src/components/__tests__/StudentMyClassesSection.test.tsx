/**
 * Compact dashboard My classes summary — limits, CTAs, Accept/Decline.
 */
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StudentMyClassesSection, {
  formatClassesSummaryCounts,
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

function makeInvite(i: number, overrides: Record<string, unknown> = {}) {
  return {
    publicId: `inv-${i}`,
    status: "pending",
    requestedAt: `2026-01-0${i}T00:00:00.000Z`,
    class: {
      publicId: `c-inv-${i}`,
      name: `Invite Class ${i}`,
      subject: "Biology",
      board: "Edexcel IGCSE",
      tier: "Higher",
    },
    teacher: { displayName: `Teacher ${i}` },
    ...overrides,
  };
}

function makeMembership(i: number, overrides: Record<string, unknown> = {}) {
  return {
    membershipPublicId: `mem-${i}`,
    joinedAt: `2026-02-0${i}T00:00:00.000Z`,
    class: {
      publicId: `c-mem-${i}`,
      name: `Joined Class ${i}`,
      subject: "Chemistry",
    },
    teacher: { displayName: `Tutor ${i}` },
    ...overrides,
  };
}

describe("formatClassesSummaryCounts", () => {
  test("singular and plural wording", () => {
    expect(formatClassesSummaryCounts(1, 1)).toBe("1 invitation · 1 joined");
    expect(formatClassesSummaryCounts(2, 4)).toBe("2 invitations · 4 joined");
    expect(formatClassesSummaryCounts(0, 1)).toBe("0 invitations · 1 joined");
  });
});

describe("getStudentClassesNavLabel", () => {
  test("pending → View all N invitation(s)", () => {
    expect(getStudentClassesNavLabel(1, 0)).toBe("View all 1 invitation");
    expect(getStudentClassesNavLabel(2, 3)).toBe("View all 2 invitations");
  });

  test("joined only → View all my classes (N)", () => {
    expect(getStudentClassesNavLabel(0, 1)).toBe("View all my classes (1)");
    expect(getStudentClassesNavLabel(0, 6)).toBe("View all my classes (6)");
  });

  test("empty → View my classes", () => {
    expect(getStudentClassesNavLabel(0, 0)).toBe("View my classes");
  });
});

test("empty dashboard is compact with View my classes high-contrast CTA", async () => {
  mockGetIncoming.mockResolvedValue([]);
  mockGetMemberships.mockResolvedValue([]);
  renderSection();

  expect(await screen.findByRole("heading", { name: /My classes/i })).toBeInTheDocument();
  expect(await screen.findByLabelText("Class summary")).toHaveTextContent(
    "0 invitations · 0 joined"
  );
  expect(screen.getByText(/No new class invitations/i)).toBeInTheDocument();
  expect(screen.getByText(/You have not joined a class yet/i)).toBeInTheDocument();
  expect(screen.queryByText(/When a teacher invites you/i)).not.toBeInTheDocument();

  const nav = screen.getByRole("link", { name: /^View my classes$/i });
  expect(nav).toHaveAttribute("href", "/student/classes");
  expect(nav).toHaveClass("student-classes-dash__nav-link");
  expect(screen.queryByRole("link", { name: /Manage classes/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/Student ID|Teacher ID/i)).not.toBeInTheDocument();
});

test("pending invitation shows class, teacher, metadata, Accept and Decline", async () => {
  mockGetIncoming.mockResolvedValue([
    makeInvite(1, {
      class: {
        publicId: "c1",
        name: "Year 11 Biology",
        subject: "Biology",
        board: "Edexcel IGCSE",
        tier: "Higher",
      },
      teacher: { displayName: "Sham Sharma" },
    }),
  ] as any);
  mockGetMemberships.mockResolvedValue([]);

  renderSection();

  expect(await screen.findByText("Year 11 Biology")).toBeInTheDocument();
  expect(
    screen.getByText(/Sham Sharma · Biology · Edexcel IGCSE · Higher/)
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Class summary")).toHaveTextContent("1 invitation · 0 joined");
  expect(
    screen.getByRole("button", { name: /Accept invitation to Year 11 Biology/i })
  ).toHaveTextContent("Accept invitation");
  expect(
    screen.getByRole("button", { name: /Decline invitation to Year 11 Biology/i })
  ).toBeInTheDocument();

  const nav = screen.getByRole("link", { name: /View all 1 invitation/i });
  expect(nav).toHaveAttribute("href", "/student/classes?tab=invitations");
  expect(nav).toHaveClass("student-classes-dash__nav-link");
});

test("renders at most 2 invitations and overflow View all link", async () => {
  mockGetIncoming.mockResolvedValue([makeInvite(1), makeInvite(2), makeInvite(3)] as any);
  mockGetMemberships.mockResolvedValue([]);

  renderSection();

  expect(await screen.findByText("Invite Class 1")).toBeInTheDocument();
  expect(screen.getByText("Invite Class 2")).toBeInTheDocument();
  expect(screen.queryByText("Invite Class 3")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Class summary")).toHaveTextContent("3 invitations · 0 joined");

  const overflow = screen.getAllByRole("link", { name: /View all 3 invitations/i });
  expect(overflow.length).toBeGreaterThanOrEqual(1);
  expect(overflow[0]).toHaveAttribute("href", "/student/classes?tab=invitations");
  expect(overflow[0]).toHaveClass("student-classes-dash__nav-link");
});

test("renders at most 3 joined classes and View all my classes CTA", async () => {
  mockGetIncoming.mockResolvedValue([]);
  mockGetMemberships.mockResolvedValue([
    makeMembership(1),
    makeMembership(2),
    makeMembership(3),
    makeMembership(4),
  ] as any);

  renderSection();

  expect(await screen.findByText("Joined Class 1")).toBeInTheDocument();
  expect(screen.getByText("Joined Class 2")).toBeInTheDocument();
  expect(screen.getByText("Joined Class 3")).toBeInTheDocument();
  expect(screen.queryByText("Joined Class 4")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Class summary")).toHaveTextContent("0 invitations · 4 joined");

  const nav = screen.getByRole("link", { name: /View all my classes \(4\)/i });
  expect(nav).toHaveAttribute("href", "/student/classes");
  expect(nav).toHaveClass("student-classes-dash__nav-link");
  expect(screen.queryByRole("button", { name: /Leave/i })).not.toBeInTheDocument();
});

test("accept requires confirmation then updates counts and recent list", async () => {
  mockGetIncoming.mockResolvedValue([
    makeInvite(1, {
      publicId: "inv-1",
      class: { publicId: "c1", name: "Year 11 Biology", subject: "Biology" },
      teacher: { displayName: "Sham Sharma" },
    }),
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
  expect(await screen.findByText("Year 11 Biology")).toBeInTheDocument();
  expect(screen.getByLabelText("Class summary")).toHaveTextContent("1 invitation · 0 joined");

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
  expect(screen.queryByRole("button", { name: /Accept invitation to Year 11 Biology/i })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Class summary")).toHaveTextContent("0 invitations · 1 joined");
  expect(screen.getByLabelText(/Joined class Year 11 Biology/i)).toBeInTheDocument();

  const nav = screen.getByRole("link", { name: /View all my classes \(1\)/i });
  expect(nav).toHaveAttribute("href", "/student/classes");
  expect(nav).toHaveClass("student-classes-dash__nav-link");
  expect(screen.queryByText(/inv-1|mem-1/i)).not.toBeInTheDocument();
});

test("decline keeps confirmation and updates summary CTA", async () => {
  mockGetIncoming.mockResolvedValue([
    makeInvite(2, {
      publicId: "inv-2",
      class: { publicId: "c2", name: "Chem" },
      teacher: { displayName: "Tina" },
    }),
  ] as any);
  mockGetMemberships.mockResolvedValue([]);
  mockDecline.mockResolvedValue({
    ok: true,
    invitation: { publicId: "inv-2", status: "declined" },
  } as any);

  renderSection();
  await screen.findByText("Chem");
  fireEvent.click(screen.getByRole("button", { name: /Decline invitation to Chem/i }));
  expect(mockDecline).not.toHaveBeenCalled();

  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /^Decline$/i }));

  await waitFor(() => {
    expect(mockDecline).toHaveBeenCalledWith("inv-2");
  });
  expect(await screen.findByText(/Invitation declined/i)).toBeInTheDocument();
  expect(screen.queryByText("Chem")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Class summary")).toHaveTextContent("0 invitations · 0 joined");
  expect(screen.getByRole("link", { name: /^View my classes$/i })).toHaveClass(
    "student-classes-dash__nav-link"
  );
  expect(mockAccept).not.toHaveBeenCalled();
});
