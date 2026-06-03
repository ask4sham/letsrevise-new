/**
 * Admin Taxonomy CRUD tests: rename, move, delete (guarded by linked content).
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

let app;

let authToken;
let adminUserId;

/** Match admin section created with title "Cell Division" (slug cell-division). */
function findCellDivisionSection(sections) {
  return (sections || []).find((s) => (s.slug || "").toLowerCase() === "cell-division");
}

beforeAll(async () => {
  app = require("../app");
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

afterEach(async () => {
  await AdminTaxonomyItem.deleteMany({ specKey: "aqa-gcse-biology", unitKey: /^test-unit-/ });
  await AdminTaxonomyItem.deleteMany({ specKey: "aqa-gcse-biology", type: "section", slug: "cell-division" });
  await AdminTopicPlacement.deleteMany({ specKey: "aqa-gcse-biology", topicSlug: { $in: ["chromosomes", "mitosis-cell-cycle", "stem-cells"] } });
  await Lesson.deleteMany({ topicKey: /test-topic-with-content/ });
});

describe("Admin Taxonomy CRUD", () => {
  test("PATCH main-topic: rename title", async () => {
    const unit = await AdminTaxonomyItem.create({
      specKey: "aqa-gcse-biology",
      type: "unit",
      unit: "Test Unit Rename",
      unitKey: "test-unit-rename",
      key: "test-unit-rename",
    });
    const res = await request(app)
      .patch(`/api/admin/taxonomy/main-topic/${unit._id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Renamed Unit" });
    expect(res.status).toBe(200);
    expect(res.body?.item?.unit).toBe("Renamed Unit");
    const updated = await AdminTaxonomyItem.findById(unit._id);
    expect(updated.unit).toBe("Renamed Unit");
    await AdminTaxonomyItem.findByIdAndDelete(unit._id);
  });

  test("PATCH sub-topic: rename title", async () => {
    const sub = await AdminTaxonomyItem.create({
      specKey: "aqa-gcse-biology",
      type: "subTopic",
      unit: "Cell Biology",
      unitKey: "cell-biology",
      topic: "Test Sub Rename",
      key: "test-sub-rename",
      topicKey: "aqa-gcse-biology:test-sub-rename",
    });
    const res = await request(app)
      .patch(`/api/admin/taxonomy/sub-topic/${sub._id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Renamed Sub" });
    expect(res.status).toBe(200);
    expect(res.body?.item?.topic).toBe("Renamed Sub");
    await AdminTaxonomyItem.findByIdAndDelete(sub._id);
  });

  test("POST sub-topic move: move to another main topic", async () => {
    const targetUnit = await AdminTaxonomyItem.create({
      specKey: "aqa-gcse-biology",
      type: "unit",
      unit: "Target Unit For Move",
      unitKey: "test-target-unit-move",
      key: "test-target-unit-move",
    });
    const sub = await AdminTaxonomyItem.create({
      specKey: "aqa-gcse-biology",
      type: "subTopic",
      unit: "Cell Biology",
      unitKey: "cell-biology",
      topic: "Sub To Move",
      key: "test-sub-to-move",
      topicKey: "aqa-gcse-biology:test-sub-to-move",
    });
    const res = await request(app)
      .post(`/api/admin/taxonomy/sub-topic/${sub._id}/move`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ targetMainTopicId: targetUnit._id.toString() });
    expect(res.status).toBe(200);
    const updated = await AdminTaxonomyItem.findById(sub._id);
    expect(updated.unitKey).toBe("test-target-unit-move");
    await AdminTaxonomyItem.findByIdAndDelete(sub._id);
    await AdminTaxonomyItem.findByIdAndDelete(targetUnit._id);
  });

  test("DELETE sub-topic: blocked when linked content exists", async () => {
    const sub = await AdminTaxonomyItem.create({
      specKey: "aqa-gcse-biology",
      type: "subTopic",
      unit: "Cell Biology",
      unitKey: "cell-biology",
      topic: "Topic With Content",
      key: "test-topic-with-content",
      topicKey: "aqa-gcse-biology:test-topic-with-content",
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
      topicKey: "aqa-gcse-biology:test-topic-with-content",
      status: "draft",
    });
    const res = await request(app)
      .delete(`/api/admin/taxonomy/sub-topic/${sub._id}`)
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(409);
    expect(res.body?.error).toMatch(/linked content/i);
    expect(res.body?.linkedCounts?.lessons).toBeGreaterThan(0);
    await Lesson.deleteMany({ topicKey: "aqa-gcse-biology:test-topic-with-content" });
    await AdminTaxonomyItem.findByIdAndDelete(sub._id);
  });

  /** Cell Division acceptance: create section, move Chromosomes/Mitosis/Stem cells under it */
  test("Cell Division: create section and move topics under it", async () => {
    const createRes = await request(app)
      .post("/api/admin/taxonomy/section")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ specKey: "aqa-gcse-biology", parentUnitKey: "cell-biology", title: "Cell Division" });
    expect(createRes.status).toBe(201);
    const section = createRes.body?.item;
    expect(section?.type).toBe("section");
    expect(section?.title).toBe("Cell Division");
    expect(section?.parentUnitKey).toBe("cell-biology");

    for (const slug of ["chromosomes", "mitosis-cell-cycle", "stem-cells"]) {
      const placeRes = await request(app)
        .post("/api/admin/taxonomy/topic-placement")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ specKey: "aqa-gcse-biology", topicSlug: slug, sectionId: section._id.toString() });
      expect(placeRes.status).toBe(200);
    }

    const hierRes = await request(app)
      .get("/api/admin/taxonomy")
      .set("Authorization", `Bearer ${authToken}`);
    expect(hierRes.status).toBe(200);
    const bio = hierRes.body?.hierarchy?.find((s) => s.subject === "Biology");
    const aqaBio = bio?.specs?.find((sp) => sp.specKey === "aqa-gcse-biology");
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
    const cellBio2 = hier2Res.body?.hierarchy?.find((s) => s.subject === "Biology")?.specs?.find((sp) => sp.specKey === "aqa-gcse-biology")?.mainTopics?.find((u) => (u.unitKey || "").toLowerCase() === "cell-biology");
    expect(findCellDivisionSection(cellBio2?.sections)).toBeUndefined();
  });
});
