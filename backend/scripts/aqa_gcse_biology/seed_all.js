// Run all unit seeders (full syllabus). Exports run(mongoose) for API; run() for CLI.
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");

const UNITS = [
  require("./seed_unit_cell_biology"),
  require("./seed_unit_organisation"),
  require("./seed_unit_infection_and_response"),
  require("./seed_unit_bioenergetics"),
  require("./seed_unit_homeostasis_and_response"),
  require("./seed_unit_inheritance_variation_evolution"),
  require("./seed_unit_ecology"),
];

async function run(mongooseConn) {
  const selfConnect = mongooseConn == null;
  if (selfConnect) {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) throw new Error("MONGO_URI not set");
    console.log("=== AQA GCSE Biology seed (all units) ===\n");
    await mongoose.connect(MONGO_URI);
    mongooseConn = mongoose;
  }
  const results = [];
  try {
    for (const unit of UNITS) {
      const unitResults = await unit.run(mongooseConn);
      if (Array.isArray(unitResults)) results.push(...unitResults);
    }
    return results;
  } finally {
    if (selfConnect) await mongoose.disconnect();
  }
}

if (require.main === module) {
  run()
    .then(() => {
      console.log("\n=== All units complete ===\n");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { run };
