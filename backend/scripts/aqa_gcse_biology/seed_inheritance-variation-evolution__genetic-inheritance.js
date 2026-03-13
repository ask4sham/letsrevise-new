const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Inheritance, Variation and Evolution";
const TOPIC_NAME = "Genetic inheritance";
const UNIT_KEY = "inheritance-variation-evolution";
const TOPIC_LABEL = "Genetic inheritance";

const MCQS = [
  { question: "An allele is:", options: ["A whole chromosome", "A version of a gene", "Only dominant", "Only recessive"], correctIndex: 1, marks: 1 },
  { question: "If an allele is dominant, it is expressed when:", options: ["Only when two copies", "When one or two copies are present", "Only in males", "Only in females"], correctIndex: 1, marks: 1 },
  { question: "A recessive allele is only expressed when:", options: ["One copy is present", "Two copies are present (homozygous recessive)", "It is dominant", "Only in gametes"], correctIndex: 1, marks: 1 },
  { question: "Genotype means:", options: ["The visible characteristic", "The combination of alleles (e.g. Bb)", "Only the phenotype", "Only dominant genes"], correctIndex: 1, marks: 1 },
  { question: "Phenotype means:", options: ["Only the genes", "The observable characteristic", "Only genotype", "Only recessive"], correctIndex: 1, marks: 1 },
  { question: "Homozygous means:", options: ["Two different alleles", "Two identical alleles (e.g. BB or bb)", "Only one allele", "Only in gametes"], correctIndex: 1, marks: 1 },
  { question: "Heterozygous means:", options: ["Two identical alleles", "Two different alleles (e.g. Bb)", "Only dominant", "Only recessive"], correctIndex: 1, marks: 1 },
  { question: "In a genetic cross, the ratio 3:1 in the offspring suggests:", options: ["Only recessive", "One dominant and one recessive parent; dominant expressed in 3:1", "Only dominant", "No inheritance"], correctIndex: 1, marks: 1 },
  { question: "Sex in humans is determined by:", options: ["Only the mother", "X and Y chromosomes; XY = male, XX = female", "Only the father", "Only one chromosome"], correctIndex: 1, marks: 1 },
  { question: "A Punnett square is used to:", options: ["Measure height", "Predict the probability of offspring genotypes/phenotypes", "Only show phenotype", "Only in plants"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is the difference between genotype and phenotype?", marks: 2, markScheme: ["Genotype: combination of alleles (e.g. Bb). Phenotype: observable characteristic (e.g. brown eyes)."] },
  { question: "What is a dominant allele?", marks: 1, markScheme: ["Allele that is expressed when one or two copies are present."] },
  { question: "When is a recessive allele expressed?", marks: 1, markScheme: ["Only when two copies are present (homozygous recessive)."] },
  { question: "Explain what homozygous and heterozygous mean.", marks: 2, markScheme: ["Homozygous: two identical alleles (e.g. BB). Heterozygous: two different alleles (e.g. Bb)."] },
  { question: "How is sex determined in humans?", marks: 1, markScheme: ["XX = female, XY = male; Y chromosome from father determines male."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
