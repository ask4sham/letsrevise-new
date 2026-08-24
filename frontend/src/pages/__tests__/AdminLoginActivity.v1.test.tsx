/**
 * Login Activity V1 — Recent Login Activity page + Admin Dashboard Last Login column.
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminLoginActivityPage from "../AdminLoginActivityPage";
import AdminDashboardPage from "../AdminDashboardPage";

const mockApiGet = jest.fn();

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: { request: { use: () => {} }, response: { use: () => {} } },
  },
}));

jest.mock("../../hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    user: {
      _id: "admin1",
      userType: "admin",
      email: "admin@test.com",
    },
  }),
}));

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => jest.fn(),
  };
});

const sampleEvents = [
  {
    id: "e1",
    userId: "u1",
    emailSnapshot: "teacher@test.com",
    firstNameSnapshot: "Test",
    lastNameSnapshot: "Teacher",
    userTypeSnapshot: "teacher",
    loggedInAt: "2026-08-18T09:42:00.000Z",
  },
];

const sampleUsers = [
  {
    id: "u1",
    email: "teacher@test.com",
    firstName: "Test",
    lastName: "Teacher",
    userType: "teacher",
    verificationStatus: "verified",
    earnings: 0,
    subscription: "free",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastLoginAt: "2026-08-18T09:42:00.000Z",
    lastActive: null,
    stats: {},
    entitlementSummary: { label: "None", state: "none" },
  },
  {
    id: "u2",
    email: "never@test.com",
    firstName: "Never",
    lastName: "Logged",
    userType: "student",
    verificationStatus: "verified",
    earnings: 0,
    subscription: "free",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastLoginAt: null,
    lastActive: null,
    stats: {},
    entitlementSummary: { label: "None", state: "none" },
  },
];

describe("AdminLoginActivityPage", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  test("renders recent login activity title and columns", async () => {
    mockApiGet.mockResolvedValueOnce({ data: { success: true, events: sampleEvents } });

    render(
      <MemoryRouter>
        <AdminLoginActivityPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /recent login activity/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("teacher@test.com")).toBeInTheDocument();
    });
    expect(screen.getByText("Date & Time")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(mockApiGet).toHaveBeenCalledWith("/admin/login-activity", { params: { limit: "100" } });
  });

  test("renders empty state", async () => {
    mockApiGet.mockResolvedValueOnce({ data: { success: true, events: [] } });

    render(
      <MemoryRouter>
        <AdminLoginActivityPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/no login activity recorded yet/i)).toBeInTheDocument();
    });
  });

  test("renders error state", async () => {
    mockApiGet.mockRejectedValueOnce({ response: { data: { msg: "Forbidden" } } });

    render(
      <MemoryRouter>
        <AdminLoginActivityPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Forbidden")).toBeInTheDocument();
    });
  });
});

describe("AdminDashboardPage login activity UI", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/admin/stats") {
        return Promise.resolve({
          data: {
            success: true,
            stats: {
              users: { total: 2, teachers: 1, students: 1, growth: [] },
              lessons: { total: 0, totalViews: 0, averageRating: 0, totalPurchases: 0, platformEarnings: 0 },
              revenue: { total: 0, today: 0, monthly: 0 },
              subscriptions: {},
              platform: { activeUsers: 0 },
            },
          },
        });
      }
      if (url === "/admin/users") {
        return Promise.resolve({ data: { success: true, users: sampleUsers, pagination: { page: 1, limit: 20, total: 2, pages: 1 } } });
      }
      return Promise.reject(new Error(`unexpected url ${url}`));
    });
  });

  test("shows Recent Login Activity link and Last Login column on Users tab", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /recent login activity/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^users$/i }));

    await waitFor(() => {
      expect(screen.getByText("Last Login")).toBeInTheDocument();
    });

    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: /^view$/i }).length).toBeGreaterThanOrEqual(1);
  });
});
