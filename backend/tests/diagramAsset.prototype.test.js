/**
 * P2.1 — Diagram Asset Library prototype tests.
 * Proves: register asset → attach to lesson diagram block → hydrate on GET lesson.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const DiagramAsset = require("../models/DiagramAsset");
const {
  hydrateDiagramAssetsOnPages,
  parseActivityTypes,
  createDiagramAsset,
} = require("../services/diagramAssetService");

jest.setTimeout(20000);

describe("P2.1 Diagram Asset Library prototype", () => {
  let teacherToken;
  let teacherId;
  let prevFlag;

  beforeAll(async () => {
    prevFlag = process.env.DIAGRAM_ASSET_LIBRARY;
    process.env.DIAGRAM_ASSET_LIBRARY = "1";

    const hashedPassword = await bcrypt.hash("password123", 10);
    const teacher = await User.create({
      email: "diagram-asset-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
      firstName: "D",
      lastName: "Teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: teacher.email, password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Teacher login failed");
  });

  afterAll(async () => {
    await DiagramAsset.deleteMany({ ownerId: teacherId });
    await Lesson.deleteMany({ teacherId });
    await User.deleteMany({ email: "diagram-asset-teacher@test.com" });
    if (prevFlag === undefined) delete process.env.DIAGRAM_ASSET_LIBRARY;
    else process.env.DIAGRAM_ASSET_LIBRARY = prevFlag;
  });

  test("returns 404 when feature flag is off", async () => {
    process.env.DIAGRAM_ASSET_LIBRARY = "0";
    const res = await request(app)
      .get("/api/diagram-assets")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(404);
    process.env.DIAGRAM_ASSET_LIBRARY = "1";
  });

  test("GET /api/feature-flags/diagram-assets returns enabled state", async () => {
    const res = await request(app)
      .get("/api/feature-flags/diagram-assets")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });

  test("parseActivityTypes normalizes and defaults to view", () => {
    expect(parseActivityTypes(["hotspot", "invalid", "tti"])).toEqual(["hotspot", "tti"]);
    expect(parseActivityTypes("dragdrop,view")).toEqual(["dragdrop", "view"]);
    expect(parseActivityTypes([])).toEqual(["view"]);
  });

  test("hydrateDiagramAssetsOnPages merges canonical imageUrl from library", async () => {
    const asset = await createDiagramAsset(
      {
        title: "Reflex arc",
        imageUrl: "https://cdn.example.com/reflex-arc.png",
        subject: "Biology",
        topic: "Reflex Arc",
      },
      String(teacherId)
    );

    const pages = [
      {
        pageId: "p1",
        blocks: [
          { type: "diagram", diagramAssetId: asset.id, imageUrl: "https://stale.example/old.png" },
        ],
      },
    ];

    const hydrated = await hydrateDiagramAssetsOnPages(pages);
    const block = hydrated[0].blocks[0];
    expect(block.imageUrl).toBe("https://cdn.example.com/reflex-arc.png");
    expect(block.imageSource).toBe("diagram-asset");
    expect(block._diagramAssetResolved.title).toBe("Reflex arc");
  });

  test("POST create → attach → GET lesson renders hydrated diagram block", async () => {
    const createRes = await request(app)
      .post("/api/diagram-assets")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Nervous system overview",
        subject: "Biology",
        topic: "Nervous System",
        examBoard: "AQA",
        tier: "Higher",
        keywords: ["reflex", "neurone"],
        imageUrl: "https://cdn.example.com/nervous-overview.png",
        source: "chatgpt",
        activityTypes: ["view", "hotspot"],
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.asset.title).toBe("Nervous system overview");
    const assetId = createRes.body.asset.id;

    const lesson = await Lesson.create({
      title: "Diagram asset lesson",
      description: "P2.1 prototype",
      content: "Content",
      teacherId,
      teacherName: "D Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Nervous System",
      status: "published",
      pages: [
        {
          pageId: "p1",
          title: "Overview",
          order: 0,
          blocks: [{ type: "diagram", caption: "Overview" }],
        },
      ],
      quiz: { timeSeconds: 600, questions: [] },
      assessment: { timeSeconds: 600, questions: [] },
    });

    const attachRes = await request(app)
      .post(`/api/diagram-assets/${assetId}/attach`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ lessonId: String(lesson._id), pageIndex: 0, blockIndex: 0 });
    expect(attachRes.status).toBe(200);
    expect(attachRes.body.block.diagramAssetId).toBe(assetId);
    expect(attachRes.body.block.imageUrl).toBe("https://cdn.example.com/nervous-overview.png");

    const getRes = await request(app)
      .get(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(getRes.status).toBe(200);
    const diagramBlock = getRes.body.pages?.[0]?.blocks?.[0];
    expect(diagramBlock?.type).toBe("diagram");
    expect(String(diagramBlock?.diagramAssetId)).toBe(assetId);
    expect(diagramBlock?.imageUrl).toBe("https://cdn.example.com/nervous-overview.png");
    expect(diagramBlock?.imageSource).toBe("diagram-asset");

    const assetDoc = await DiagramAsset.findById(assetId).lean();
    expect(assetDoc.usageCount).toBe(1);
  });

  test("PUT save → GET reload preserves diagramAssetId and hydrates imageUrl", async () => {
    const createRes = await request(app)
      .post("/api/diagram-assets")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Save reload diagram",
        subject: "Biology",
        topic: "Reflex Arc",
        imageUrl: "https://cdn.example.com/save-reload-reflex.png",
        source: "chatgpt",
      });
    expect(createRes.status).toBe(201);
    const assetId = createRes.body.asset.id;

    const lesson = await Lesson.create({
      title: "Save reload lesson",
      description: "P2.2 smoke",
      content: "Content",
      teacherId,
      teacherName: "D Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Reflex Arc",
      status: "draft",
      pages: [
        {
          pageId: "p-save",
          title: "Page 1",
          order: 0,
          blocks: [
            {
              type: "diagram",
              caption: "Legacy inline",
              imageUrl: "https://cdn.example.com/legacy-only.png",
              imageSource: "upload",
            },
            {
              type: "diagram",
              caption: "Library linked",
              diagramAssetId: assetId,
              imageUrl: "https://cdn.example.com/stale-before-save.png",
              imageSource: "diagram-asset",
            },
          ],
        },
      ],
      quiz: { timeSeconds: 600, questions: [] },
      assessment: { timeSeconds: 600, questions: [] },
    });

    const putRes = await request(app)
      .put(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        pages: [
          {
            pageId: "p-save",
            title: "Page 1",
            order: 0,
            blocks: [
              {
                type: "diagram",
                caption: "Legacy inline",
                imageUrl: "https://cdn.example.com/legacy-only.png",
                imageSource: "upload",
              },
              {
                type: "diagram",
                caption: "Library linked",
                diagramAssetId: assetId,
                imageUrl: "https://cdn.example.com/stale-before-save.png",
                imageSource: "diagram-asset",
                alt: "Save reload diagram",
              },
            ],
          },
        ],
      });
    expect(putRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(getRes.status).toBe(200);

    const legacyBlock = getRes.body.pages?.[0]?.blocks?.[0];
    expect(legacyBlock?.type).toBe("diagram");
    expect(legacyBlock?.diagramAssetId).toBeUndefined();
    expect(legacyBlock?.imageUrl).toBe("https://cdn.example.com/legacy-only.png");
    expect(legacyBlock?.imageSource).toBe("upload");

    const libraryBlock = getRes.body.pages?.[0]?.blocks?.[1];
    expect(libraryBlock?.type).toBe("diagram");
    expect(String(libraryBlock?.diagramAssetId)).toBe(assetId);
    expect(libraryBlock?.imageUrl).toBe("https://cdn.example.com/save-reload-reflex.png");
    expect(libraryBlock?.imageSource).toBe("diagram-asset");
  });

  test("feature flag OFF returns disabled for diagram-assets UI endpoint", async () => {
    process.env.DIAGRAM_ASSET_LIBRARY = "0";
    const res = await request(app)
      .get("/api/feature-flags/diagram-assets")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    process.env.DIAGRAM_ASSET_LIBRARY = "1";
  });

  test("rejects create without title or imageUrl", async () => {
    const noTitle = await request(app)
      .post("/api/diagram-assets")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ imageUrl: "https://cdn.example.com/x.png" });
    expect(noTitle.status).toBe(422);

    const noUrl = await request(app)
      .post("/api/diagram-assets")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ title: "Missing url" });
    expect(noUrl.status).toBe(422);
  });

  test("list returns owner assets", async () => {
    const listRes = await request(app)
      .get("/api/diagram-assets")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.assets)).toBe(true);
    expect(listRes.body.assets.length).toBeGreaterThan(0);
  });
});
