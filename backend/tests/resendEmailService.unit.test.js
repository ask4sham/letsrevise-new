/**
 * Unit tests for sendResendEmail — mocked Resend SDK, no network.
 */
jest.mock("resend", () => {
  const send = jest.fn();
  const Resend = jest.fn(function MockResend() {
    return { emails: { send } };
  });
  return { Resend, __mockSend: send };
});

const { Resend, __mockSend: mockSend } = require("resend");
const { sendResendEmail, ResendDeliveryError } = require("../services/resendEmailService");

const DUMMY_KEY = "re_test_dummy_key_not_real";
const PAYLOAD = {
  from: "noreply@example.invalid",
  to: "recipient@example.invalid",
  subject: "Test subject",
  html: "<p>token=SECRET_TOKEN_VALUE and link=https://example.invalid/verify?token=SECRET_TOKEN_VALUE</p>",
};

describe("resendEmailService.sendResendEmail", () => {
  let originalFetch;

  beforeEach(() => {
    jest.clearAllMocks();
    originalFetch = global.fetch;
    global.fetch = jest.fn(async () => {
      throw new Error("NETWORK_VIOLATION: fetch must not be called");
    });
    Resend.mockImplementation(function MockResend() {
      return { emails: { send: mockSend } };
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("success: constructs client, sends payload once, returns data", async () => {
    mockSend.mockResolvedValue({
      data: { id: "email_test_123" },
      error: null,
    });

    const data = await sendResendEmail({ apiKey: DUMMY_KEY, payload: PAYLOAD });

    expect(Resend).toHaveBeenCalledTimes(1);
    expect(Resend).toHaveBeenCalledWith(DUMMY_KEY);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(PAYLOAD);
    expect(data).toEqual({ id: "email_test_123" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("returned provider error becomes ResendDeliveryError with safe metadata", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: {
        statusCode: 400,
        message: "Validation failed",
        name: "validation_error",
      },
    });

    let thrown;
    try {
      await sendResendEmail({ apiKey: DUMMY_KEY, payload: PAYLOAD });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ResendDeliveryError);
    expect(thrown.name).toBe("ResendDeliveryError");
    expect(thrown.message).toBe("Validation failed");
    expect(thrown.statusCode).toBe(400);
    expect(thrown.providerErrorName).toBe("validation_error");

    const serialized = `${thrown.message} ${thrown.stack || ""} ${JSON.stringify(thrown)}`;
    expect(serialized).not.toMatch(/re_test_dummy_key/);
    expect(serialized).not.toMatch(/SECRET_TOKEN_VALUE/);
    expect(serialized).not.toMatch(/recipient@example\.invalid/);
    expect(serialized).not.toMatch(/<p>/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("returned error with missing optional fields uses safe fallback message", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: {},
    });

    await expect(sendResendEmail({ apiKey: DUMMY_KEY, payload: PAYLOAD })).rejects.toMatchObject({
      name: "ResendDeliveryError",
      message: "Resend email delivery failed",
    });
  });

  test("SDK rejection rethrows the original error unchanged", async () => {
    const originalError = new Error("socket hang up");
    originalError.code = "ECONNRESET";
    mockSend.mockRejectedValue(originalError);

    await expect(sendResendEmail({ apiKey: DUMMY_KEY, payload: PAYLOAD })).rejects.toBe(originalError);
  });

  test("unusual success without error field returns data or null safely", async () => {
    mockSend.mockResolvedValue({ data: { id: "email_compat" } });
    await expect(sendResendEmail({ apiKey: DUMMY_KEY, payload: PAYLOAD })).resolves.toEqual({
      id: "email_compat",
    });

    mockSend.mockResolvedValue({});
    await expect(sendResendEmail({ apiKey: DUMMY_KEY, payload: PAYLOAD })).resolves.toBeUndefined();

    mockSend.mockResolvedValue(null);
    await expect(sendResendEmail({ apiKey: DUMMY_KEY, payload: PAYLOAD })).resolves.toBeNull();
  });

  test("constructor failure propagates and is not labeled ResendDeliveryError", async () => {
    const ctorErr = new TypeError("invalid api key shape");
    Resend.mockImplementation(() => {
      throw ctorErr;
    });

    let thrown;
    try {
      await sendResendEmail({ apiKey: DUMMY_KEY, payload: PAYLOAD });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBe(ctorErr);
    expect(thrown.name).toBe("TypeError");
    expect(thrown).not.toBeInstanceOf(ResendDeliveryError);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
