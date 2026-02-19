// Run Cell Biology Batch B: Cell Division & Growth — culturing microorganisms, RP growth, chromosomes, mitosis & cell cycle, stem cells.
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");

const TOPIC_SCRIPTS = [
  require("./seed_cell-biology__culturing-microorganisms"),
  require("./seed_cell-biology__rp-growth"),
  require("./seed_cell-biology__chromosomes"),
  require("./seed_cell-biology__mitosis-cell-cycle"),
  require("./seed_cell-biology__stem-cells"),
];

async function run() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }
  console.log("Seeding Cell Biology Batch B (cell division & growth)");
  await mongoose.connect(MONGO_URI);
  for (const mod of TOPIC_SCRIPTS) {
    await mod.run(mongoose);
  }
  await mongoose.disconnect();
  console.log("Cell Biology Batch B complete.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

module.exports = { run };
