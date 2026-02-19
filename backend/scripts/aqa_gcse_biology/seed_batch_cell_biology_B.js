// Run Cell Biology Batch B: Cell Division & Growth — culturing microorganisms, RP growth, chromosomes, mitosis & cell cycle, stem cells.
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");

const TOPIC_SCRIPTS = [
  require("./seed_cell-biology__culturing-microorganisms"),
  require("./seed_cell-biology__rp-growth"),
  require("./seed_cell-biology__cell-division"),
  require("./seed_cell-biology__chromosomes"),
  require("./seed_cell-biology__mitosis-cell-cycle"),
  require("./seed_cell-biology__stem-cells"),
];

async function run(mongooseConn) {
  const selfConnect = mongooseConn == null;
  if (selfConnect) {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) throw new Error("MONGO_URI not set");
    console.log("Seeding Cell Biology Batch B (cell division & growth)");
    await mongoose.connect(MONGO_URI);
    mongooseConn = mongoose;
  }
  const results = [];
  try {
    for (const mod of TOPIC_SCRIPTS) {
      const r = await mod.run(mongooseConn);
      results.push({ topic: (r && r.topic) || "?", skipped: !!(r && r.skipped), inserted: (r && r.inserted) || 0 });
    }
    return results;
  } finally {
    if (selfConnect) await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().then(() => { console.log("Cell Biology Batch B complete."); process.exit(0); }).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { run };
