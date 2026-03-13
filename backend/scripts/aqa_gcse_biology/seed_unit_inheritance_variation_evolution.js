// Run all Inheritance, Variation and Evolution topic seeds in taxonomy order (one mongoose connection).
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");

const TOPIC_SCRIPTS = [
  require("./seed_inheritance-variation-evolution__sexual-asexual-reproduction"),
  require("./seed_inheritance-variation-evolution__meiosis"),
  require("./seed_inheritance-variation-evolution__dna-genome"),
  require("./seed_inheritance-variation-evolution__genetic-inheritance"),
  require("./seed_inheritance-variation-evolution__inherited-disorders"),
  require("./seed_inheritance-variation-evolution__variation"),
  require("./seed_inheritance-variation-evolution__evolution"),
  require("./seed_inheritance-variation-evolution__evidence-evolution"),
  require("./seed_inheritance-variation-evolution__fossils"),
  require("./seed_inheritance-variation-evolution__extinction"),
  require("./seed_inheritance-variation-evolution__resistant-bacteria"),
  require("./seed_inheritance-variation-evolution__classification"),
  require("./seed_inheritance-variation-evolution__understanding-genetics"),
  require("./seed_inheritance-variation-evolution__speciation"),
];

async function run(mongooseConn) {
  const selfConnect = mongooseConn == null;
  if (selfConnect) {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) throw new Error("MONGO_URI not set");
    console.log("Seeding unit: Inheritance, Variation and Evolution");
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
  run().then(() => { console.log("Inheritance, Variation and Evolution unit complete."); process.exit(0); }).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { run };
