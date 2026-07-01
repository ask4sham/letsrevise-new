/**
 * GET /api/taxonomy/edexcel-igcse-biology — returns Edexcel IGCSE Biology revision-note taxonomy.
 */
const request = require("supertest");
const app = require("../app");

function countHierarchy(units) {
  let sections = 0;
  let lessonTopics = 0;
  for (const unit of units || []) {
    if (Array.isArray(unit.sections) && unit.sections.length > 0) {
      sections += unit.sections.length;
      for (const section of unit.sections) {
        lessonTopics += (section.topics || []).length;
      }
    } else {
      lessonTopics += (unit.topics || []).length;
    }
  }
  return { mainTopics: (units || []).length, sections, lessonTopics };
}

describe("GET /api/taxonomy/edexcel-igcse-biology", () => {
  test("returns 200 with Edexcel IGCSE Biology metadata", async () => {
    const res = await request(app).get("/api/taxonomy/edexcel-igcse-biology");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      specKey: "edexcel-igcse-biology",
      displayName: "Edexcel IGCSE Biology",
    });
    expect(Array.isArray(res.body.units)).toBe(true);
  });

  test("returns 5 main topics, 22 sections, 142 lesson topics", async () => {
    const res = await request(app).get("/api/taxonomy/edexcel-igcse-biology");
    expect(res.status).toBe(200);
    const counts = countHierarchy(res.body.units);
    expect(counts.mainTopics).toBe(5);
    expect(counts.sections).toBe(22);
    expect(counts.lessonTopics).toBe(142);
  });

  test("each section has lesson topics with topic, key, topicKey, requiredPractical", async () => {
    const res = await request(app).get("/api/taxonomy/edexcel-igcse-biology");
    expect(res.status).toBe(200);

    const firstUnit = res.body.units[0];
    expect(firstUnit).toHaveProperty("unit");
    expect(Array.isArray(firstUnit.sections)).toBe(true);
    expect(firstUnit.sections.length).toBeGreaterThan(0);

    const firstSection = firstUnit.sections[0];
    expect(firstSection).toHaveProperty("title");
    expect(firstSection).toHaveProperty("slug");
    expect(Array.isArray(firstSection.topics)).toBe(true);
    expect(firstSection.topics.length).toBeGreaterThan(0);

    const topic = firstSection.topics[0];
    expect(topic).toHaveProperty("topic");
    expect(topic).toHaveProperty("key");
    expect(topic).toHaveProperty("topicKey", `edexcel-igcse-biology:${topic.key}`);
    expect(Array.isArray(topic.tier)).toBe(true);
    expect(typeof topic.requiredPractical).toBe("boolean");
  });
});
