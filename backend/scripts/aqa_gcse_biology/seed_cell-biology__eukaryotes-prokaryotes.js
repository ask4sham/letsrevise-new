// Cell Biology → Eukaryotes and prokaryotes (15 questions)
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Eukaryotes and prokaryotes";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Eukaryotes & Prokaryotes";

const MCQS = [
  { question: "Which statement best describes a prokaryotic cell?", options: ["It contains a nucleus.", "It contains mitochondria.", "It has genetic material but no nucleus.", "It has chloroplasts."], correctIndex: 2, marks: 1 },
  { question: "Which structure is found in eukaryotic cells but not in prokaryotic cells?", options: ["Cell membrane", "Cytoplasm", "Nucleus", "Ribosomes"], correctIndex: 2, marks: 1 },
  { question: "Which of the following is an example of a prokaryote?", options: ["Yeast", "Bacterium", "Amoeba", "Plant cell"], correctIndex: 1, marks: 1 },
  { question: "In prokaryotic cells, genetic material is found:", options: ["In the nucleus", "Free in the cytoplasm", "Inside mitochondria", "Inside chloroplasts"], correctIndex: 1, marks: 1 },
  { question: "Which feature is common to both prokaryotic and eukaryotic cells?", options: ["Nucleus", "Mitochondria", "Ribosomes", "Chloroplasts"], correctIndex: 2, marks: 1 },
  { question: "What is the typical size comparison between prokaryotic and eukaryotic cells?", options: ["Prokaryotic cells are usually larger.", "Prokaryotic cells are usually smaller.", "They are always the same size.", "Eukaryotic cells are always smaller."], correctIndex: 1, marks: 1 },
  { question: "Which structure produces ATP in many eukaryotic cells?", options: ["Ribosomes", "Mitochondria", "Nucleus", "Cell membrane"], correctIndex: 1, marks: 1 },
  { question: "Which statement about bacterial cells is correct?", options: ["They contain a nucleus.", "They are eukaryotic.", "They are prokaryotic.", "They always contain chloroplasts."], correctIndex: 2, marks: 1 },
  { question: "What is a plasmid?", options: ["A type of mitochondrion", "A small circular piece of DNA in bacteria", "A membrane surrounding the nucleus", "A structure used for photosynthesis"], correctIndex: 1, marks: 1 },
  { question: "Which feature is most likely found in a plant cell but not in a bacterial cell?", options: ["Cell membrane", "Ribosomes", "Nucleus", "Cytoplasm"], correctIndex: 2, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "State one difference between prokaryotic and eukaryotic cells.", marks: 1, markScheme: ["Eukaryotes have a nucleus / prokaryotes do not; eukaryotes have membrane-bound organelles; prokaryotes are smaller."] },
  { question: "Explain what is meant by a prokaryotic cell.", marks: 2, markScheme: ["Cell with genetic material not enclosed in a nucleus (1). DNA free in the cytoplasm (1)."] },
  { question: "Give two structures found in both prokaryotic and eukaryotic cells.", marks: 2, markScheme: ["Any two: cell membrane, cytoplasm, ribosomes, DNA/genetic material."] },
  { question: "What is the function of ribosomes?", marks: 1, markScheme: ["Protein synthesis / site where proteins are made."] },
  { question: "Describe what a plasmid is.", marks: 2, markScheme: ["Small circular piece of DNA (1) in bacterial/prokaryotic cells (1); can carry extra genes."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, {
    unitName: UNIT_NAME,
    topicName: TOPIC_NAME,
    unitKey: UNIT_KEY,
    topicLabel: TOPIC_LABEL,
    mcqs: MCQS,
    shortAnswer: SHORT_ANSWER,
  });
}

if (require.main === module) {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }
  mongoose.connect(MONGO_URI).then(async () => {
    await run(mongoose);
    await mongoose.disconnect();
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run, MCQS, SHORT_ANSWER };
