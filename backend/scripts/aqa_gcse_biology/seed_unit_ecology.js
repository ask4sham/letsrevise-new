// Run all Ecology topic seeds in taxonomy order (one mongoose connection).
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");

const TOPIC_SCRIPTS = [
  require("./seed_ecology__levels-of-organisation"),
  require("./seed_ecology__interdependence"),
  require("./seed_ecology__biodiversity"),
  require("./seed_ecology__ecology"),
  require("./seed_ecology__rp-ecosystems"),
  require("./seed_ecology__adaptations"),
  require("./seed_ecology__impact-environmental-change"),
  require("./seed_ecology__trophic-levels"),
  require("./seed_ecology__pyramids-of-biomass"),
  require("./seed_ecology__transfer-of-biomass"),
  require("./seed_ecology__decomposition"),
  require("./seed_ecology__rp-decay"),
  require("./seed_ecology__how-materials-cycled"),
  require("./seed_ecology__land-use"),
  require("./seed_ecology__deforestation"),
  require("./seed_ecology__global-warming"),
  require("./seed_ecology__maintaining-biodiversity"),
  require("./seed_ecology__waste-management"),
  require("./seed_ecology__factors-food-security"),
  require("./seed_ecology__farming-techniques"),
  require("./seed_ecology__sustainable-fisheries"),
  require("./seed_ecology__role-biotechnology"),
];

async function run(mongooseConn) {
  const selfConnect = mongooseConn == null;
  if (selfConnect) {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) throw new Error("MONGO_URI not set");
    console.log("Seeding unit: Ecology");
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
  run().then(() => { console.log("Ecology unit complete."); process.exit(0); }).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { run };
