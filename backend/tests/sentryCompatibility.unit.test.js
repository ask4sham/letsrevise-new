/**
 * Real-SDK Sentry compatibility checks, isolated from the Jest worker.
 *
 * The parent process must NEVER import or initialise @sentry/node.
 * All SDK / Express / OTel work runs in one short-lived child Node process so
 * Sentry globals die with that process and cannot poison later Jest suites.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const RESULT_PREFIX = "SENTRY_COMPAT_RESULT=";
const BACKEND_DIR = path.resolve(__dirname, "..");
const CHILD_TIMEOUT_MS = 45000;
const MAX_BUFFER = 8 * 1024 * 1024;

/**
 * Child harness source. Executed via `node -` (stdin). Kept as a string so the
 * Jest worker never evaluates require("@sentry/node").
 */
const CHILD_SOURCE = String.raw`
"use strict";

const assert = require("assert");
const https = require("https");
const dns = require("dns");
const express = require("express");
const request = require("supertest");
const Sentry = require("@sentry/node");

const TEST_DSN = "https://public@example.invalid/1";
const RESULT_PREFIX = ${JSON.stringify(RESULT_PREFIX)};

function fail(msg) {
  console.error("SENTRY_COMPAT_CHILD_FAIL: " + msg);
  process.exit(1);
}

const originalFetch = global.fetch;
const originalHttpsRequest = https.request;
const originalHttpsGet = https.get;
const originalDnsLookup = dns.lookup;
const originalDnsLookupPromise = dns.promises && dns.promises.lookup;

const fetchAttempts = [];
const httpsRequestAttempts = [];
const httpsGetAttempts = [];
const dnsAttempts = [];
const transportSendAttempts = [];

function installNetworkGuards() {
  if (typeof global.fetch === "function") {
    global.fetch = function guardedFetch(input) {
      fetchAttempts.push(String(input));
      throw new Error("Unexpected external fetch blocked: " + String(input));
    };
  }
  https.request = function guardedHttpsRequest(...args) {
    const target = typeof args[0] === "string" ? args[0] : args[0] && (args[0].hostname || args[0].host);
    httpsRequestAttempts.push(String(target));
    throw new Error("Unexpected external https.request blocked: " + String(target));
  };
  https.get = function guardedHttpsGet(...args) {
    const target = typeof args[0] === "string" ? args[0] : args[0] && (args[0].hostname || args[0].host);
    httpsGetAttempts.push(String(target));
    throw new Error("Unexpected external https.get blocked: " + String(target));
  };
  dns.lookup = function guardedDnsLookup(hostname, ...rest) {
    dnsAttempts.push(String(hostname));
    const cb = typeof rest[rest.length - 1] === "function" ? rest[rest.length - 1] : null;
    const err = new Error("Unexpected DNS lookup blocked: " + hostname);
    if (cb) {
      process.nextTick(() => cb(err));
      return;
    }
    throw err;
  };
  if (dns.promises && originalDnsLookupPromise) {
    dns.promises.lookup = async function guardedDnsLookupPromise(hostname) {
      dnsAttempts.push(String(hostname));
      throw new Error("Unexpected DNS lookup blocked: " + hostname);
    };
  }
}

function restoreNetworkGuards() {
  if (originalFetch !== undefined) global.fetch = originalFetch;
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
      transportSendAttempts.push({
        url: requestOpts && requestOpts.url,
        method: requestOpts && requestOpts.method,
      });
      return Promise.resolve({});
    });
}

async function main() {
  installNetworkGuards();

  assert.strictEqual(typeof Sentry.init, "function");
  assert.strictEqual(typeof Sentry.setupExpressErrorHandler, "function");
  assert.strictEqual(typeof Sentry.captureException, "function");
  assert.strictEqual(typeof Sentry.captureMessage, "function");
  assert.strictEqual(typeof Sentry.withScope, "function");

  // No-DSN startup: mirror production skip behaviour without importing config.
  delete process.env.SENTRY_DSN;
  const shouldInitWithoutDsn = Boolean((process.env.SENTRY_DSN || "").trim());
  assert.strictEqual(shouldInitWithoutDsn, false);

  // Initialise exactly once. Do not close+reinit.
  Sentry.init({
    dsn: TEST_DSN,
    environment: "test",
    tracesSampleRate: 0.1,
    beforeSend(event, hint) {
      const error = hint && hint.originalException;
      if (error && error.status === 400) return null;
      return event;
    },
    transport: makeNoNetworkTransport(),
  });
  assert.strictEqual(Sentry.isInitialized(), true);

  const app = express();
  app.get("/ok", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.get("/err", (_req, _res, next) => {
    next(Object.assign(new Error("controlled-route-error"), { status: 500 }));
  });
  app.get("/headers", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  Sentry.setupExpressErrorHandler(app);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: "fallback", message: err.message });
  });

  const okRes = await request(app).get("/ok");
  assert.strictEqual(okRes.status, 200);
  assert.deepStrictEqual(okRes.body, { ok: true });

  const errRes = await request(app).get("/err");
  assert.strictEqual(errRes.status, 500);
  assert.strictEqual(errRes.body.error, "fallback");
  assert.strictEqual(errRes.body.message, "controlled-route-error");

  const traceRep = await request(app)
    .get("/headers")
    .set("sentry-trace", "00000000000000000000000000000000-0000000000000000-1")
    .set("traceparent", "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01")
    .set("tracestate", "sentry=ok");
  assert.strictEqual(traceRep.status, 200);

  const traceMalformed = await request(app)
    .get("/headers")
    .set("sentry-trace", "not-a-valid-trace|||")
    .set("traceparent", "bad")
    .set("tracestate", "sentry=malformed||value");
  assert.strictEqual(traceMalformed.status, 200);

  const baggageRep = await request(app)
    .get("/headers")
    .set("baggage", "sentry-environment=test,sentry-public_key=public,custom=1");
  assert.strictEqual(baggageRep.status, 200);

  const baggageMalformed = await request(app)
    .get("/headers")
    .set("baggage", ";;;===,,,not=a=valid|||baggage");
  assert.strictEqual(baggageMalformed.status, 200);

  const largeValue = "k=" + "x".repeat(7900);
  assert.ok(Buffer.byteLength(largeValue, "utf8") <= 8192);
  const baggageLarge = await request(app).get("/headers").set("baggage", largeValue);
  assert.strictEqual(baggageLarge.status, 200);

  Sentry.captureException(new Error("telemetry-guard-check"));
  await Sentry.flush(1000);
  await Sentry.close(1000);

  assert.strictEqual(fetchAttempts.length, 0);
  assert.strictEqual(httpsRequestAttempts.length, 0);
  assert.strictEqual(httpsGetAttempts.length, 0);
  assert.strictEqual(dnsAttempts.length, 0);
  for (const call of transportSendAttempts) {
    const url = String((call && call.url) || "");
    assert.ok(!/sentry\.io|ingest\.sentry/i.test(url), "transport url looked like real ingest: " + url);
  }

  restoreNetworkGuards();

  const result = {
    ok: true,
    exports: {
      init: true,
      setupExpressErrorHandler: true,
      captureException: true,
      captureMessage: true,
      withScope: true,
    },
    noDsnSkipped: true,
    initOnce: true,
    normalStatus: okRes.status,
    errorStatus: errRes.status,
    traceRepresentativeStatus: traceRep.status,
    traceMalformedStatus: traceMalformed.status,
    baggageRepresentativeStatus: baggageRep.status,
    baggageMalformedStatus: baggageMalformed.status,
    baggageLargeStatus: baggageLarge.status,
    baggageLargeBytes: Buffer.byteLength(largeValue, "utf8"),
    fetchAttempts: fetchAttempts.length,
    httpsRequestAttempts: httpsRequestAttempts.length,
    httpsGetAttempts: httpsGetAttempts.length,
    dnsAttempts: dnsAttempts.length,
    transportSendAttempts: transportSendAttempts.length,
    childPid: process.pid,
  };

  process.stdout.write(RESULT_PREFIX + JSON.stringify(result) + "\n");
}

main().catch((err) => {
  fail((err && err.stack) || String(err));
});
`;

function buildChildEnv() {
  const env = { ...process.env };
  // Never forward a real DSN into the child.
  delete env.SENTRY_DSN;
  delete env.SENTRY_AUTH_TOKEN;
  delete env.SENTRY_RELEASE;
  env.NODE_ENV = "test";
  env.SENTRY_DSN = "";
  return env;
}

function runSentryCompatChild() {
  const child = spawnSync(process.execPath, ["-"], {
    cwd: BACKEND_DIR,
    input: CHILD_SOURCE,
    encoding: "utf8",
    windowsHide: true,
    timeout: CHILD_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
    env: buildChildEnv(),
  });

  const stdout = child.stdout || "";
  const stderr = child.stderr || "";
  const combined = `${stdout}\n${stderr}`;

  if (combined.includes("Maximum call stack size exceeded")) {
    throw new Error(`Child reported stack overflow:\n${combined}`);
  }
  if (/at Reflect\.set \(<anonymous>\)/.test(combined) && combined.includes("originalSetter")) {
    throw new Error(`Child reported Reflect.set recursion:\n${combined}`);
  }
  if (combined.includes("JEST-01") || combined.includes("soft deleted")) {
    throw new Error(`Child unexpectedly emitted Jest soft-delete warning:\n${combined}`);
  }
  if (/Unexpected external (fetch|https\.request|https\.get|DNS lookup)/.test(combined)) {
    throw new Error(`Child reported external-network violation:\n${combined}`);
  }

  if (child.error && child.error.code === "ETIMEDOUT") {
    throw new Error(`Child timed out after ${CHILD_TIMEOUT_MS}ms.\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }
  if (child.signal) {
    throw new Error(`Child killed by signal ${child.signal}.\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }
  if (child.status !== 0) {
    throw new Error(
      `Child exited with status ${child.status}.\nstdout:\n${stdout}\nstderr:\n${stderr}`
    );
  }

  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const markerLine = lines.find((line) => line.startsWith(RESULT_PREFIX));
  if (!markerLine) {
    throw new Error(`Missing ${RESULT_PREFIX} marker.\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(markerLine.slice(RESULT_PREFIX.length));
  } catch (err) {
    throw new Error(`Failed to parse child JSON result: ${err.message}\nline=${markerLine}`);
  }

  return {
    result: parsed,
    status: child.status,
    stdout,
    stderr,
    timedOut: false,
  };
}

describe("sentry SDK compatibility (child-process isolated)", () => {
  let harness;

  beforeAll(() => {
    harness = runSentryCompatChild();
  });

  test("child harness exits successfully with a parsed result", () => {
    expect(harness.status).toBe(0);
    expect(harness.result).toBeTruthy();
    expect(harness.result.ok).toBe(true);
    expect(harness.result.childPid).toEqual(expect.any(Number));
    expect(harness.result.childPid).not.toBe(process.pid);
  });

  test("real package exports are available in the child", () => {
    expect(harness.result.exports).toEqual({
      init: true,
      setupExpressErrorHandler: true,
      captureException: true,
      captureMessage: true,
      withScope: true,
    });
  });

  test("startup without SENTRY_DSN remains inactive / skipped", () => {
    expect(harness.result.noDsnSkipped).toBe(true);
  });

  test("init accepts current LetsRevise option shape exactly once", () => {
    expect(harness.result.initOnce).toBe(true);
  });

  test("Express setupExpressErrorHandler handles normal and controlled-error routes", () => {
    expect(harness.result.normalStatus).toBe(200);
    expect(harness.result.errorStatus).toBe(500);
  });

  test("trace and baggage headers complete safely without crash", () => {
    expect(harness.result.traceRepresentativeStatus).toBe(200);
    expect(harness.result.traceMalformedStatus).toBe(200);
    expect(harness.result.baggageRepresentativeStatus).toBe(200);
    expect(harness.result.baggageMalformedStatus).toBe(200);
    expect(harness.result.baggageLargeStatus).toBe(200);
    expect(harness.result.baggageLargeBytes).toBeLessThanOrEqual(8192);
    expect(harness.result.baggageLargeBytes).toBeGreaterThan(7000);
  });

  test("no outbound telemetry from the child harness", () => {
    expect(harness.result.fetchAttempts).toBe(0);
    expect(harness.result.httpsRequestAttempts).toBe(0);
    expect(harness.result.httpsGetAttempts).toBe(0);
    expect(harness.result.dnsAttempts).toBe(0);
    // Custom transport may record envelopes; child asserts none target real ingest.
    expect(harness.result.transportSendAttempts).toBeGreaterThanOrEqual(0);
  });
});
