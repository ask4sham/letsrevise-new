/**
 * Real-image regression: createLessonPngDisplayBuffer via sharp (not mocked).
 * Fixture is copyright-safe repo test data under tests/fixtures.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const {
  createLessonPngDisplayBuffer,
  LESSON_PNG_DISPLAY_SIZE,
} = require("../services/lessonPngDisplay");

const FIXTURE = path.join(__dirname, "fixtures", "revision-pack-diagram.png");

describe("createLessonPngDisplayBuffer (real sharp)", () => {
  test("normalises fixture PNG to 600×600 RGBA display buffer", async () => {
    expect(fs.existsSync(FIXTURE)).toBe(true);
    const input = fs.readFileSync(FIXTURE);
    expect(Buffer.isBuffer(input)).toBe(true);
    expect(input.length).toBeGreaterThan(0);

    const out = await createLessonPngDisplayBuffer(input);
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out.length).toBeGreaterThan(0);

    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(LESSON_PNG_DISPLAY_SIZE);
    expect(meta.height).toBe(LESSON_PNG_DISPLAY_SIZE);
    expect(meta.channels).toBe(4);
    expect(meta.hasAlpha).toBe(true);

    const redecoded = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    expect(redecoded.data.length).toBeGreaterThan(0);
    expect(redecoded.info.width).toBe(LESSON_PNG_DISPLAY_SIZE);
    expect(redecoded.info.height).toBe(LESSON_PNG_DISPLAY_SIZE);
  });

  test("synthetic RGBA uses contain + north pad; deterministic decoded pixels", async () => {
    const w = 120;
    const h = 80;
    const raw = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        raw[i] = 255;
        raw[i + 1] = 0;
        raw[i + 2] = 0;
        raw[i + 3] = x < 60 ? 255 : 0;
      }
    }
    const input = await sharp(raw, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();

    const out1 = await createLessonPngDisplayBuffer(input);
    const out2 = await createLessonPngDisplayBuffer(input);
    expect(out1).toBeInstanceOf(Buffer);
    expect(out1.length).toBeGreaterThan(0);

    const meta = await sharp(out1).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(600);
    expect(meta.height).toBe(600);
    expect(meta.channels).toBe(4);
    expect(meta.hasAlpha).toBe(true);

    const { data, info } = await sharp(out1).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(600);
    expect(info.height).toBe(600);
    expect(info.channels).toBe(4);

    // contain 120×80 into 600 → scale 5 → content 600×400 at north; padding below is alpha 0
    const at = (x, y) => {
      const i = (y * info.width + x) * info.channels;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    };
    expect(at(100, 10)[0]).toBeGreaterThan(200);
    expect(at(100, 10)[3]).toBe(255);
    expect(at(300, 500)).toEqual([0, 0, 0, 0]);
    expect(at(10, 590)).toEqual([0, 0, 0, 0]);
    expect(at(500, 10)[3]).toBe(0);

    const raw1 = await sharp(out1).ensureAlpha().raw().toBuffer();
    const raw2 = await sharp(out2).ensureAlpha().raw().toBuffer();
    expect(Buffer.compare(raw1, raw2)).toBe(0);
  });
});
