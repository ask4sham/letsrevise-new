const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Microscopy";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Microscopy";

const MCQS = [
  { question: "What is the formula for magnification?", options: ["Image size × object size", "Image size ÷ object size", "Object size ÷ image size", "Image size + object size"], correctIndex: 1, marks: 1 },
  { question: "Which type of microscope has higher resolution?", options: ["Light microscope", "Electron microscope", "Both the same", "Neither"], correctIndex: 1, marks: 1 },
  { question: "What is resolution?", options: ["How large an image is", "Ability to distinguish two close points", "How much a microscope magnifies", "The number of lenses"], correctIndex: 1, marks: 1 },
  { question: "Which unit is used for cell sizes?", options: ["Metres", "Kilometres", "Micrometres (μm)", "Millimetres only"], correctIndex: 2, marks: 1 },
  { question: "How do you calculate total magnification in a light microscope?", options: ["Eyepiece + objective", "Eyepiece × objective", "Eyepiece ÷ objective", "Objective only"], correctIndex: 1, marks: 1 },
  { question: "Why are specimens stained before viewing?", options: ["To kill them", "To make structures visible", "To shrink them", "To magnify them"], correctIndex: 1, marks: 1 },
  { question: "What is 1 mm in micrometres?", options: ["10 μm", "100 μm", "1000 μm", "10000 μm"], correctIndex: 2, marks: 1 },
  { question: "Electron microscopes use:", options: ["Light", "Electron beams", "Sound", "X-rays"], correctIndex: 1, marks: 1 },
  { question: "Which part of the microscope is turned to focus the specimen?", options: ["Stage", "Objective lens", "Fine focus wheel", "Mirror"], correctIndex: 2, marks: 1 },
  { question: "What is the typical maximum magnification of a light microscope?", options: ["×40", "×400", "×4000", "×40 000"], correctIndex: 2, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "State the equation linking magnification, image size and actual size.", marks: 1, markScheme: ["Magnification = image size ÷ actual size."] },
  { question: "Give one advantage of an electron microscope over a light microscope.", marks: 2, markScheme: ["Higher resolution; higher magnification; see smaller structures."] },
  { question: "Convert 0.5 mm into micrometres.", marks: 1, markScheme: ["500 μm."] },
  { question: "Why might a biologist use a stain when preparing a slide?", marks: 1, markScheme: ["To make cells or structures visible / easier to see."] },
  { question: "What is meant by resolution?", marks: 1, markScheme: ["Ability to distinguish two separate points / see detail clearly."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
