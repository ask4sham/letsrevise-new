const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Inheritance, Variation and Evolution";
const TOPIC_NAME = "Understanding of genetics";
const UNIT_KEY = "inheritance-variation-evolution";
const TOPIC_LABEL = "Understanding of genetics";

const MCQS = [
  { question: "Genetic diagrams (e.g. Punnett squares) are used to:", options: ["Only describe phenotype", "Predict probability of offspring genotypes and phenotypes", "Only for plants", "Only for one gene"], correctIndex: 1, marks: 1 },
  { question: "Monohybrid inheritance involves:", options: ["Many genes", "One gene (e.g. one characteristic)", "Only recessive", "Only dominant"], correctIndex: 1, marks: 1 },
  { question: "The ratio 1:2:1 in offspring (e.g. AA:Aa:aa) suggests:", options: ["Only dominant", "Two heterozygous parents; one gene", "Only recessive", "Only one parent"], correctIndex: 1, marks: 1 },
  { question: "Codominance is when:", options: ["Only one allele is expressed", "Both alleles are expressed (e.g. blood group AB)", "Only in plants", "Only recessive"], correctIndex: 1, marks: 1 },
  { question: "Sex-linked characteristics are on:", options: ["Any chromosome", "X (or Y) chromosome", "Only autosomes", "Only in females"], correctIndex: 1, marks: 1 },
  { question: "Males are more likely to show a recessive X-linked disorder because:", options: ["They have two X chromosomes", "They have one X; no second allele to mask recessive", "Only in females", "Only in embryos"], correctIndex: 1, marks: 1 },
  { question: "Family trees (pedigree charts) can show:", options: ["Only phenotype", "Pattern of inheritance; carriers; probability", "Only one generation", "Only dominant"], correctIndex: 1, marks: 1 },
  { question: "Probability in genetics is often given as:", options: ["Only 100%", "Fraction or percentage (e.g. 1/4, 25%)", "Only 0", "Only 1"], correctIndex: 1, marks: 1 },
  { question: "Multiple alleles exist when:", options: ["Only two alleles", "More than two alleles for a gene (e.g. blood group)", "Only one allele", "Only in plants"], correctIndex: 1, marks: 1 },
  { question: "Understanding genetics helps in:", options: ["Only breeding", "Predicting disorders; genetic counselling; breeding; medicine", "Only fossils", "Only classification"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "How can a genetic diagram be used to predict offspring?", marks: 2, markScheme: ["Show parental genotypes; possible gametes; Punnett square or cross; give ratios/probabilities of genotypes and phenotypes."] },
  { question: "What is codominance? Give an example.", marks: 2, markScheme: ["Both alleles expressed in phenotype. E.g. blood group AB; both A and B antigens."] },
  { question: "Why are some disorders more common in males?", marks: 1, markScheme: ["Sex-linked (on X chromosome); males have one X so recessive allele always expressed if present."] },
  { question: "What is monohybrid inheritance?", marks: 1, markScheme: ["Inheritance of one gene; two alleles; can use genetic cross to predict offspring."] },
  { question: "How can pedigree charts be useful?", marks: 1, markScheme: ["Show pattern of inheritance in family; identify carriers; predict probability of disorder."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
