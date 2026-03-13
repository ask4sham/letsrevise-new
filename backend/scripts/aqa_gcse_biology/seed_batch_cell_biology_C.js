// Run Cell Biology Batch C: Transport in cells — diffusion, factors, diffusion in multicellular, osmosis, RP osmosis, active transport, transport summary.
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");

const TOPIC_SCRIPTS = [
  require("./seed_cell-biology__transport-in-cells"),
  require("./seed_cell-biology__diffusion"),
  require("./seed_cell-biology__factors-affect-diffusion"),
  require("./seed_cell-biology__diffusion-multicellular"),
  require("./seed_cell-biology__osmosis"),
  require("./seed_cell-biology__rp-osmosis"),
  require("./seed_cell-biology__active-transport"),
  require("./seed_cell-biology__transport-summary"),
];

async function run(mongooseConn) {
  const selfConnect = mongooseConn == null;
  if (selfConnect) {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) throw new Error("MONGO_URI not set");
    console.log("Seeding Cell Biology Batch C (transport in cells)");
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
  run().then(() => { console.log("Cell Biology Batch C complete."); process.exit(0); }).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { run };
