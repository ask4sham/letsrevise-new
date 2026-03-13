// Run all Infection and Response topic seeds in taxonomy order (one mongoose connection).
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");

const TOPIC_SCRIPTS = [
  require("./seed_infection-and-response__communicable-disease"),
  require("./seed_infection-and-response__viral-diseases"),
  require("./seed_infection-and-response__bacterial-diseases"),
  require("./seed_infection-and-response__fungal-protist-diseases"),
  require("./seed_infection-and-response__human-defence-systems"),
  require("./seed_infection-and-response__vaccination"),
  require("./seed_infection-and-response__antibiotics-painkillers"),
  require("./seed_infection-and-response__drug-development"),
  require("./seed_infection-and-response__monoclonal-antibodies"),
  require("./seed_infection-and-response__rp-microbiology"),
  require("./seed_infection-and-response__plant-disease"),
];

async function run(mongooseConn) {
  const selfConnect = mongooseConn == null;
  if (selfConnect) {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) throw new Error("MONGO_URI not set");
    console.log("Seeding unit: Infection and Response");
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
  run().then(() => { console.log("Infection and Response unit complete."); process.exit(0); }).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { run };
