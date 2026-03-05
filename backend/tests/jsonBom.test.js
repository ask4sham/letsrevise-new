/**
 * Verify: invalid JSON → 400, valid JSON with BOM → parsed (not 400)
 */
const request = require("supertest");
const app = require("../app");

describe("JSON body parsing", () => {
  it("invalid JSON returns 400", async () => {
    const res = await request(app)
      .post("/api/topic-summary/export")
      .set("Content-Type", "application/json")
      .send("{");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Invalid JSON", message: "Malformed JSON body" });
  });

  it("valid JSON with BOM is parsed (auth fails but not JSON parse)", async () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const body = Buffer.concat([bom, Buffer.from('{"topicSummaryLogId":"abc"}', "utf8")]);
    const res = await request(app)
      .post("/api/topic-summary/export")
      .set("Content-Type", "application/json")
      .send(body);
    // 401 = no auth, not 400 = JSON parse error
    expect(res.status).not.toBe(400);
    expect(res.body?.error).not.toBe("Invalid JSON");
  });
});
