// Run all Organisation topic seeds in taxonomy order (one mongoose connection).
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");

const TOPIC_SCRIPTS = [
  require("./seed_organisation__principles-of-organisation"),
  require("./seed_organisation__digestive-system"),
  require("./seed_organisation__enzymes"),
  require("./seed_organisation__rp-enzymes"),
  require("./seed_organisation__circulatory-system"),
  require("./seed_organisation__heart"),
  require("./seed_organisation__blood-vessels-blood"),
  require("./seed_organisation__coronary-heart-disease"),
  require("./seed_organisation__health-disease"),
  require("./seed_organisation__non-communicable-diseases"),
  require("./seed_organisation__cancer"),
  require("./seed_organisation__plant-cell-organisation"),
  require("./seed_organisation__transport-in-plants"),
  require("./seed_organisation__transpiration-stomata"),
  require("./seed_organisation__rp-plant-transport"),
];

async function run(mongooseConn) {
  const selfConnect = mongooseConn == null;
  if (selfConnect) {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) throw new Error("MONGO_URI not set");
    console.log("Seeding unit: Organisation");
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
  run().then(() => { console.log("Organisation unit complete."); process.exit(0); }).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { run };
