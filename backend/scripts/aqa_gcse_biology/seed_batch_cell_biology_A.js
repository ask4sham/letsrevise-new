// Run Cell Biology Batch A only (topics 3–6): Animal & Plant Cells, Cell Specialisation, Cell Differentiation, Microscopy.
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");

const TOPIC_SCRIPTS = [
  require("./seed_cell-biology__animal-plant-cells"),
  require("./seed_cell-biology__cell-specialisation"),
  require("./seed_cell-biology__cell-differentiation"),
  require("./seed_cell-biology__microscopy"),
];

async function run() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }
  console.log("Seeding Cell Biology Batch A (topics 3–6)");
  await mongoose.connect(MONGO_URI);
  for (const mod of TOPIC_SCRIPTS) {
    await mod.run(mongoose);
  }
  await mongoose.disconnect();
  console.log("Batch A complete.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

module.exports = { run };
