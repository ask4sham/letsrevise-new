import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SubscriptionPage from "../SubscriptionPage";

const mockNavigate = jest.fn();
const mockRefresh = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("../../utils/apiBaseUrl", () => ({
  apiUrl: (path: string) => path,
}));

jest.mock("../../utils/authStorage", () => ({
  updateUser: jest.fn(),
}));

jest.mock("../../hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    token: "test-token",
    refresh: mockRefresh,
  }),
}));

jest.mock("../../components/auth/VerificationGate", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const LEGACY_ENDPOINTS = [
  "/api/subscriptions/my-subscription",
  "/api/subscriptions/subscribe",
  "/api/subscriptions/upgrade",
  "/api/subscriptions/cancel",
  "/api/pricing",
];

function expectNoLegacyCalls(fetchMock: jest.Mock) {
  for (const endpoint of LEGACY_ENDPOINTS) {
    expect(fetchMock).not.toHaveBeenCalledWith(endpoint, expect.anything());
  }
}

describe("SubscriptionPage (B4)", () => {
  const originalLocation = window.location;
  const originalScrollTo = window.scrollTo;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    window.scrollTo = jest.fn();
    delete (window as { location?: Location }).location;
    window.location = { ...originalLocation, href: "" } as Location;
  });

  afterEach(() => {
    window.location = originalLocation;
    window.scrollTo = originalScrollTo;
  });

  test("not Pro: shows frozen £4.99 price and starts Stripe Checkout", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/users/me") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ hasLetsReviseProAccess: false, id: "user-1" }),
        });
      }
      if (url === "/api/subscriptions/create-checkout-session" && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            url: "https://checkout.stripe.com/c/pay/cs_test",
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/£4\.99/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subscribe" })).toBeInTheDocument();
    expect(screen.queryByText(/LetsRevise Pro — Active/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Subscribe" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/subscriptions/create-checkout-session",
        expect.objectContaining({ method: "POST" })
      );
      expect(window.location.href).toBe("https://checkout.stripe.com/c/pay/cs_test");
    });

    expectNoLegacyCalls(global.fetch as jest.Mock);
  });

  test("already Pro from fresh /users/me: shows active state without Subscribe button", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ hasLetsReviseProAccess: true, id: "user-1" }),
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/LetsRevise Pro — Active/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage billing" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Subscribe" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Cancel subscription/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Upgrade/i)).not.toBeInTheDocument();
    expectNoLegacyCalls(global.fetch as jest.Mock);
  });

  test("already Pro: Manage billing opens Stripe Customer Portal", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/users/me") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ hasLetsReviseProAccess: true, id: "user-1" }),
        });
      }
      if (url === "/api/subscriptions/create-portal-session" && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            url: "https://billing.stripe.com/p/session/test_portal",
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByRole("button", { name: "Manage billing" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/subscriptions/create-portal-session",
        expect.objectContaining({ method: "POST" })
      );
      expect(window.location.href).toBe("https://billing.stripe.com/p/session/test_portal");
    });
  });

  test("checkout failure shows error and does not redirect", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/users/me") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ hasLetsReviseProAccess: false, id: "user-1" }),
        });
      }
      if (url === "/api/subscriptions/create-checkout-session" && init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          json: async () => ({ success: false, msg: "Checkout unavailable" }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByRole("button", { name: "Subscribe" }));

    expect(await screen.findByText(/Checkout unavailable/i)).toBeInTheDocument();
    expect(window.location.href).toBe("");
  });

  test("duplicate subscription: backend ALREADY_SUBSCRIBED shows error", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/users/me") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ hasLetsReviseProAccess: false, id: "user-1" }),
        });
      }
      if (url === "/api/subscriptions/create-checkout-session" && init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({
            success: false,
            code: "ALREADY_SUBSCRIBED",
            msg: "LetsRevise Pro is already active on this account",
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByRole("button", { name: "Subscribe" }));

    expect(
      await screen.findByText(/LetsRevise Pro is already active on this account/i)
    ).toBeInTheDocument();
    expect(window.location.href).toBe("");
  });

  test("refreshes /users/me on load even when cached user state may be stale", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ hasLetsReviseProAccess: true, id: "user-1" }),
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/users/me",
        expect.objectContaining({
          headers: { Authorization: "Bearer test-token" },
        })
      );
    });

    expect(await screen.findByText(/LetsRevise Pro — Active/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Subscribe" })).not.toBeInTheDocument();
  });
});
