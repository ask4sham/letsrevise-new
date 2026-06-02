require("dotenv").config();
const dns = require("dns");
const mongoose = require("mongoose");

const LESSON_ID = process.argv[2] || "6a1c7b28e2b056a760772243";
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 20000,
  });
  const lesson = await mongoose.connection.db
    .collection("lessons")
    .findOne({ _id: new mongoose.Types.ObjectId(LESSON_ID) });
  console.log("title:", lesson?.title);
  for (const p of lesson?.pages || []) {
    (p.blocks || []).forEach((b, i) => {
      if (b.type !== "dragDropMatch") return;
      const prompts = (b.pairs || []).map((x) => x.prompt);
      if (!prompts.some((x) => /sensory/i.test(String(x)))) return;
      console.log(
        JSON.stringify(
          {
            pageId: p.pageId,
            blockIndex: i,
            matchMode: b.matchMode,
            dragDropLayout: b.dragDropLayout,
            imageUrl: b.imageUrl,
            dropZones: (b.dropZones || []).length,
            pairs: (b.pairs || []).map((x) => ({
              prompt: x.prompt,
              answer: x.answer,
            })),
          },
          null,
          2
        )
      );
    });
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
