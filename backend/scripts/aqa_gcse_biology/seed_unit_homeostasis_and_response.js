// Run all Homeostasis and Response topic seeds in taxonomy order (one mongoose connection).
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");

const TOPIC_SCRIPTS = [
  require("./seed_homeostasis-and-response__homeostasis"),
  require("./seed_homeostasis-and-response__nervous-system"),
  require("./seed_homeostasis-and-response__nervous-system-structure"),
  require("./seed_homeostasis-and-response__reflex-arc"),
  require("./seed_homeostasis-and-response__rp-reaction-time"),
  require("./seed_homeostasis-and-response__the-brain"),
  require("./seed_homeostasis-and-response__the-eye"),
  require("./seed_homeostasis-and-response__control-body-temperature"),
  require("./seed_homeostasis-and-response__human-endocrine-system"),
  require("./seed_homeostasis-and-response__control-blood-glucose"),
  require("./seed_homeostasis-and-response__diabetes"),
  require("./seed_homeostasis-and-response__water-nitrogen-balance"),
  require("./seed_homeostasis-and-response__hormones-human-reproduction"),
  require("./seed_homeostasis-and-response__contraception"),
  require("./seed_homeostasis-and-response__hormones-treat-infertility"),
  require("./seed_homeostasis-and-response__plant-hormones"),
  require("./seed_homeostasis-and-response__uses-plant-hormones"),
  require("./seed_homeostasis-and-response__rp-plant-growth"),
  require("./seed_homeostasis-and-response__negative-feedback"),
];

async function run(mongooseConn) {
  const selfConnect = mongooseConn == null;
  if (selfConnect) {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) throw new Error("MONGO_URI not set");
    console.log("Seeding unit: Homeostasis and Response");
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
  run().then(() => { console.log("Homeostasis and Response unit complete."); process.exit(0); }).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { run };
