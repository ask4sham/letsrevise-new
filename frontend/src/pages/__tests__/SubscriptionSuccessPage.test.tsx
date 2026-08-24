import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SubscriptionSuccessPage, {
  SUBSCRIPTION_SUCCESS_MAX_POLL_ATTEMPTS,
  SUBSCRIPTION_SUCCESS_POLL_INTERVAL_MS,
} from "../SubscriptionSuccessPage";

const mockNavigate = jest.fn();
const mockRefresh = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("../../utils/apiBaseUrl", () => ({
  apiUrl: (path: string) => path,
}));

jest.mock("../../hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    token: "test-token",
    refresh: mockRefresh,
  }),
}));

jest.mock("../../utils/authStorage", () => ({
  updateUser: jest.fn(),
}));

async function flushPollTimers(steps = 1) {
  for (let i = 0; i < steps; i += 1) {
    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(SUBSCRIPTION_SUCCESS_POLL_INTERVAL_MS);
      await Promise.resolve();
    });
  }
}

describe("SubscriptionSuccessPage (B4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("polls /users/me until hasLetsReviseProAccess then shows success", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasLetsReviseProAccess: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasLetsReviseProAccess: true, id: "user-1" }),
      });

    render(
      <MemoryRouter initialEntries={["/subscription/success?session_id=cs_test"]}>
        <SubscriptionSuccessPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/activating your LetsRevise Pro access/i)).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });
    await flushPollTimers(1);

    await waitFor(() => {
      expect(screen.getByText(/LetsRevise Pro is now active/i)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/me",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
      })
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  test("session_id query param alone does not grant access", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ hasLetsReviseProAccess: false }),
    });

    render(
      <MemoryRouter initialEntries={["/subscription/success?session_id=cs_fake_success"]}>
        <SubscriptionSuccessPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Checkout session: cs_fake_success/i)).toBeInTheDocument();
    expect(screen.getByText(/activating your LetsRevise Pro access/i)).toBeInTheDocument();
    expect(screen.queryByText(/LetsRevise Pro is now active/i)).not.toBeInTheDocument();
  });

  test("times out safely when entitlement never arrives", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ hasLetsReviseProAccess: false }),
    });

    render(
      <MemoryRouter initialEntries={["/subscription/success?session_id=cs_test"]}>
        <SubscriptionSuccessPage />
      </MemoryRouter>
    );

    await act(async () => {
      await Promise.resolve();
    });
    await flushPollTimers(SUBSCRIPTION_SUCCESS_MAX_POLL_ATTEMPTS);

    await waitFor(() => {
      expect(screen.getByText(/access is not active yet/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/LetsRevise Pro is now active/i)).not.toBeInTheDocument();
  });

  test("cleans up polling on unmount", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ hasLetsReviseProAccess: false }),
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={["/subscription/success"]}>
        <SubscriptionSuccessPage />
      </MemoryRouter>
    );

    await act(async () => {
      await Promise.resolve();
    });

    const callsBeforeUnmount = (global.fetch as jest.Mock).mock.calls.length;
    unmount();

    await flushPollTimers(SUBSCRIPTION_SUCCESS_MAX_POLL_ATTEMPTS);

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBeforeUnmount);
  });
});
