/**
 * GET /api/taxonomy/create-lesson-options — nested Subject → Spec → Main Topic → Sub-topic for Create Lesson.
 */
const request = require("supertest");
const app = require("../app");

describe("GET /api/taxonomy/create-lesson-options", () => {
  test("returns 200 and subjects array", async () => {
    const res = await request(app).get("/api/taxonomy/create-lesson-options").expect(200);
    expect(res.body).toHaveProperty("subjects");
    expect(Array.isArray(res.body.subjects)).toBe(true);
  });

  test("includes Biology if config present", async () => {
    const res = await request(app).get("/api/taxonomy/create-lesson-options").expect(200);
    const biology = res.body.subjects.find((s) => s.subject === "Biology");
    if (biology) {
      expect(biology).toHaveProperty("specs");
      expect(Array.isArray(biology.specs)).toBe(true);
      const spec = biology.specs[0];
      expect(spec).toHaveProperty("specKey");
      expect(spec).toHaveProperty("specLabel");
      expect(spec).toHaveProperty("mainTopics");
      expect(Array.isArray(spec.mainTopics)).toBe(true);
      if (spec.mainTopics.length > 0) {
        const main = spec.mainTopics[0];
        expect(main).toHaveProperty("title");
        expect(main).toHaveProperty("subTopics");
        expect(Array.isArray(main.subTopics)).toBe(true);
        if (main.subTopics.length > 0) {
          const sub = main.subTopics[0];
          expect(sub).toHaveProperty("title");
          expect(sub).toHaveProperty("topicSlug");
          expect(sub).toHaveProperty("topicKey");
          expect(sub).toHaveProperty("path");
          expect(sub.topicKey).toMatch(/^[a-z0-9-]+:[a-z0-9-]+$/);
        }
      }
    }
  });

  test("topicKey is namespaced specKey:topicSlug", async () => {
    const res = await request(app).get("/api/taxonomy/create-lesson-options").expect(200);
    for (const subj of res.body.subjects) {
      for (const spec of subj.specs || []) {
        for (const main of spec.mainTopics || []) {
          for (const sub of main.subTopics || []) {
            expect(sub.topicKey).toMatch(/^[a-z0-9-]+:[a-z0-9-]+$/);
            expect(sub.topicKey).toBe(`${spec.specKey}:${sub.topicSlug}`);
          }
        }
      }
    }
  });

  test("Biology Cell Biology has cell-structure sub-topic", async () => {
    const res = await request(app).get("/api/taxonomy/create-lesson-options").expect(200);
    const biology = res.body.subjects.find((s) => s.subject === "Biology");
    if (!biology || !biology.specs?.length) return;
    const cellBio = biology.specs[0].mainTopics?.find((m) => m.title === "Cell Biology");
    if (!cellBio) return;
    const cellStructure = cellBio.subTopics?.find((s) => s.topicSlug === "cell-structure");
    expect(cellStructure).toBeDefined();
    expect(cellStructure.title).toBe("Cell structure");
    expect(cellStructure.topicKey).toMatch(/^aqa-gcse-biology:cell-structure$/);
  });
});
