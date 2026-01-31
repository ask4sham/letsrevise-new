// backend/scripts/seedAqaBiologyVisuals.js
// Option B (Curated visuals library):
// - Creates a structured folder of placeholder SVGs for *ALL* AQA GCSE Biology topics/subtopics
// - Writes a single manifest.json you can use later to auto-attach visuals to lessons/pages
// - Safe to re-run (won't overwrite existing SVGs)

const fs = require("fs");
const path = require("path");

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/\+/g, "plus")
    .replace(/’/g, "'")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFileIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) return false;
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function makeSvg({ title, subtitle, metaLeft, metaRight }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1400" height="800" viewBox="0 0 1400 800" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1400" height="800" rx="24" fill="#F7F7FB"/>
  <rect x="60" y="60" width="1280" height="680" rx="24" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="4"/>

  <text x="110" y="160" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="700" fill="#111827">
    ${escapeXml(title)}
  </text>

  <text x="110" y="220" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="400" fill="#374151">
    ${escapeXml(subtitle)}
  </text>

  <g>
    <rect x="110" y="270" width="560" height="420" rx="20" fill="#EEF2FF" stroke="#C7D2FE" stroke-width="3"/>
    <text x="150" y="350" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#1F2937">
      Diagram placeholder
    </text>
    <text x="150" y="405" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#374151">
      Replace this SVG with an approved diagram later.
    </text>
    <text x="150" y="450" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#374151">
      Keep the same filename to avoid breaking links.
    </text>
    <text x="150" y="510" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#4B5563">
      ${escapeXml(metaLeft)}
    </text>
  </g>

  <g>
    <rect x="740" y="270" width="540" height="200" rx="20" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="3"/>
    <text x="780" y="340" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#065F46">
      Suggested use
    </text>
    <text x="780" y="395" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#064E3B">
      Hero image or key diagram for Core Concept pages.
    </text>
  </g>

  <g>
    <rect x="740" y="510" width="540" height="180" rx="20" fill="#FFF7ED" stroke="#FED7AA" stroke-width="3"/>
    <text x="780" y="580" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#9A3412">
      Context
    </text>
    <text x="780" y="635" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#7C2D12">
      ${escapeXml(metaRight)}
    </text>
  </g>
</svg>`;
}

function main() {
  const root = process.cwd();

  // Public path base (served by Express static)
  // Resulting URLs: /visuals/biology/aqa-gcse/<topic>/<section>/<subtopic>.svg
  const publicOutDir = path.join(root, "backend", "public", "visuals", "biology", "aqa-gcse");
  ensureDir(publicOutDir);

  const SUBJECT = "Biology";
  const EXAM_BOARD = "AQA";
  const LEVEL = "GCSE";

  // ✅ FULL SYLLABUS from your screenshots
  const SYLLABUS = [
    {
      topic: "Cell Biology",
      sections: [
        {
          section: "Cell Structure",
          subtopics: [
            "Eukaryotes & Prokaryotes",
            "Animal & Plant Cells",
            "Cell Specialisation",
            "Cell Differentiation",
            "Microscopy",
            "Required Practical: Microscopy",
            "Culturing Microorganisms",
            "Required Practical: Growth",
          ],
        },
        {
          section: "Cell Division",
          subtopics: ["Chromosomes", "Mitosis & the Cell Cycle", "Stem Cells"],
        },
        {
          section: "Transport in Cells",
          subtopics: [
            "Diffusion",
            "Factors that Affect Diffusion",
            "Diffusion in Multicellular Organisms",
            "Osmosis",
            "Required Practical: Osmosis",
            "Active transport",
            "Transport Summary & Applications",
          ],
        },
      ],
    },

    {
      topic: "Organisation",
      sections: [
        {
          section: "Organisation: Digestion",
          subtopics: [
            "Principles of Organisation",
            "The Stomach",
            "The Human Digestive System",
            "Enzymes & Metabolism",
            "Required Practical: Enzymes",
            "Enzymes & Digestion",
            "Required Practical: Food Tests",
          ],
        },
        {
          section: "Organisation: The Cardiovascular & Respiratory System",
          subtopics: ["The Lungs", "The Heart", "Blood Vessels & Blood"],
        },
        {
          section: "Health & Disease",
          subtopics: [
            "CID & Non-Communicable Disease",
            "Health Issues",
            "Lifestyle & Non-Communicable Diseases",
            "Data & Lifestyle Factors",
            "Cancer",
          ],
        },
        {
          section: "Plant Tissues, Organs & Systems",
          subtopics: ["Plant Tissues", "Plant Organ System", "Transpiration", "Translocation"],
        },
      ],
    },

    {
      topic: "Infection & Response",
      sections: [
        {
          section: "Communicable Diseases",
          subtopics: [
            "Communicable (Infectious) Diseases",
            "Viral Diseases",
            "Bacterial Diseases",
            "Fungal Diseases",
            "Protist Diseases",
            "Human Defence Systems",
            "Vaccination",
            "Antibiotics & Painkillers",
            "Discovery & Development of Drugs",
          ],
        },
        {
          section: "Monoclonal Antibodies",
          subtopics: ["Producing Monoclonal Antibodies", "Uses of Monoclonal Antibodies"],
        },
        {
          section: "Plant Disease",
          subtopics: ["Detection and Identification of Plant Diseases", "Plant Defence Responses"],
        },
      ],
    },

    {
      topic: "Bioenergetics",
      sections: [
        {
          section: "Photosynthesis",
          subtopics: [
            "Photosynthetic Reaction",
            "Rate of Photosynthesis",
            "Interactions of Limiting Factors",
            "Required Practical: Photosynthesis Rate",
            "Uses of Glucose from Photosynthesis",
          ],
        },
        {
          section: "Respiration",
          subtopics: ["Aerobic & Anaerobic Respiration", "Response to Exercise", "Metabolism"],
        },
      ],
    },

    {
      topic: "Homeostasis & Response",
      sections: [
        {
          section: "The Human Nervous System",
          subtopics: [
            "Structure & Function",
            "The Reflex Arc",
            "Required Practical: Reaction Time",
            "The Brain",
            "The Eye",
            "Control of Body Temperature",
          ],
        },
        {
          section: "Hormones: Maintaining Blood Homeostasis",
          subtopics: [
            "Homeostasis",
            "Human Endocrine System",
            "Control of Blood Glucose Concentration",
            "Maintaining Water & Nitrogen Balance in the Body",
          ],
        },
        {
          section: "Hormones in Humans: Reproduction & Metabolism",
          subtopics: [
            "Hormones in Human Reproduction",
            "Contraception",
            "The Uses of Hormones to Treat Infertility",
            "Negative Feedback",
          ],
        },
        {
          section: "Plant Hormones",
          subtopics: ["Plant Hormones", "Required Practical: Plant Growth", "Uses of Plant Hormones"],
        },
      ],
    },

    {
      topic: "Inheritance, Variation & Evolution",
      sections: [
        {
          section: "Reproduction",
          subtopics: [
            "Sexual & Asexual Reproduction",
            "Meiosis",
            "Advantages & Disadvantages of Sexual & Asexual Reproduction",
            "DNA & the Genome",
            "DNA Structure",
            "Genetic Inheritance",
            "Inherited Disorders",
            "Sex Determination",
          ],
        },
        {
          section: "Variation & Evolution",
          subtopics: ["Variation", "Evolution", "Selective Breeding", "Genetic Engineering", "Cloning"],
        },
        {
          section: "The Development of Understanding of Genetics & Evolution",
          subtopics: [
            "Theory of Evolution",
            "Speciation",
            "The Understanding of Genetics",
            "Evidence for Evolution",
            "Fossils",
            "Extinction",
            "Resistant Bacteria",
          ],
        },
        {
          section: "Classification of Living Organisms",
          subtopics: ["Classification"],
        },
      ],
    },

    {
      topic: "Ecology",
      sections: [
        {
          section: "Adaptations, Interdependence & Competition",
          subtopics: ["Communities", "Abiotic Factors", "Biotic Factors", "Adaptations"],
        },
        {
          section: "Organisation of an Ecosystem",
          subtopics: [
            "Levels of Organisation",
            "Required Practical: Ecosystems",
            "How Materials are Cycled",
            "Decomposition",
            "Required Practical: Decay",
            "Impact of Environmental Change",
          ],
        },
        {
          section: "Biodiversity & the Effect of Human Interaction on Ecosystems",
          subtopics: [
            "Biodiversity",
            "Waste Management",
            "Land Use",
            "Deforestation",
            "Global Warming",
            "Maintaining Biodiversity",
          ],
        },
        {
          section: "Trophic Levels in Ecosystem",
          subtopics: ["Trophic Levels", "Pyramids of Biomass", "Transfer of Biomass"],
        },
        {
          section: "Food Production",
          subtopics: ["Factors Affecting Food Security", "Farming Techniques", "Sustainable Fisheries", "Role of Biotechnology"],
        },
      ],
    },
  ];

  const manifest = {
    subject: SUBJECT,
    examBoard: EXAM_BOARD,
    level: LEVEL,
    version: 1,
    basePath: "/visuals/biology/aqa-gcse",
    generatedAt: new Date().toISOString(),
    items: [],
    counts: {
      topics: 0,
      sections: 0,
      subtopics: 0,
      createdSvgs: 0,
    },
  };

  let createdSvgs = 0;
  let sectionCount = 0;
  let subtopicCount = 0;

  for (const topicObj of SYLLABUS) {
    manifest.counts.topics += 1;

    const topicSlug = slugify(topicObj.topic);
    const topicDir = path.join(publicOutDir, topicSlug);
    ensureDir(topicDir);

    for (const sec of topicObj.sections) {
      sectionCount += 1;

      const sectionSlug = slugify(sec.section);
      const sectionDir = path.join(topicDir, sectionSlug);
      ensureDir(sectionDir);

      for (const sub of sec.subtopics) {
        subtopicCount += 1;

        const subSlug = slugify(sub);
        const filename = `${subSlug}.svg`;
        const filePath = path.join(sectionDir, filename);

        const svg = makeSvg({
          title: sub,
          subtitle: `${EXAM_BOARD} ${LEVEL} ${SUBJECT} • ${topicObj.topic} • ${sec.section}`,
          metaLeft: `Topic: ${topicObj.topic} | Section: ${sec.section}`,
          metaRight: `Curated visual (Option B). No AI images. Replace with approved diagram when ready.`,
        });

        const created = writeFileIfMissing(filePath, svg);
        if (created) createdSvgs += 1;

        const url = `${manifest.basePath}/${topicSlug}/${sectionSlug}/${filename}`;

        manifest.items.push({
          key: `aqa-gcse-biology:${topicSlug}:${sectionSlug}:${subSlug}`,
          subject: SUBJECT,
          examBoard: EXAM_BOARD,
          level: LEVEL,
          topic: topicObj.topic,
          topicSlug,
          section: sec.section,
          sectionSlug,
          subtopic: sub,
          subtopicSlug: subSlug,
          type: "diagram",
          url,
        });
      }
    }
  }

  manifest.counts.sections = sectionCount;
  manifest.counts.subtopics = subtopicCount;
  manifest.counts.createdSvgs = createdSvgs;

  const manifestPath = path.join(publicOutDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  console.log("✅ AQA GCSE Biology visuals seeded");
  console.log("   Output folder:", publicOutDir);
  console.log("   Manifest:", manifestPath);
  console.log("   Topics:", manifest.counts.topics);
  console.log("   Sections:", manifest.counts.sections);
  console.log("   Subtopics:", manifest.counts.subtopics);
  console.log("   New SVGs created:", manifest.counts.createdSvgs);
  console.log("");
  console.log("Example URL:");
  console.log(`   ${manifest.items[0]?.url || "(none)"}`);
}

main();
