const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Required Practical: Microscopy";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Required Practical: Microscopy";

const MCQS = [
  { question: "What is the first step when preparing an onion cell slide?", options: ["Add stain", "Place cover slip", "Peel thin layer of epidermis", "Focus the microscope"], correctIndex: 2, marks: 1 },
  { question: "Why is a thin section of tissue used?", options: ["To allow light through", "To make it heavier", "To add colour", "To dry it"], correctIndex: 0, marks: 1 },
  { question: "Which stain is often used for onion cells?", options: ["Iodine", "Methylene blue", "Safranin", "Eosin"], correctIndex: 0, marks: 1 },
  { question: "When placing the cover slip, you should:", options: ["Drop it straight down", "Lower at an angle to avoid air bubbles", "Press down hard", "Leave a gap"], correctIndex: 1, marks: 1 },
  { question: "What is the purpose of the cover slip?", options: ["To magnify", "To flatten and protect the specimen", "To stain", "To focus"], correctIndex: 1, marks: 1 },
  { question: "Which objective lens do you start with?", options: ["Highest power", "Lowest power", "Middle power", "Any"], correctIndex: 1, marks: 1 },
  { question: "Why do we use a mounted needle when lowering the cover slip?", options: ["To pierce the specimen", "To avoid air bubbles", "To add stain", "To focus"], correctIndex: 1, marks: 1 },
  { question: "What should you do before drawing the specimen?", options: ["Add more stain", "Focus carefully and use a sharp pencil", "Remove the slide", "Increase magnification only"], correctIndex: 1, marks: 1 },
  { question: "When calculating magnification, you need:", options: ["Image size and actual size", "Only image size", "Only actual size", "Number of cells"], correctIndex: 0, marks: 1 },
  { question: "Excess stain or liquid can be removed by:", options: ["Heating", "Touching with paper towel at edge of cover slip", "Shaking", "Adding water"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Describe how to prepare a slide of onion epidermis cells.", marks: 3, markScheme: ["Peel thin layer; place on slide; add stain (e.g. iodine); lower cover slip at angle; remove excess liquid."] },
  { question: "Why is it important to use a thin piece of tissue?", marks: 1, markScheme: ["So light can pass through / single layer of cells visible."] },
  { question: "Give one reason for using a stain.", marks: 1, markScheme: ["Make structures visible / see nucleus or other parts clearly."] },
  { question: "How would you avoid air bubbles when placing the cover slip?", marks: 1, markScheme: ["Lower cover slip at an angle using a mounted needle."] },
  { question: "What equation is used to calculate magnification from image and actual size?", marks: 1, markScheme: ["Magnification = image size ÷ actual size."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
