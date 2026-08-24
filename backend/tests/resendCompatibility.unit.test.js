/**
 * No-network compatibility checks for the real Resend SDK used by auth email helpers.
 * Does not import auth.js. Does not mock the resend package.
 */
const { Resend } = require("resend");

const ALLOWED_HOST_PREFIX = "https://api.resend.com";
const DUMMY_KEY = "re_test_dummy_key";

function makeJsonResponse(status, bodyObj) {
  const body = JSON.stringify(bodyObj);
  const headerMap = new Map([["content-type", "application/json"]]);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: {
      get(name) {
        return headerMap.get(String(name).toLowerCase()) || null;
      },
      entries() {
        return headerMap.entries();
      },
      forEach(cb) {
        headerMap.forEach((value, key) => cb(value, key));
      },
    },
    async text() {
      return body;
    },
    async json() {
      return bodyObj;
    },
  };
}

describe("resend SDK compatibility (no network)", () => {
  let originalFetch;
  let fetchCalls;
  let originalFetchInvoked;
  let nextResponse;

  beforeEach(() => {
    originalFetch = global.fetch;
    fetchCalls = [];
    originalFetchInvoked = false;
    nextResponse = makeJsonResponse(200, { id: "email_test_123" });

    global.fetch = jest.fn(async (input, init = {}) => {
      const url = String(input);
      if (!url.startsWith(ALLOWED_HOST_PREFIX)) {
        throw new Error(`Unexpected fetch host blocked: ${url}`);
      }
      // Intentionally never invoke originalFetch — outbound network is forbidden.
      fetchCalls.push({
        url,
        method: (init.method || "GET").toUpperCase(),
        body: init.body != null ? String(init.body) : null,
      });
      return nextResponse;
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createClient() {
    const client = new Resend(DUMMY_KEY);
    expect(client).toBeTruthy();
    expect(client.emails).toBeTruthy();
    expect(typeof client.emails.send).toBe("function");
    return client;
  }

  function parseLastBody() {
    expect(fetchCalls.length).toBeGreaterThan(0);
    const last = fetchCalls[fetchCalls.length - 1];
    expect(last.method).toBe("POST");
    expect(last.url).toBe("https://api.resend.com/emails");
    const parsed = JSON.parse(last.body);
    expect(parsed).toEqual(
      expect.objectContaining({
        from: expect.any(String),
        to: expect.any(String),
        subject: expect.any(String),
        html: expect.any(String),
      })
    );
    return { last, parsed };
  }

  function assertNoNetworkLeak() {
    expect(originalFetchInvoked).toBe(false);
    expect(global.fetch).not.toBe(originalFetch);
  }

  test("verification email payload reaches Resend emails API", async () => {
    const client = createClient();
    const verifyUrl = "https://app.example.com/verify?token=verify-token-abc";
    const result = await client.emails.send({
      from: "no-reply@example.com",
      to: "student@example.com",
      subject: "Verify your LetsRevise account",
      html: `<p>Hi there</p><a href="${verifyUrl}">Verify my email</a>`,
    });

    const { parsed } = parseLastBody();
    expect(parsed.from).toBe("no-reply@example.com");
    expect(parsed.to).toBe("student@example.com");
    expect(parsed.subject).toBe("Verify your LetsRevise account");
    expect(parsed.html).toContain(verifyUrl);
    expect(parsed.html).toContain("verify-token-abc");
    expect(result).toEqual(
      expect.objectContaining({
        data: { id: "email_test_123" },
        error: null,
      })
    );
    assertNoNetworkLeak();
    expect(fetchCalls).toHaveLength(1);
  });

  test("password-reset email payload reaches Resend emails API", async () => {
    const client = createClient();
    const resetUrl = "https://app.example.com/#/reset-password?token=reset-token-xyz";
    const result = await client.emails.send({
      from: "no-reply@example.com",
      to: "student@example.com",
      subject: "Reset your LetsRevise password",
      html: `<p>Hi there</p><a href="${resetUrl}">Reset my password</a>`,
    });

    const { parsed } = parseLastBody();
    expect(parsed.to).toBe("student@example.com");
    expect(parsed.subject).toBe("Reset your LetsRevise password");
    expect(parsed.html).toContain(resetUrl);
    expect(parsed.html).toContain("reset-token-xyz");
    expect(result.data).toEqual({ id: "email_test_123" });
    expect(result.error).toBeNull();
    assertNoNetworkLeak();
  });

  test("email-change confirmation payload reaches Resend emails API", async () => {
    const client = createClient();
    const confirmUrl =
      "https://app.example.com/api/auth/confirm-email-change?token=change-token-123";
    const result = await client.emails.send({
      from: "no-reply@example.com",
      to: "student@example.com",
      subject: "Confirm your new email address",
      html: `<p><a href="${confirmUrl}">Confirm new email</a></p>`,
    });

    const { parsed } = parseLastBody();
    expect(parsed.to).toBe("student@example.com");
    expect(parsed.subject).toBe("Confirm your new email address");
    expect(parsed.html).toContain(confirmUrl);
    expect(parsed.html).toContain("change-token-123");
    expect(result.data).toEqual({ id: "email_test_123" });
    expect(result.error).toBeNull();
    assertNoNetworkLeak();
  });

  test("parent-link invitation payload reaches Resend emails API", async () => {
    const client = createClient();
    const approveUrl = "https://app.example.com/parent-link/approve?token=parent-token-1";
    const rejectUrl = "https://app.example.com/parent-link/reject?token=parent-token-1";
    const result = await client.emails.send({
      from: "no-reply@example.com",
      to: "parent@example.com",
      subject: "Parent Example wants to link as your parent",
      html: `<p><a href="${approveUrl}">Approve</a><a href="${rejectUrl}">Reject</a></p>`,
    });

    const { parsed } = parseLastBody();
    expect(parsed.from).toBe("no-reply@example.com");
    expect(parsed.to).toBe("parent@example.com");
    expect(parsed.html).toContain(approveUrl);
    expect(parsed.html).toContain(rejectUrl);
    expect(parsed.html).toContain("parent-token-1");
    expect(result.data).toEqual({ id: "email_test_123" });
    expect(result.error).toBeNull();
    assertNoNetworkLeak();
  });

  test("controlled API error returns { data: null, error } without throwing", async () => {
    nextResponse = makeJsonResponse(400, {
      statusCode: 400,
      message: "Test error",
      name: "validation_error",
    });

    const client = createClient();
    const result = await client.emails.send({
      from: "no-reply@example.com",
      to: "student@example.com",
      subject: "Error path",
      html: "<p>error-path</p>",
    });

    parseLastBody();
    expect(result.data).toBeNull();
    expect(result.error).toEqual(
      expect.objectContaining({
        statusCode: 400,
        message: "Test error",
        name: "validation_error",
      })
    );
    assertNoNetworkLeak();
  });
});
