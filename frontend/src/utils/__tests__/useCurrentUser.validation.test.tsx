/**
 * useCurrentUser: 401 clears session; non-401 keeps cached session.
 */
import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { clearAuth, setAuth } from "../authStorage";

function Probe({ onValue }: { onValue: (v: ReturnType<typeof useCurrentUser>) => void }) {
  const value = useCurrentUser({ watchLocation: false });
  React.useEffect(() => {
    onValue(value);
  }, [value, onValue]);
  return null;
}

describe("useCurrentUser token validation", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    clearAuth();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
    clearAuth();
  });

  test("401 from /users/me clears auth session", async () => {
    setAuth("stale-token", {
      id: "u1",
      userType: "student",
      email: "a@b.com",
      firstName: "A",
      lastName: "B",
    });
    global.fetch = jest.fn().mockResolvedValue({
      status: 401,
      ok: false,
      text: async () => "",
    }) as any;

    let latest: ReturnType<typeof useCurrentUser> | null = null;
    render(
      <MemoryRouter>
        <Probe onValue={(v) => { latest = v; }} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(latest?.isLoggedIn).toBe(false);
    });
    expect(latest?.token).toBeNull();
    expect(latest?.user).toBeNull();
  });

  test("200 from /users/me keeps existing session (body unused)", async () => {
    setAuth("good-token", {
      id: "u2",
      userType: "teacher",
      email: "t@b.com",
      firstName: "T",
      lastName: "Each",
      staffRole: null,
    });
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ id: "u2", userType: "teacher" }),
    }) as any;

    let latest: ReturnType<typeof useCurrentUser> | null = null;
    render(
      <MemoryRouter>
        <Probe onValue={(v) => { latest = v; }} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(latest?.isLoggedIn).toBe(true);
    });
    expect(latest?.token).toBe("good-token");
    expect(latest?.user?.userType).toBe("teacher");
  });
});
