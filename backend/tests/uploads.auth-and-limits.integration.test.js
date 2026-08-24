/**
 * Upload route auth, staff role gate, always-on rate limits, pre-Multer security.
 * Mirrors production mounts: direct /api/uploads/video + /api/uploads router.
 * Mocks storage; never contacts live Supabase/R2; uses in-memory Mongo from setup.js.
 */
const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const multerInvocation = { count: 0 };

jest.mock("multer", () => {
  const actual = jest.requireActual("multer");
  function mockedMulter(...args) {
    const inst = actual(...args);
    const origSingle = inst.single.bind(inst);
    inst.single = (field) => {
      const mw = origSingle(field);
      return function wrappedMulterSingle(req, res, next) {
        multerInvocation.count += 1;
        return mw(req, res, next);
      };
    };
    return inst;
  }
  mockedMulter.memoryStorage = actual.memoryStorage;
  mockedMulter.diskStorage = actual.diskStorage;
  mockedMulter.MulterError = actual.MulterError;
  return mockedMulter;
});

const mockTryPutBuffer = jest.fn(async () => ({
  url: "https://example.test/mock-upload.png",
  storage: "mock",
}));

jest.mock("../services/uploadObjectStorage", () => ({
  tryPutBuffer: (...args) => mockTryPutBuffer(...args),
}));

jest.mock("../services/supabaseStorage", () => ({
  isSupabaseStorageEnabled: () => false,
  uploadToSupabase: jest.fn(),
}));

jest.mock("../services/r2Storage", () => ({
  isR2Enabled: () => false,
  uploadToR2: jest.fn(),
}));

// Avoid sharp/display-PNG sibling upload so storage-call counts stay deterministic
jest.mock("../services/lessonPngDisplay", () => ({
  isPngMime: () => false,
  displayFilenameForPng: () => null,
  createLessonPngDisplayBuffer: async () => null,
}));

const authRoutes = require("../routes/auth");
const uploadsRouter = require("../routes/uploads");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");
const {
  IMAGE_UPLOAD_RATE_MAX,
  VIDEO_UPLOAD_RATE_MAX,
} = require("../middleware/uploadRouteRateLimits");

let ExamQuestionRationaleCandidate;
try {
  ExamQuestionRationaleCandidate = require("../models/ExamQuestionRationaleCandidate");
} catch (_) {
  ExamQuestionRationaleCandidate = null;
}

const hashedPassword = bcrypt.hashSync("password123", 10);

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const TINY_PNG = Buffer.from(TINY_PNG_BASE64, "base64");

const ROUTES = [
  { name: "image", path: "/api/uploads/image", field: "file", kind: "image" },
  { name: "lesson-image", path: "/api/uploads/lesson-image", field: "image", kind: "image" },
  { name: "lesson-media", path: "/api/uploads/lesson-media", field: "file", kind: "image" },
  { name: "video", path: "/api/uploads/video", field: "file", kind: "video" },
];

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  // Direct video mount (same chain as production app.js)
  app.post("/api/uploads/video", ...uploadsRouter.videoUploadRoute);
  app.use("/api/uploads", uploadsRouter);
  // Second mount of the identical video chain — proves shared limiter (bypass impossible)
  app.post("/api/uploads-video-alias", ...uploadsRouter.videoUploadRoute);
  return app;
}

async function loginAs(app, { email, userType, staffRole }) {
  const doc = {
    firstName: "Upload",
    lastName: userType,
    email,
    password: hashedPassword,
    userType,
  };
  if (staffRole) doc.staffRole = staffRole;
  const user = await User.create(doc);
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "password123" });
  const token = login.body?.token;
  if (!token) throw new Error(`Login failed for ${email}: ${JSON.stringify(login.body)}`);
  return { user, token };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

describe("Upload route auth and limits", () => {
  const app = buildApp();
  let teacherToken;
  let adminToken;
  let studentToken;
  let parentToken;
  let cmToken;

  let lessonCreateSpy;
  let examCreateSpy;
  let candidateCreateSpy;
  let mkdirSpy;
  let writeSpy;
  let renameSpy;

  beforeAll(async () => {
    process.env.RATE_LIMIT_ENABLED = "0"; // must NOT disable always-on upload limiters

    teacherToken = (await loginAs(app, { email: "upload-teacher@test.com", userType: "teacher" })).token;
    adminToken = (await loginAs(app, { email: "upload-admin@test.com", userType: "admin" })).token;
    studentToken = (await loginAs(app, { email: "upload-student@test.com", userType: "student" })).token;
    parentToken = (await loginAs(app, { email: "upload-parent@test.com", userType: "parent" })).token;
    // staffRole alone (userType student) — proves content_manager branch
    cmToken = (
      await loginAs(app, {
        email: "upload-cm@test.com",
        userType: "student",
        staffRole: "content_manager",
      })
    ).token;
  }, 30000);

  beforeEach(() => {
    multerInvocation.count = 0;
    mockTryPutBuffer.mockClear();
    lessonCreateSpy = jest.spyOn(Lesson, "create").mockImplementation(() => {
      throw new Error("Lesson.create must not be called from upload routes");
    });
    examCreateSpy = jest.spyOn(ExamQuestion, "create").mockImplementation(() => {
      throw new Error("ExamQuestion.create must not be called from upload routes");
    });
    if (ExamQuestionRationaleCandidate) {
      candidateCreateSpy = jest
        .spyOn(ExamQuestionRationaleCandidate, "create")
        .mockImplementation(() => {
          throw new Error("Candidate.create must not be called from upload routes");
        });
    }
    mkdirSpy = jest.spyOn(fs, "mkdirSync");
    writeSpy = jest.spyOn(fs, "writeFileSync");
    renameSpy = jest.spyOn(fs, "renameSync");
  });

  afterEach(() => {
    lessonCreateSpy.mockRestore();
    examCreateSpy.mockRestore();
    if (candidateCreateSpy) candidateCreateSpy.mockRestore();
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
    renameSpy.mockRestore();
  });

  describe("role matrix", () => {
    for (const route of ROUTES) {
      describe(route.path, () => {
        it("anonymous → 401", async () => {
          const res = await request(app).post(route.path);
          expect(res.status).toBe(401);
          expect(res.body.url).toBeUndefined();
        });

        it("student → 403", async () => {
          const res = await request(app)
            .post(route.path)
            .set(authHeader(studentToken));
          expect(res.status).toBe(403);
          expect(res.body.url).toBeUndefined();
        });

        it("parent → 403", async () => {
          const res = await request(app)
            .post(route.path)
            .set(authHeader(parentToken));
          expect(res.status).toBe(403);
          expect(res.body.url).toBeUndefined();
        });

        it("teacher reaches validation (missing file → 400)", async () => {
          const res = await request(app)
            .post(route.path)
            .set(authHeader(teacherToken));
          expect(res.status).toBe(400);
          expect(res.body.error || res.body.msg).toBeTruthy();
        });

        it("admin reaches validation (missing file → 400)", async () => {
          const res = await request(app)
            .post(route.path)
            .set(authHeader(adminToken));
          expect(res.status).toBe(400);
        });

        it("content_manager reaches validation (missing file → 400)", async () => {
          const res = await request(app)
            .post(route.path)
            .set(authHeader(cmToken));
          expect(res.status).toBe(400);
        });
      });
    }
  });

  describe("pre-Multer security", () => {
    it("401 does not invoke Multer or storage", async () => {
      multerInvocation.count = 0;
      mockTryPutBuffer.mockClear();
      const beforeWrite = writeSpy.mock.calls.length;
      const beforeRename = renameSpy.mock.calls.length;

      const res = await request(app).post("/api/uploads/image");
      expect(res.status).toBe(401);
      expect(multerInvocation.count).toBe(0);
      expect(mockTryPutBuffer).not.toHaveBeenCalled();
      expect(writeSpy.mock.calls.length).toBe(beforeWrite);
      expect(renameSpy.mock.calls.length).toBe(beforeRename);
      expect(res.body.url).toBeUndefined();
    });

    it("403 does not invoke Multer or storage (student on video)", async () => {
      multerInvocation.count = 0;
      mockTryPutBuffer.mockClear();
      const beforeWrite = writeSpy.mock.calls.length;
      const beforeRename = renameSpy.mock.calls.length;

      const res = await request(app)
        .post("/api/uploads/video")
        .set(authHeader(studentToken));
      expect(res.status).toBe(403);
      expect(multerInvocation.count).toBe(0);
      expect(mockTryPutBuffer).not.toHaveBeenCalled();
      expect(writeSpy.mock.calls.length).toBe(beforeWrite);
      expect(renameSpy.mock.calls.length).toBe(beforeRename);
    });

    it("403 does not invoke Multer on lesson-media", async () => {
      multerInvocation.count = 0;
      const res = await request(app)
        .post("/api/uploads/lesson-media")
        .set(authHeader(parentToken));
      expect(res.status).toBe(403);
      expect(multerInvocation.count).toBe(0);
      expect(mockTryPutBuffer).not.toHaveBeenCalled();
    });
  });

  describe("image-family rate limits", () => {
    it("shared counter across /image and /lesson-image; storage not called on 429", async () => {
      const { token } = await loginAs(app, {
        email: `upload-rl-img-${Date.now()}@test.com`,
        userType: "teacher",
      });
      for (let i = 0; i < IMAGE_UPLOAD_RATE_MAX; i++) {
        const res = await request(app)
          .post("/api/uploads/image")
          .set(authHeader(token));
        expect(res.status).toBe(400);
      }
      mockTryPutBuffer.mockClear();
      multerInvocation.count = 0;
      const over = await request(app)
        .post("/api/uploads/lesson-image")
        .set(authHeader(token));
      expect(over.status).toBe(429);
      expect(over.body.error).toMatch(/Too many uploads/i);
      expect(mockTryPutBuffer).not.toHaveBeenCalled();
      expect(multerInvocation.count).toBe(0);
    }, 60000);

    it("/lesson-media shares the same image-family counter namespace", async () => {
      const { token } = await loginAs(app, {
        email: `upload-rl-lm-${Date.now()}@test.com`,
        userType: "teacher",
      });
      for (let i = 0; i < IMAGE_UPLOAD_RATE_MAX; i++) {
        const res = await request(app)
          .post("/api/uploads/lesson-media")
          .set(authHeader(token));
        expect(res.status).toBe(400);
      }
      mockTryPutBuffer.mockClear();
      multerInvocation.count = 0;
      const over = await request(app)
        .post("/api/uploads/image")
        .set(authHeader(token));
      expect(over.status).toBe(429);
      expect(mockTryPutBuffer).not.toHaveBeenCalled();
      expect(multerInvocation.count).toBe(0);
    }, 60000);

    it("per-user counters are independent", async () => {
      const userA = await loginAs(app, {
        email: `upload-rl-a-${Date.now()}@test.com`,
        userType: "teacher",
      });
      const userB = await loginAs(app, {
        email: `upload-rl-b-${Date.now()}@test.com`,
        userType: "teacher",
      });
      for (let i = 0; i < IMAGE_UPLOAD_RATE_MAX; i++) {
        await request(app)
          .post("/api/uploads/image")
          .set(authHeader(userA.token));
      }
      const blocked = await request(app)
        .post("/api/uploads/image")
        .set(authHeader(userA.token));
      expect(blocked.status).toBe(429);
      const other = await request(app)
        .post("/api/uploads/image")
        .set(authHeader(userB.token));
      expect(other.status).toBe(400);
    }, 60000);
  });

  describe("video rate limits and dual mount", () => {
    it("router/direct alias share video counter; 429 before Multer", async () => {
      const cmVideoUser = await loginAs(app, {
        email: "upload-video-rl@test.com",
        userType: "teacher",
      });
      for (let i = 0; i < VIDEO_UPLOAD_RATE_MAX; i++) {
        const res = await request(app)
          .post("/api/uploads/video")
          .set(authHeader(cmVideoUser.token));
        expect(res.status).toBe(400);
      }
      mockTryPutBuffer.mockClear();
      multerInvocation.count = 0;
      const overAlias = await request(app)
        .post("/api/uploads-video-alias")
        .set(authHeader(cmVideoUser.token));
      expect(overAlias.status).toBe(429);
      expect(overAlias.body.error).toMatch(/Too many uploads/i);
      expect(mockTryPutBuffer).not.toHaveBeenCalled();
      expect(multerInvocation.count).toBe(0);
    }, 30000);

    it("direct mount still requires auth", async () => {
      const res = await request(app).post("/api/uploads/video");
      expect(res.status).toBe(401);
      expect(multerInvocation.count).toBe(0);
    });
  });

  describe("image MIME/extension validation", () => {
    const teacherForMime = () =>
      loginAs(app, {
        email: `upload-mime-${Date.now()}@test.com`,
        userType: "teacher",
      });

    it("accepts PNG with matching MIME", async () => {
      const { token } = await teacherForMime();
      mockTryPutBuffer.mockResolvedValueOnce({
        url: "https://example.test/ok.png",
        storage: "mock",
      });
      const res = await request(app)
        .post("/api/uploads/image")
        .set(authHeader(token))
        .attach("file", TINY_PNG, { filename: "ok.png", contentType: "image/png" });
      expect(res.status).toBe(200);
      expect(res.body.url).toBe("https://example.test/ok.png");
      expect(mockTryPutBuffer).toHaveBeenCalledTimes(1);
    });

    it("rejects SVG", async () => {
      const { token } = await teacherForMime();
      mockTryPutBuffer.mockClear();
      const res = await request(app)
        .post("/api/uploads/image")
        .set(authHeader(token))
        .attach("file", Buffer.from("<svg></svg>"), {
          filename: "x.svg",
          contentType: "image/svg+xml",
        });
      expect(res.status).toBe(400);
      expect(mockTryPutBuffer).not.toHaveBeenCalled();
    });

    it("rejects HTML", async () => {
      const { token } = await teacherForMime();
      mockTryPutBuffer.mockClear();
      const res = await request(app)
        .post("/api/uploads/image")
        .set(authHeader(token))
        .attach("file", Buffer.from("<html></html>"), {
          filename: "x.html",
          contentType: "text/html",
        });
      expect(res.status).toBe(400);
      expect(mockTryPutBuffer).not.toHaveBeenCalled();
    });

    it("rejects executable extension", async () => {
      const { token } = await teacherForMime();
      mockTryPutBuffer.mockClear();
      const res = await request(app)
        .post("/api/uploads/image")
        .set(authHeader(token))
        .attach("file", Buffer.from("MZ"), {
          filename: "x.exe",
          contentType: "application/octet-stream",
        });
      expect(res.status).toBe(400);
      expect(mockTryPutBuffer).not.toHaveBeenCalled();
    });

    it("rejects MIME/extension mismatch", async () => {
      const { token } = await teacherForMime();
      mockTryPutBuffer.mockClear();
      const res = await request(app)
        .post("/api/uploads/image")
        .set(authHeader(token))
        .attach("file", TINY_PNG, {
          filename: "x.png",
          contentType: "image/jpeg",
        });
      expect(res.status).toBe(400);
      expect(mockTryPutBuffer).not.toHaveBeenCalled();
    });

    it("rejects unknown image/* (e.g. image/tiff)", async () => {
      const { token } = await teacherForMime();
      mockTryPutBuffer.mockClear();
      const res = await request(app)
        .post("/api/uploads/image")
        .set(authHeader(token))
        .attach("file", Buffer.from("II*"), {
          filename: "x.tiff",
          contentType: "image/tiff",
        });
      expect(res.status).toBe(400);
      expect(mockTryPutBuffer).not.toHaveBeenCalled();
    });

    it("rejects wrong form field", async () => {
      const { token } = await teacherForMime();
      mockTryPutBuffer.mockClear();
      const res = await request(app)
        .post("/api/uploads/image")
        .set(authHeader(token))
        .attach("image", TINY_PNG, { filename: "ok.png", contentType: "image/png" });
      expect(res.status).toBe(400);
      expect(mockTryPutBuffer).not.toHaveBeenCalled();
    });

    it("limitation: forged image/png content is not magic-byte detected", () => {
      // Documented follow-up: HTML bytes with filename .png and Content-Type image/png
      // would still pass the MIME∩extension filter without magic-byte validation.
      expect(true).toBe(true);
    });
  });

  describe("video validation regression", () => {
    it("disallowed extension blocked; storage not called", async () => {
      const { token } = await loginAs(app, {
        email: `upload-vid-bad-${Date.now()}@test.com`,
        userType: "teacher",
      });
      mockTryPutBuffer.mockClear();
      const res = await request(app)
        .post("/api/uploads/video")
        .set(authHeader(token))
        .attach("file", Buffer.from("not-video"), {
          filename: "x.exe",
          contentType: "application/octet-stream",
        });
      expect(res.status).toBe(400);
      expect(mockTryPutBuffer).not.toHaveBeenCalled();
    });

    it("size limits remain configured in source", () => {
      const src = fs.readFileSync(
        path.join(__dirname, "..", "routes", "uploads.js"),
        "utf8"
      );
      expect(src).toMatch(/fileSize:\s*15\s*\*\s*1024\s*\*\s*1024/);
      expect(src).toMatch(/fileSize:\s*100\s*\*\s*1024\s*\*\s*1024/);
    });
  });

  describe("storage and no unrelated writes", () => {
    it("valid teacher upload calls storage once; no Lesson/ExamQuestion/Candidate write", async () => {
      const { token } = await loginAs(app, {
        email: `upload-ok-${Date.now()}@test.com`,
        userType: "teacher",
      });
      mockTryPutBuffer.mockClear();
      mockTryPutBuffer.mockResolvedValueOnce({
        url: "https://example.test/once.png",
        storage: "mock",
      });
      const res = await request(app)
        .post("/api/uploads/image")
        .set(authHeader(token))
        .attach("file", TINY_PNG, { filename: "once.png", contentType: "image/png" });
      expect(res.status).toBe(200);
      expect(res.body.url).toBe("https://example.test/once.png");
      expect(mockTryPutBuffer).toHaveBeenCalledTimes(1);
      expect(lessonCreateSpy).not.toHaveBeenCalled();
      expect(examCreateSpy).not.toHaveBeenCalled();
      if (candidateCreateSpy) expect(candidateCreateSpy).not.toHaveBeenCalled();
    });

    it("always-on limiters ignore RATE_LIMIT_ENABLED=0", () => {
      expect(process.env.RATE_LIMIT_ENABLED).toBe("0");
      expect(IMAGE_UPLOAD_RATE_MAX).toBe(20);
      expect(VIDEO_UPLOAD_RATE_MAX).toBe(5);
      expect(Array.isArray(uploadsRouter.videoUploadRoute)).toBe(true);
      expect(uploadsRouter.videoUploadRoute.length).toBe(4);
    });
  });
});
