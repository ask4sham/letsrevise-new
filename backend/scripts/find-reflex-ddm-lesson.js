require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const lessons = await db
    .collection("lessons")
    .find({
      "pages.blocks": {
        $elemMatch: {
          type: "dragDropMatch",
          $or: [
            { imageUrl: /Newrvious|Nervious|nervous.response|reflex|drag-drop-portrait/i },
            { matchMode: /textToImage|text-to-image/i },
            { "pairs.prompt": /Sensory neurone/i },
          ],
        },
      },
    })
    .limit(20)
    .toArray();

  for (const L of lessons) {
    for (const p of L.pages || []) {
      (p.blocks || []).forEach((b, i) => {
        if (b.type !== "dragDropMatch") return;
        const img = String(b.imageUrl || "");
        const mm = b.matchMode || b.dragDropLayout || "";
        const prompts = (b.pairs || []).map((x) => x.prompt).join("|");
        if (
          /Sensory|Relay|Motor|Effector|Newrvious|Nervious|textToImage|text-to-image/i.test(
            img + mm + prompts
          )
        ) {
          console.log(
            JSON.stringify({
              id: String(L._id),
              title: L.title,
              pageId: p.pageId,
              blockIndex: i,
              imageUrl: img,
              matchMode: mm,
              prompts: (b.pairs || []).map((x) => x.prompt),
            })
          );
        }
      });
    }
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
