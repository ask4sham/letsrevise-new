/**
 * Spot-check: fetch 2-3 lessons and show sample image URLs.
 * Usage: node scripts/spot-check-lessons.js
 */
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
}
const mongoose = require("mongoose");

async function run() {
  const uri = (process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
  if (!uri) {
    console.error("ERROR: MONGO_URI or MONGODB_URI required.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const Lesson = require("../models/Lesson");

  const lessons = await Lesson.find({}).limit(3).lean();

  console.log("=== Spot Check: Lesson Image URLs ===\n");

  for (const lesson of lessons) {
    console.log(`Lesson: ${lesson._id} - "${lesson.title}"`);
    const urls = [];

    if (lesson.content && lesson.content.includes("![")) {
      const matches = lesson.content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g);
      for (const m of matches) urls.push({ field: "content", url: m[1] });
    }
    if (lesson.uploadedImages?.length) {
      lesson.uploadedImages.forEach((u) => urls.push({ field: "uploadedImages", url: u }));
    }
    lesson.pages?.forEach((p, pi) => {
      if (p.hero?.src) urls.push({ field: `pages[${pi}].hero.src`, url: p.hero.src });
      p.blocks?.forEach((b, bi) => {
        if (b.imageUrl) urls.push({ field: `pages[${pi}].blocks[${bi}].imageUrl`, url: b.imageUrl });
        if (b.content && b.content.includes("![")) {
          const matches = b.content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g);
          for (const m of matches) urls.push({ field: `pages[${pi}].blocks[${bi}].content`, url: m[1] });
        }
      });
    });

    if (urls.length === 0) {
      console.log("  (no image URLs found)");
    } else {
      urls.slice(0, 5).forEach((u) => {
        const abs = u.url.startsWith("http://") || u.url.startsWith("https://");
        console.log(`  [${u.field}] ${abs ? "✓ absolute" : "✗ relative"}: ${u.url.slice(0, 80)}${u.url.length > 80 ? "..." : ""}`);
      });
      if (urls.length > 5) console.log(`  ... and ${urls.length - 5} more`);
    }
    console.log("");
  }

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
