// Run all Cell Biology topic seeds in taxonomy order (one mongoose connection).
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");

const TOPIC_SCRIPTS = [
  require("./seed_cell-biology__cell-structure"),
  require("./seed_cell-biology__animal-plant-cells"),
  require("./seed_cell-biology__eukaryotes-prokaryotes"),
  require("./seed_cell-biology__cell-specialisation"),
  require("./seed_cell-biology__cell-differentiation"),
  require("./seed_cell-biology__microscopy"),
  require("./seed_cell-biology__rp-microscopy"),
  require("./seed_cell-biology__cell-division"),
  require("./seed_cell-biology__chromosomes"),
  require("./seed_cell-biology__mitosis-cell-cycle"),
  require("./seed_cell-biology__stem-cells"),
  require("./seed_cell-biology__transport-in-cells"),
  require("./seed_cell-biology__diffusion"),
  require("./seed_cell-biology__factors-affect-diffusion"),
  require("./seed_cell-biology__osmosis"),
  require("./seed_cell-biology__rp-osmosis"),
  require("./seed_cell-biology__active-transport"),
  require("./seed_cell-biology__diffusion-multicellular"),
  require("./seed_cell-biology__transport-summary"),
  require("./seed_cell-biology__culturing-microorganisms"),
  require("./seed_cell-biology__rp-growth"),
];

async function run() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }
  console.log("Seeding unit: Cell Biology");
  await mongoose.connect(MONGO_URI);
  for (const mod of TOPIC_SCRIPTS) {
    await mod.run(mongoose);
  }
  await mongoose.disconnect();
  console.log("Cell Biology unit complete.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

module.exports = { run };
