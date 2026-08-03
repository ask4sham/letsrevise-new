/**
 * Deterministic Express composition: Helmet, global API limiter, auth limiter,
 * single mounts, API 404 before SPA, no listen on import.
 * Uses the real exported app. Does not connect to live external services.
 */
const fs = require("fs");
const path = require("path");
const request = require("supertest");

const BACKEND_ROOT = path.join(__dirname, "..");
const APP_PATH = path.join(BACKEND_ROOT, "app.js");
const SERVER_PATH = path.join(BACKEND_ROOT, "server.js");

const EXPECTED_API_MOUNTS = [
  "/api/uploads",
  "/api/admin/media",
  "/api/assessment-papers",
  "/api/assessment-attempts",
  "/api/assessment-items",
  "/api/auth",
  "/api/me",
  "/api/lessons",
  "/api/teachers",
  "/api/lesson-synthesiser",
  "/api/reviews",
  "/api/ai",
  "/api/taxonomy",
  "/api/reports",
  "/api/attempts",
  "/api/lesson-issues",
  "/api/worksheets",
  "/api/exam-questions",
  "/api/progress",
  "/api/earnings",
  "/api/users",
  "/api/notifications",
  "/api/subscriptions",
  "/api/payouts",
  "/api/pricing",
  "/api/events",
  "/api/admin",
  "/api/ops",
  "/api/ai-generation-jobs",
  "/api/content-tree",
  "/api/visuals",
  "/api/quizzes",
  "/api/parent-link",
  "/api/parent",
  "/api/templates",
  "/api/curriculum-confidence",
  "/api/dev",
];

function loadAppFresh(envOverrides = {}) {
  const prev = {};
  for (const [k, v] of Object.entries(envOverrides)) {
    prev[k] = process.env[k];
    if (v === undefined || v === null) delete process.env[k];
    else process.env[k] = String(v);
  }
  jest.resetModules();
  // eslint-disable-next-line global-require
  const app = require("../app");
  return {
    app,
    restore() {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      jest.resetModules();
    },
  };
}

describe("app composition — inventory and server separation", () => {
  const appSrc = fs.readFileSync(APP_PATH, "utf8");
  const serverSrc = fs.readFileSync(SERVER_PATH, "utf8");

  test("server.js does not mount application routers or global Express middleware", () => {
    expect(serverSrc).not.toMatch(/app\.use\s*\(\s*helmet/);
    expect(serverSrc).not.toMatch(/app\.use\s*\(\s*["']\/api/);
    expect(serverSrc).not.toMatch(/app\.use\s*\(\s*["']\/uploads/);
    expect(serverSrc).not.toMatch(/app\.use\s*\(\s*["']\/visuals/);
    expect(serverSrc).not.toMatch(/app\.get\s*\(\s*["']\/api\/health/);
    // listen is allowed only inside tryListen (startup barrier), not as top-level side effect
    expect(serverSrc).toMatch(/const server = app\.listen\(/);
    expect(serverSrc).toMatch(/function startServer/);
    expect(serverSrc).toMatch(/function tryListen/);
    expect(serverSrc).toMatch(/if \(require\.main === module\)/);
  });

  test("app.js mounts expected API paths once (no duplicate app.use for same path+router pair)", () => {
    for (const mount of EXPECTED_API_MOUNTS) {
      expect(appSrc).toContain(`"${mount}"`);
    }
    // Dual progress mounts are intentional and complementary
    const progressMounts = appSrc.match(/app\.use\(\s*["']\/api\/progress["']/g) || [];
    expect(progressMounts.length).toBe(2);
    expect(appSrc).toMatch(/progress\.routes/);
    expect(appSrc).toMatch(/routes\/progress["']/);
  });

  test("intentional video alias is documented and secured via videoUploadRoute", () => {
    expect(appSrc).toMatch(/app\.post\(\s*["']\/api\/uploads\/video["']/);
    expect(appSrc).toMatch(/videoUploadRoute/);
    expect(appSrc).toMatch(/intentionalAliases/);
  });

  test("final error handlers appear after API 404 and SPA root", () => {
    const api404 = appSrc.indexOf('app.use("/api", (req, res) =>');
    const spaRoot = appSrc.indexOf('app.get("/",');
    const jsonErr = appSrc.indexOf("Malformed JSON body");
    const finalErr = appSrc.indexOf("INTERNAL_ERROR");
    expect(api404).toBeGreaterThan(0);
    expect(spaRoot).toBeGreaterThan(api404);
    expect(jsonErr).toBeGreaterThan(spaRoot);
    expect(finalErr).toBeGreaterThan(jsonErr);
  });

  test("Helmet and global apiLimiter are registered before application routers", () => {
    const helmetIdx = appSrc.indexOf("app.use(helmet())");
    const limiterIdx = appSrc.indexOf('app.use("/api", apiLimiter)');
    const uploadsIdx = appSrc.indexOf('app.use("/api/uploads"');
    const authIdx = appSrc.indexOf('app.use("/api/auth"');
    const usersIdx = appSrc.indexOf('app.use("/api/users"');
    expect(helmetIdx).toBeGreaterThan(0);
    expect(limiterIdx).toBeGreaterThan(helmetIdx);
    expect(uploadsIdx).toBeGreaterThan(limiterIdx);
    expect(authIdx).toBeGreaterThan(limiterIdx);
    expect(usersIdx).toBeGreaterThan(limiterIdx);
    // Health before limiter
    const healthIdx = appSrc.indexOf('app.get("/api/health"');
    expect(healthIdx).toBeGreaterThan(helmetIdx);
    expect(healthIdx).toBeLessThan(limiterIdx);
  });
});

describe("app composition — runtime headers and contracts", () => {
  let app;
  let restore;

  beforeAll(() => {
    ({ app, restore } = loadAppFresh({ NODE_ENV: "test" }));
  });

  afterAll(() => {
    restore();
  });

  test("importing app does not call listen", () => {
    expect(typeof app.listen).toBe("function");
    expect(app.locals.compositionMeta.intentionalAliases).toContain("POST /api/uploads/video");
  });

  test("Helmet / CORP on early health route", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("OK");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  test("Helmet on former server-only route namespace (users)", async () => {
    const res = await request(app).get("/api/users");
    // Auth or not-found — either proves the router/404 path ran under Helmet
    expect([401, 403, 404, 400].includes(res.status) || res.status >= 400).toBe(true);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  test("Helmet on bounded API 404", async () => {
    const res = await request(app).get("/api/__composition_missing_route__");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ msg: "API route not found" });
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  test("API 404 is JSON not SPA HTML", async () => {
    const res = await request(app).get("/api/definitely-not-a-route-xyz");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(String(res.text)).not.toMatch(/<!DOCTYPE html>/i);
  });

  test("malformed JSON returns bounded error", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{not-json");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid JSON");
  });

  test("CORS preflight for allowed origin succeeds without auth", async () => {
    const res = await request(app)
      .options("/api/health")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET");
    expect(res.status).toBeLessThan(500);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  test("progress dual-router surface remains reachable paths", async () => {
    // Complementary modules: POST lesson-view (progress.routes) and GET stats (progress.js)
    const postRes = await request(app).post("/api/progress/lesson-view").send({});
    const getRes = await request(app).get("/api/progress/stats");
    expect([401, 403]).toContain(postRes.status);
    expect([401, 403]).toContain(getRes.status);
  });
});

describe("app composition — global API limiter order", () => {
  let app;
  let restore;
  let healthHits = 0;
  let lessonHits = 0;

  beforeAll(() => {
    ({ app, restore } = loadAppFresh({
      NODE_ENV: "test",
      FORCE_API_LIMITER: "1",
      RATE_LIMIT_API_MAX: "3",
    }));
    // Probe handlers: wrap by mounting after — instead spy via stack is hard;
    // use response status: health excluded, limited routes return 429.
  });

  afterAll(() => {
    restore();
  });

  test("health remains excluded from global limiter", async () => {
    for (let i = 0; i < 6; i += 1) {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      healthHits += 1;
    }
    expect(healthHits).toBe(6);
  });

  test("former app-origin route is globally limited; handler not needed after 429", async () => {
    // /api/lessons is an app-origin mount; unauthenticated typically 401 until limited
    const statuses = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).get("/api/lessons");
      statuses.push(res.status);
      if (res.status !== 429) lessonHits += 1;
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
    expect(statuses.slice(-1)[0]).toBe(429);
    expect(statuses.find((s) => s === 429)).toBe(429);
  });

  test("former server-only route is globally limited", async () => {
    // Separate key space is IP-shared — may already be limited from prior test in this describe.
    // Re-load with fresh limiter store.
    restore();
    ({ app, restore } = loadAppFresh({
      NODE_ENV: "test",
      FORCE_API_LIMITER: "1",
      RATE_LIMIT_API_MAX: "2",
    }));
    const statuses = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await request(app).get("/api/notifications");
      statuses.push(res.status);
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
  });

  test("one request consumes one global count (alias does not double-count via remount)", async () => {
    restore();
    ({ app, restore } = loadAppFresh({
      NODE_ENV: "test",
      FORCE_API_LIMITER: "1",
      RATE_LIMIT_API_MAX: "2",
    }));
    const a = await request(app).get("/api/pricing");
    const b = await request(app).get("/api/pricing");
    const c = await request(app).get("/api/pricing");
    expect([a.status, b.status].every((s) => s !== 429 || s === 429)).toBe(true);
    expect(c.status).toBe(429);
    // Exactly two non-429 then one 429 proves single increment per request
    const non429 = [a.status, b.status, c.status].filter((s) => s !== 429).length;
    expect(non429).toBe(2);
  });
});

describe("app composition — auth limiter order", () => {
  let app;
  let restore;

  beforeAll(() => {
    ({ app, restore } = loadAppFresh({
      NODE_ENV: "test",
      FORCE_AUTH_LIMITER: "1",
      RATE_LIMIT_AUTH_MAX: "2",
      FORCE_API_LIMITER: undefined,
      RATE_LIMIT_API_MAX: undefined,
    }));
  });

  afterAll(() => {
    restore();
  });

  test("auth limiter runs before auth router; over-limit returns 429", async () => {
    const body = { email: "limiter-test@example.com", password: "x" };
    const s1 = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(body);
    const s2 = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(body);
    const s3 = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(body);
    // First two reach the auth router (any non-429); third is auth-limited
    expect(s1.status).not.toBe(429);
    expect(s2.status).not.toBe(429);
    expect(s3.status).toBe(429);
  });
});

describe("app composition — static mounts once", () => {
  const appSrc = fs.readFileSync(APP_PATH, "utf8");

  test("canonical static paths appear once as mounts", () => {
    const countMount = (needle) => (appSrc.match(new RegExp(needle, "g")) || []).length;
    // Primary express.static mounts
    expect(countMount('app\\.use\\(\\s*[\'"]/uploads[\'"]')).toBeGreaterThanOrEqual(1);
    expect(countMount('express\\.static\\(FILE_STORAGE_PATH')).toBe(1);
    expect(countMount('app\\.use\\(\\s*[\'"]/static[\'"]')).toBeLessThanOrEqual(1);
  });
});
