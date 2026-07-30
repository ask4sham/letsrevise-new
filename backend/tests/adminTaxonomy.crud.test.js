/**
 * Admin Taxonomy CRUD tests: rename, move, delete (guarded by linked content).
 * Fixtures must satisfy unique index { specKey, parentId, slug }.
 * Run: npm test -- adminTaxonomy.crud.test.js
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";

const request = require("supertest");
const mongoose = require("mongoose");
const AdminTaxonomyItem = require("../models/AdminTaxonomyItem");
const AdminTopicPlacement = require("../models/AdminTopicPlacement");
const Lesson = require("../models/Lesson");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const SPEC = "aqa-gcse-biology";
/** Namespace for all fixtures created by this suite (cleanup allowlist). */
const FX = "test-admin-taxonomy";

let app;
let authToken;
let adminUserId;

/** Match admin section created with title "Cell Division" (slug cell-division). */
function findCellDivisionSection(sections) {
  return (sections || []).find((s) => (s.slug || "").toLowerCase() === "cell-division");
}

async function cleanupSuiteFixtures() {
  await AdminTaxonomyItem.deleteMany({
    specKey: SPEC,
    $or: [
      { slug: new RegExp(`^${FX}-`) },
      { unitKey: new RegExp(`^${FX}-`) },
      { key: new RegExp(`^${FX}-`) },
      { topicKey: new RegExp(`^${SPEC}:${FX}-`) },
      { type: "section", slug: "cell-division" },
    ],
  });
  await AdminTopicPlacement.deleteMany({
    specKey: SPEC,
    topicSlug: {
      $in: [
        "chromosomes",
        "mitosis-cell-cycle",
        "stem-cells",
        `${FX}-sub-rename`,
        `${FX}-sub-to-move`,
        `${FX}-topic-with-content`,
      ],
    },
  });
  await Lesson.deleteMany({ topicKey: new RegExp(`^${SPEC}:${FX}-`) });
}

/**
 * Top-level unit fixture: parentId null requires a unique non-empty slug.
 */
async function createUnitFixture({ slug, unit, unitKey }) {
  const doc = await AdminTaxonomyItem.create({
    specKey: SPEC,
    type: "unit",
    unit,
    unitKey,
    key: unitKey,
    slug,
    parentId: null,
  });
  expect(doc.parentId).toBeNull();
  expect(String(doc.slug || "").trim().length).toBeGreaterThan(0);
  return doc;
}

/**
 * Sub-topic under a real parent unit: unique slug + parentId set.
 */
async function createSubTopicFixture({ parent, topic, key, topicKey, slug }) {
  const doc = await AdminTaxonomyItem.create({
    specKey: SPEC,
    type: "subTopic",
    unit: parent.unit,
    unitKey: parent.unitKey,
    parentId: parent._id,
    parentKey: parent.unitKey,
    topic,
    key,
    topicKey,
    slug,
  });
  expect(doc.parentId).toBeTruthy();
  expect(String(doc.parentId)).toBe(String(parent._id));
  expect(String(doc.slug || "").trim().length).toBeGreaterThan(0);
  return doc;
}

beforeAll(async () => {
  app = require("../app");
  // Enforce the real unique index contract before any fixture create.
  await AdminTaxonomyItem.syncIndexes();
  const admin = await User.create({
    firstName: "Taxonomy",
    lastName: "Admin",
    email: "taxonomy-admin@test.com",
    password: bcrypt.hashSync("password123", 10),
    userType: "admin",
  });
  adminUserId = admin._id;
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "taxonomy-admin@test.com", password: "password123" });
  authToken = loginRes.body?.token;
  if (!authToken) throw new Error("Admin login failed");
}, 60000);

beforeEach(async () => {
  await cleanupSuiteFixtures();
});

afterEach(async () => {
  await cleanupSuiteFixtures();
});

describe("Admin Taxonomy CRUD", () => {
  test("fixtures satisfy unique parentId+slug index when indexes are ready", async () => {
    await AdminTaxonomyItem.syncIndexes();
    const source = await createUnitFixture({
      slug: `${FX}-unit-index-source`,
      unit: "Index Source Unit",
      unitKey: `${FX}-unit-index-source`,
    });
    const target = await createUnitFixture({
      slug: `${FX}-unit-index-target`,
      unit: "Index Target Unit",
      unitKey: `${FX}-unit-index-target`,
    });
    const sub = await createSubTopicFixture({
      parent: source,
      topic: "Index Sub",
      key: `${FX}-sub-index`,
      topicKey: `${SPEC}:${FX}-sub-index`,
      slug: `${FX}-sub-index`,
    });
    expect(sub.parentId).toBeTruthy();
    expect(sub.slug).toBe(`${FX}-sub-index`);
    expect(source.slug).not.toBe(target.slug);
    expect(source.slug).not.toBe(sub.slug);
  });

  test("PATCH main-topic: rename title", async () => {
    const unit = await createUnitFixture({
      slug: `${FX}-unit-rename`,
      unit: "Test Unit Rename",
      unitKey: `${FX}-unit-rename`,
    });
    const res = await request(app)
      .patch(`/api/admin/taxonomy/main-topic/${unit._id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Renamed Unit" });
    expect(res.status).toBe(200);
    expect(res.body?.item?.unit).toBe("Renamed Unit");
    const updated = await AdminTaxonomyItem.findById(unit._id);
    expect(updated.unit).toBe("Renamed Unit");
  });

  test("PATCH sub-topic: rename title", async () => {
    const parent = await createUnitFixture({
      slug: `${FX}-unit-sub-rename-parent`,
      unit: "Sub Rename Parent",
      unitKey: `${FX}-unit-sub-rename-parent`,
    });
    const sub = await createSubTopicFixture({
      parent,
      topic: "Test Sub Rename",
      key: `${FX}-sub-rename`,
      topicKey: `${SPEC}:${FX}-sub-rename`,
      slug: `${FX}-sub-rename`,
    });
    const res = await request(app)
      .patch(`/api/admin/taxonomy/sub-topic/${sub._id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Renamed Sub" });
    expect(res.status).toBe(200);
    expect(res.body?.item?.topic).toBe("Renamed Sub");
  });

  test("POST sub-topic move: move to another main topic", async () => {
    const sourceUnit = await createUnitFixture({
      slug: `${FX}-unit-move-source`,
      unit: "Source Unit For Move",
      unitKey: `${FX}-unit-move-source`,
    });
    const targetUnit = await createUnitFixture({
      slug: `${FX}-unit-move-target`,
      unit: "Target Unit For Move",
      unitKey: `${FX}-unit-move-target`,
    });
    const sub = await createSubTopicFixture({
      parent: sourceUnit,
      topic: "Sub To Move",
      key: `${FX}-sub-to-move`,
      topicKey: `${SPEC}:${FX}-sub-to-move`,
      slug: `${FX}-sub-to-move`,
    });
    const res = await request(app)
      .post(`/api/admin/taxonomy/sub-topic/${sub._id}/move`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ targetMainTopicId: targetUnit._id.toString() });
    expect(res.status).toBe(200);
    const updated = await AdminTaxonomyItem.findById(sub._id);
    expect(updated.unitKey).toBe(`${FX}-unit-move-target`);
    // Move-to-main-topic sets parentId null; slug must remain unique among top-level index keys.
    expect(String(updated.slug || "").trim()).toBe(`${FX}-sub-to-move`);
  });

  test("DELETE sub-topic: blocked when linked content exists", async () => {
    const parent = await createUnitFixture({
      slug: `${FX}-unit-delete-linked`,
      unit: "Delete Linked Parent",
      unitKey: `${FX}-unit-delete-linked`,
    });
    const sub = await createSubTopicFixture({
      parent,
      topic: "Topic With Content",
      key: `${FX}-topic-with-content`,
      topicKey: `${SPEC}:${FX}-topic-with-content`,
      slug: `${FX}-topic-with-content`,
    });
    await Lesson.create({
      title: "Test Lesson",
      description: "Fixture lesson for taxonomy delete guard",
      content: "Test content",
      teacherId: adminUserId,
      teacherName: "Taxonomy Admin",
      subject: "Biology",
      level: "GCSE",
      topic: "Topic With Content",
      topicKey: `${SPEC}:${FX}-topic-with-content`,
      status: "draft",
    });
    const res = await request(app)
      .delete(`/api/admin/taxonomy/sub-topic/${sub._id}`)
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(409);
    expect(res.body?.error).toMatch(/linked content/i);
    expect(res.body?.linkedCounts?.lessons).toBeGreaterThan(0);
  });

  /** Cell Division acceptance: create section, move Chromosomes/Mitosis/Stem cells under it */
  test("Cell Division: create section and move topics under it", async () => {
    const createRes = await request(app)
      .post("/api/admin/taxonomy/section")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ specKey: SPEC, parentUnitKey: "cell-biology", title: "Cell Division" });
    expect(createRes.status).toBe(201);
    const section = createRes.body?.item;
    expect(section?.type).toBe("section");
    expect(section?.title).toBe("Cell Division");
    expect(section?.parentUnitKey).toBe("cell-biology");
    expect(String(section?.slug || "").trim().length).toBeGreaterThan(0);

    for (const slug of ["chromosomes", "mitosis-cell-cycle", "stem-cells"]) {
      const placeRes = await request(app)
        .post("/api/admin/taxonomy/topic-placement")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ specKey: SPEC, topicSlug: slug, sectionId: section._id.toString() });
      expect(placeRes.status).toBe(200);
    }

    const hierRes = await request(app)
      .get("/api/admin/taxonomy")
      .set("Authorization", `Bearer ${authToken}`);
    expect(hierRes.status).toBe(200);
    const bio = hierRes.body?.hierarchy?.find((s) => s.subject === "Biology");
    const aqaBio = bio?.specs?.find((sp) => sp.specKey === SPEC);
    const cellBio = aqaBio?.mainTopics?.find((u) => (u.unitKey || "").toLowerCase() === "cell-biology");
    expect(cellBio).toBeDefined();
    const cellDivSection = findCellDivisionSection(cellBio?.sections);
    expect(cellDivSection).toBeDefined();
    const sectionTopicKeys = (cellDivSection?.topics || []).map((t) => (t.key || "").toLowerCase());
    expect(sectionTopicKeys).toContain("chromosomes");
    expect(sectionTopicKeys).toContain("mitosis-cell-cycle");
    expect(sectionTopicKeys).toContain("stem-cells");

    const deleteRes = await request(app)
      .delete(`/api/admin/taxonomy/section/${section._id}`)
      .set("Authorization", `Bearer ${authToken}`);
    expect(deleteRes.status).toBe(200);

    const hier2Res = await request(app)
      .get("/api/admin/taxonomy")
      .set("Authorization", `Bearer ${authToken}`);
    const cellBio2 = hier2Res.body?.hierarchy
      ?.find((s) => s.subject === "Biology")
      ?.specs?.find((sp) => sp.specKey === SPEC)
      ?.mainTopics?.find((u) => (u.unitKey || "").toLowerCase() === "cell-biology");
    expect(findCellDivisionSection(cellBio2?.sections)).toBeUndefined();
  });
});
