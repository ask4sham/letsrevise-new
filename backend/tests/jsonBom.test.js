/**
 * Verify: valid JSON with BOM/UTF-16LE (PowerShell ConvertTo-Json) is parsed.
 * Invalid JSON → 400 is tested via curl in README.
 */
const request = require("supertest");
const app = require("../app");

describe("JSON body parsing", () => {
  it("valid JSON with UTF-8 BOM is parsed", async () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const body = Buffer.concat([bom, Buffer.from('{"topicSummaryLogId":"abc"}', "utf8")]);
    const res = await request(app)
      .post("/api/topic-summary/export")
      .set("Content-Type", "application/json")
      .send(body);
    expect(res.status).not.toBe(400);
    expect(res.body?.error).not.toBe("Invalid JSON");
  });

  it("valid JSON with UTF-16LE (PowerShell ConvertTo-Json) is parsed", async () => {
    const body = Buffer.from('{"topicSummaryLogId":"abc"}', "utf16le");
    const res = await request(app)
      .post("/api/topic-summary/export")
      .set("Content-Type", "application/json")
      .send(body);
    expect(res.status).not.toBe(400);
    expect(res.body?.error).not.toBe("Invalid JSON");
  });
});
