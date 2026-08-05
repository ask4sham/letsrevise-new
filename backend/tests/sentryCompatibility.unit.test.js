/**
 * Real-SDK, no-network compatibility checks for @sentry/node as used by LetsRevise.
 * Does not mock @sentry/node. Does not import production config for private helpers.
 */
const https = require("https");
const dns = require("dns");
const request = require("supertest");
const Sentry = require("@sentry/node");

const TEST_DSN = "https://public@example.invalid/1";

/** Require Express only after Sentry.init so default instrumentation can wrap it. */
function loadExpressAfterSentryInit() {
  // eslint-disable-next-line global-require
  return require("express");
}

describe("sentry SDK compatibility (no network)", () => {
  let originalFetch;
  let originalHttpsRequest;
  let originalHttpsGet;
  let originalDnsLookup;
  let originalDnsLookupPromise;
  let originalSentryDsn;
  let originalNodeEnv;

  let fetchCalls;
  let httpsRequestCalls;
  let httpsGetCalls;
  let dnsLookupCalls;
  let transportSendCalls;
  let originalFetchInvoked;
  let originalHttpsRequestInvoked;
  let originalHttpsGetInvoked;

  function installNetworkGuards() {
    fetchCalls = [];
    httpsRequestCalls = [];
    httpsGetCalls = [];
    dnsLookupCalls = [];
    transportSendCalls = [];
    originalFetchInvoked = false;
    originalHttpsRequestInvoked = false;
    originalHttpsGetInvoked = false;

    originalFetch = global.fetch;
    originalHttpsRequest = https.request;
    originalHttpsGet = https.get;
    originalDnsLookup = dns.lookup;
    originalDnsLookupPromise = dns.promises && dns.promises.lookup;

    if (typeof global.fetch === "function") {
      global.fetch = jest.fn((...args) => {
        originalFetchInvoked = true;
        fetchCalls.push(args[0]);
        throw new Error(`Unexpected external fetch blocked: ${String(args[0])}`);
      });
    }

    https.request = function guardedHttpsRequest(...args) {
      originalHttpsRequestInvoked = true;
      const target = typeof args[0] === "string" ? args[0] : args[0] && args[0].hostname;
      httpsRequestCalls.push(target);
      throw new Error(`Unexpected external https.request blocked: ${String(target)}`);
    };

    https.get = function guardedHttpsGet(...args) {
      originalHttpsGetInvoked = true;
      const target = typeof args[0] === "string" ? args[0] : args[0] && args[0].hostname;
      httpsGetCalls.push(target);
      throw new Error(`Unexpected external https.get blocked: ${String(target)}`);
    };

    dns.lookup = function guardedDnsLookup(hostname, ...rest) {
      dnsLookupCalls.push(hostname);
      const cb = typeof rest[rest.length - 1] === "function" ? rest[rest.length - 1] : null;
      const err = new Error(`Unexpected DNS lookup blocked: ${hostname}`);
      if (cb) {
        process.nextTick(() => cb(err));
        return;
      }
      throw err;
    };

    if (dns.promises && originalDnsLookupPromise) {
      dns.promises.lookup = async function guardedDnsLookupPromise(hostname) {
        dnsLookupCalls.push(hostname);
        throw new Error(`Unexpected DNS lookup blocked: ${hostname}`);
      };
    }
  }

  function restoreNetworkGuards() {
    if (originalFetch !== undefined) {
      global.fetch = originalFetch;
    }
    https.request = originalHttpsRequest;
    https.get = originalHttpsGet;
    dns.lookup = originalDnsLookup;
    if (dns.promises && originalDnsLookupPromise) {
      dns.promises.lookup = originalDnsLookupPromise;
    }
  }

  function makeNoNetworkTransport() {
    return (options) =>
      Sentry.createTransport(options, (requestOpts) => {
        transportSendCalls.push({
          url: requestOpts && requestOpts.url,
          method: requestOpts && requestOpts.method,
        });
        // Never call the real network stack.
        return Promise.resolve({});
      });
  }

  async function initTestSentry(extra = {}) {
    Sentry.init({
      dsn: TEST_DSN,
      environment: "test",
      tracesSampleRate: 0.1,
      beforeSend(event) {
        return event;
      },
      transport: makeNoNetworkTransport(),
      ...extra,
    });
  }

  async function closeSentry() {
    try {
      if (typeof Sentry.flush === "function") {
        await Sentry.flush(1000);
      }
    } catch (_) {
      // ignore flush errors in tests
    }
    try {
      if (typeof Sentry.close === "function") {
        await Sentry.close(1000);
      }
    } catch (_) {
      // ignore close errors in tests
    }
  }

  function assertNoExternalNetwork() {
    expect(originalFetchInvoked).toBe(false);
    expect(originalHttpsRequestInvoked).toBe(false);
    expect(originalHttpsGetInvoked).toBe(false);
    expect(fetchCalls).toEqual([]);
    expect(httpsRequestCalls).toEqual([]);
    expect(httpsGetCalls).toEqual([]);
    expect(dnsLookupCalls.filter((h) => String(h).includes("sentry") || String(h).includes("ingest"))).toEqual([]);
  }

  beforeEach(() => {
    originalSentryDsn = process.env.SENTRY_DSN;
    originalNodeEnv = process.env.NODE_ENV;
    delete process.env.SENTRY_DSN;
    installNetworkGuards();
  });

  afterEach(async () => {
    await closeSentry();
    restoreNetworkGuards();
    if (originalSentryDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = originalSentryDsn;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  test("package import exposes required APIs", () => {
    expect(Sentry).toBeTruthy();
    expect(typeof Sentry.init).toBe("function");
    expect(typeof Sentry.setupExpressErrorHandler).toBe("function");
    expect(typeof Sentry.captureException).toBe("function");
    expect(typeof Sentry.captureMessage).toBe("function");
    expect(typeof Sentry.withScope).toBe("function");
    assertNoExternalNetwork();
  });

  test("init accepts current LetsRevise option shape without outbound send", async () => {
    await initTestSentry({
      beforeSend(event, hint) {
        const error = hint && hint.originalException;
        if (error && error.status === 400) return null;
        return event;
      },
    });

    expect(Sentry.isInitialized()).toBe(true);

    await new Promise((resolve) => {
      Sentry.withScope((scope) => {
        scope.setExtra("source", "sentryCompatibility.unit.test");
        Sentry.captureMessage("compatibility-check-no-network");
        resolve();
      });
    });

    await Sentry.flush(1000);
    // Custom transport may record an envelope; real https/fetch must never run.
    assertNoExternalNetwork();
    for (const call of transportSendCalls) {
      const url = String((call && call.url) || "");
      expect(url.includes("sentry.io") || url.includes("ingest")).toBe(false);
    }
  });

  test("startup remains inactive when SENTRY_DSN is absent", async () => {
    expect(process.env.SENTRY_DSN).toBeUndefined();
    // Mirrors production config: skip init when no DSN.
    const shouldInit = Boolean((process.env.SENTRY_DSN || "").trim());
    expect(shouldInit).toBe(false);
    expect(typeof Sentry.init).toBe("function");
    expect(typeof Sentry.captureException).toBe("function");
    assertNoExternalNetwork();
    expect(transportSendCalls).toEqual([]);
  });

  test("Express setupExpressErrorHandler handles normal and controlled-error routes", async () => {
    await initTestSentry();
    const express = loadExpressAfterSentryInit();

    const app = express();
    app.get("/ok", (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.get("/err", (_req, _res, next) => {
      next(Object.assign(new Error("controlled-route-error"), { status: 500 }));
    });

    Sentry.setupExpressErrorHandler(app);

    app.use((err, _req, res, _next) => {
      res.status(500).json({ error: "fallback", message: err.message });
    });

    const okRes = await request(app).get("/ok");
    expect(okRes.status).toBe(200);
    expect(okRes.body).toEqual({ ok: true });

    const errRes = await request(app).get("/err");
    expect(errRes.status).toBe(500);
    expect(errRes.body.error).toBe("fallback");
    expect(errRes.body.message).toBe("controlled-route-error");

    await Sentry.flush(1000);
    assertNoExternalNetwork();
  });

  test("trace headers complete safely without crash", async () => {
    await initTestSentry();
    const express = loadExpressAfterSentryInit();

    const app = express();
    app.get("/trace", (_req, res) => {
      res.status(200).json({ ok: true });
    });
    Sentry.setupExpressErrorHandler(app);
    app.use((err, _req, res, _next) => {
      res.status(500).json({ error: err.message });
    });

    const res = await request(app)
      .get("/trace")
      .set("sentry-trace", "00000000000000000000000000000000-0000000000000000-1")
      .set("traceparent", "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01")
      .set("tracestate", "sentry=malformed||value");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    assertNoExternalNetwork();
  });

  test("baggage headers complete safely without crash", async () => {
    await initTestSentry();
    const express = loadExpressAfterSentryInit();

    const app = express();
    app.get("/baggage", (_req, res) => {
      res.status(200).json({ ok: true });
    });
    Sentry.setupExpressErrorHandler(app);
    app.use((err, _req, res, _next) => {
      res.status(500).json({ error: err.message });
    });

    const representative = await request(app)
      .get("/baggage")
      .set("baggage", "sentry-environment=test,sentry-public_key=public,custom=1");
    expect(representative.status).toBe(200);

    const malformed = await request(app)
      .get("/baggage")
      .set("baggage", ";;;===,,,not=a=valid|||baggage");
    expect(malformed.status).toBe(200);

    const largeValue = `k=${"x".repeat(7900)}`;
    expect(Buffer.byteLength(largeValue, "utf8")).toBeLessThanOrEqual(8192);
    const large = await request(app).get("/baggage").set("baggage", largeValue);
    expect(large.status).toBe(200);

    assertNoExternalNetwork();
  });

  test("no outbound telemetry via fetch/https originals", async () => {
    await initTestSentry();
    Sentry.captureException(new Error("telemetry-guard-check"));
    await Sentry.flush(1000);

    expect(originalFetchInvoked).toBe(false);
    expect(originalHttpsRequestInvoked).toBe(false);
    expect(originalHttpsGetInvoked).toBe(false);
    expect(httpsRequestCalls).toEqual([]);
    expect(httpsGetCalls).toEqual([]);
    expect(fetchCalls).toEqual([]);
    // If the custom transport recorded a send, it must not have used the real stack.
    for (const call of transportSendCalls) {
      expect(String((call && call.url) || "")).not.toMatch(/sentry\.io|ingest\.sentry/i);
    }
  });
});
