// backend/scripts/seedPhotosynthesisVisual.js
require("dotenv").config();
const mongoose = require("mongoose");
const VisualModel = require("../models/VisualModel");

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Mongo connected");

  // Remove existing photosynthesis visual (safe for MVP)
  await VisualModel.deleteMany({ conceptKey: "photosynthesis" });

  const visual = await VisualModel.create({
    conceptKey: "photosynthesis",
    subject: "Biology",
    topic: "Photosynthesis",
    variants: [
      {
        level: "KS3",
        type: "staticDiagram",
        src: "/visuals/photosynthesis/ks3.svg",
        labels: [
          "Sunlight",
          "Leaf",
          "Carbon dioxide",
          "Water",
          "Glucose",
          "Oxygen",
        ],
        narration:
          "Plants use sunlight to make food. This process is called photosynthesis.",
      },
      {
        level: "GCSE",
        type: "stepAnimation",
        src: "/visuals/photosynthesis/gcse-steps.json",
        steps: [
          {
            title: "Light absorption",
            description: "Chlorophyll in chloroplasts absorbs light energy.",
          },
          {
            title: "Chemical conversion",
            description:
              "Carbon dioxide and water are converted into glucose.",
          },
          {
            title: "Oxygen release",
            description: "Oxygen is released as a waste product.",
          },
        ],
        labels: [
          "Chloroplast",
          "Chlorophyll",
          "Carbon dioxide",
          "Water",
          "Glucose",
          "Oxygen",
        ],
        hiddenLabels: ["ATP", "NADPH"],
        narration:
          "Photosynthesis converts light energy into chemical energy stored in glucose.",
      },
      {
        level: "A-Level",
        type: "interactive",
        src: "/visuals/photosynthesis/alevel-interactive.json",
        steps: [
          {
            title: "Light-dependent reactions",
            description:
              "Occur in the thylakoid membranes producing ATP and reduced NADP.",
          },
          {
            title: "Calvin cycle",
            description:
              "Carbon fixation occurs in the stroma using ATP and reduced NADP.",
          },
        ],
        labels: [
          "Thylakoid",
          "Photosystem II",
          "Photosystem I",
          "ATP synthase",
          "RuBisCO",
          "GP",
          "TP",
        ],
        hiddenLabels: ["Photolysis", "Chemiosmosis"],
        narration:
          "Photosynthesis involves light-dependent reactions and the Calvin cycle.",
      },
    ],
  });

  console.log("🌱 Seeded Photosynthesis VisualModel:", visual._id);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
