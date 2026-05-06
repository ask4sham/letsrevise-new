import { OFFICIAL_AQA_TRILOGY_SOURCE_NOTE } from "./schema.js";

/**
 * AQA GCSE Combined Science: Trilogy — starter topic rows (concise, specification-aligned summaries).
 * Not verbatim AQA text; teachers must confirm against the live 8464 specification.
 *
 * @param {Omit<import("./schema.js").SpecTopicEntry, "board" | "subject" | "keyStage" | "qualification" | "qualificationType" | "sourceNote"> & { route: import("./schema.js").SpecRoute }} partial
 */
function trilogyRow(partial) {
  const {
    id,
    route,
    topic,
    specCode,
    title,
    requiredContent,
    requiredSkills,
    requiredPracticals,
    commonMisconceptions,
    examCommandWords,
    linkedTopics,
    tier = "both",
    contentFlags = {},
  } = partial;

  return {
    id,
    board: "AQA",
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    qualification: "GCSE Combined Science: Trilogy",
    qualificationType: "combined-science",
    tier,
    route,
    topic,
    specCode,
    title,
    requiredContent,
    requiredSkills: requiredSkills ?? [],
    requiredPracticals: requiredPracticals ?? [],
    commonMisconceptions: commonMisconceptions ?? [],
    examCommandWords: examCommandWords ?? [],
    linkedTopics: linkedTopics ?? [],
    contentFlags,
    sourceNote: OFFICIAL_AQA_TRILOGY_SOURCE_NOTE,
  };
}

/** @type {import("./schema.js").SpecTopicEntry[]} */
export const aqaCombinedScienceTrilogySpecEntries = [
  trilogyRow({
    id: "aqa-trilogy-bio-cell-structure",
    route: "biology",
    topic: "Cell structure",
    specCode: "8464 — Biology — Cell structure (Trilogy)",
    title: "Cell structure — Trilogy",
    requiredContent: [
      "Eukaryotes have a nucleus enclosing DNA; typical animal cells include membrane, cytoplasm, nucleus, mitochondria, ribosomes.",
      "Plant cells often add chloroplasts, a large vacuole, and a cellulose cell wall; algal cells fit this pattern where relevant.",
      "Prokaryotes (e.g. bacteria) are simpler: no nucleus; DNA often a loop; may have plasmids; cell wall present.",
      "Relate major structures to function: membrane control, mitochondrial respiration, chloroplasts for photosynthesis in suitable cells.",
      "Compare order of magnitude of cell sizes using prefixes (milli, micro, nano) in qualitative and simple calculation contexts.",
    ],
    requiredSkills: [
      "Label and interpret cell diagrams; compare plant, animal, and bacterial cells.",
      "Use relative magnifications and estimation of cell size (working scientifically / maths skills).",
    ],
    requiredPracticals: [
      "Use of light microscope to observe cells; produce biological drawings with scale where appropriate (Trilogy practical expectations).",
    ],
    commonMisconceptions: [
      "Assuming all cells have chloroplasts or a cell wall.",
      "Confusing bacterial DNA organisation with a eukaryotic nucleus.",
    ],
    examCommandWords: ["describe", "compare", "explain"],
    linkedTopics: [
      "Microscopy",
      "Cell differentiation",
      "Plant cell organisation",
      "Transport in plants",
    ],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-cell-differentiation",
    route: "biology",
    topic: "Cell differentiation",
    specCode: "8464 — Biology — Cell differentiation (Trilogy)",
    title: "Cell differentiation — Trilogy",
    requiredContent: [
      "Most multicellular organisms start as a small number of cells that divide and then differentiate into specialised types.",
      "Differentiation produces cells with structures suited to their role; many animal cells lose flexibility early in development.",
      "Plants retain meristems allowing continued growth and differentiation in mature organisms.",
      "Stem cells can divide and differentiate along limited (adult) or broader (embryonic) pathways — case studies as per specification.",
    ],
    requiredSkills: [
      "Use examples to explain why differentiation matters for tissues and organs.",
      "Interpret simple contexts involving stem-cell use in medicine (ethical and technical overview only where specified).",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Thinking all cells in an organism keep dividing at the same rate through life.",
      "Equating differentiation only with growth without linking to specialisation.",
    ],
    examCommandWords: ["explain", "describe", "evaluate"],
    linkedTopics: ["Cell structure", "Plant cell organisation", "Inheritance"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-microscopy",
    route: "biology",
    topic: "Microscopy",
    specCode: "8464 — Biology — Microscopy (Trilogy)",
    title: "Microscopy — Trilogy",
    requiredContent: [
      "Light microscopes use visible light; electron microscopes use beams of electrons for much higher resolution in specialist imaging.",
      "Magnification links image size to real object size; use appropriate units and prefixes.",
      "Resolution limits how close two points can be distinguished; Trilogy expects qualitative comparison of light vs electron capability.",
    ],
    requiredSkills: [
      "Calculate magnification from image and real size; express answers using standard form where appropriate.",
    ],
    requiredPracticals: [
      "Observation and drawing of specimens at a range of magnifications (links to cell-structure practical).",
    ],
    commonMisconceptions: [
      "Treating magnification and resolution as the same idea.",
    ],
    examCommandWords: ["calculate", "compare", "explain"],
    linkedTopics: ["Cell structure"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-plant-organisation",
    route: "biology",
    topic: "Plant cell organisation",
    specCode: "8464 — Biology — Plant tissues (Trilogy)",
    title: "Plant cell organisation — Trilogy",
    requiredContent: [
      "Plants have tissues: epidermis, palisade and spongy mesophyll, xylem and phloem, with meristems at growing tips.",
      "The leaf acts as an organ: link epidermis, stomata, mesophyll, and vascular tissues to photosynthesis and gas exchange.",
      "Relate palisade structure to light capture and spongy layer to diffusion pathways.",
    ],
    requiredSkills: [
      "Interpret transverse leaf sections and link structure to function.",
    ],
    requiredPracticals: [
      "Observation/drawing of leaf structure where required in centre materials.",
    ],
    commonMisconceptions: [
      "Assuming xylem and phloem carry the same materials in the same direction.",
    ],
    examCommandWords: ["explain", "describe"],
    linkedTopics: ["Transport in plants", "Photosynthesis", "Cell structure"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-transport-plants",
    route: "biology",
    topic: "Transport in plants",
    specCode: "8464 — Biology — Transport in plants (Trilogy)",
    title: "Transport in plants — Trilogy",
    requiredContent: [
      "Water and ions enter via root hairs; transpiration stream through xylem driven by evaporation at leaves.",
      "Translocation moves sugars (e.g. sucrose) in phloem from sources to sinks.",
      "Stomata and guard cells regulate water loss and gas exchange; link to rate of transpiration and environmental factors.",
    ],
    requiredSkills: [
      "Interpret simple models of transpiration and translocation; use data on water uptake or mass change.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Thinking phloem only moves water upward like xylem.",
    ],
    examCommandWords: ["explain", "describe", "suggest"],
    linkedTopics: ["Plant cell organisation", "Photosynthesis", "Ecology"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-communicable",
    route: "biology",
    topic: "Communicable diseases",
    specCode: "8464 — Biology — Communicable diseases (Trilogy)",
    title: "Communicable diseases — Trilogy",
    requiredContent: [
      "Pathogens (including bacteria, viruses, protists, fungi) can cause communicable disease; transmission routes vary (direct, vectors, water, food).",
      "Outbreaks can be tracked using epidemiological patterns; public-health measures reduce spread.",
      "Link lifestyle, vaccination, and hygiene to risk reduction at GCSE level.",
    ],
    requiredSkills: [
      "Use data on incidence or risk factors to support simple conclusions.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Assuming all infections are viral or all bacterial infections need antibiotics.",
    ],
    examCommandWords: ["describe", "explain", "evaluate"],
    linkedTopics: [
      "Bacterial diseases",
      "Viral diseases",
      "Fungal diseases",
      "Protist diseases",
      "Human defence systems",
      "Vaccination",
    ],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-bacterial-diseases",
    route: "biology",
    topic: "Bacterial diseases",
    specCode: "8464 — Biology — Bacterial diseases (Trilogy)",
    title: "Bacterial diseases — Trilogy",
    requiredContent: [
      "Bacteria as cellular pathogens; examples such as salmonella food poisoning or gonorrhoea as in specification (Trilogy breadth).",
      "Transmission by droplets, contact, food, or sexual contact depending on the disease context.",
      "Antibiotics target bacteria but not viruses; resistance arises through selection of less-susceptible strains (overview).",
      "Prevention: hygiene, safe food handling, screening, and targeted treatment where appropriate.",
    ],
    requiredSkills: [
      "Explain prevention and treatment differences between bacterial and viral illness.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Using antibiotics for viral infections.",
      "Believing all bacteria are pathogens.",
    ],
    examCommandWords: ["explain", "describe", "suggest"],
    linkedTopics: [
      "Communicable diseases",
      "Antibiotics and painkillers",
      "Human defence systems",
    ],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-viral-diseases",
    route: "biology",
    topic: "Viral diseases",
    specCode: "8464 — Biology — Viral diseases (Trilogy)",
    title: "Viral diseases — Trilogy",
    requiredContent: [
      "Viruses are acellular; reproduce inside host cells using host machinery; specificity to host tissues.",
      "Examples such as measles or HIV at the level required for Trilogy (transmission and impact, not excessive molecular detail).",
      "Vaccination stimulates immune memory; herd immunity reduces spread (conceptual).",
    ],
    requiredSkills: [
      "Compare viral and bacterial disease in terms of treatment and prevention.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Treating viruses as a type of bacterium.",
    ],
    examCommandWords: ["describe", "explain"],
    linkedTopics: ["Communicable diseases", "Vaccination", "Human defence systems"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-fungal-diseases",
    route: "biology",
    topic: "Fungal diseases",
    specCode: "8464 — Biology — Fungal diseases (Trilogy)",
    title: "Fungal diseases — Trilogy",
    requiredContent: [
      "Fungi include moulds and yeasts; some species cause skin, lung, or crop diseases.",
      "Rose black spot as a plant pathogen: symptoms, spread, and treatment principles at GCSE level.",
      "Hygiene, crop removal, and fungicides may reduce impact (advantages/disadvantages in outline).",
    ],
    requiredSkills: [
      "Link pathogen type to example disease and control measure.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Thinking fungi are plants or bacteria.",
    ],
    examCommandWords: ["describe", "explain"],
    linkedTopics: ["Communicable diseases", "Ecology"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-protist-diseases",
    route: "biology",
    topic: "Protist diseases",
    specCode: "8464 — Biology — Protist diseases (Trilogy)",
    title: "Protist diseases — Trilogy",
    requiredContent: [
      "Some protists are pathogens; examples include malaria (Plasmodium) with mosquito vector lifecycle overview.",
      "Chagas disease linked to insect vector where specified.",
      "Control combines vector management, nets, drugs, and public-health programmes (qualitative).",
    ],
    requiredSkills: [
      "Explain role of vector in protist disease spread.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Assuming all protists are «germs» interchangeable with bacteria.",
    ],
    examCommandWords: ["explain", "describe"],
    linkedTopics: ["Communicable diseases", "Ecology"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-human-defence",
    route: "biology",
    topic: "Human defence systems",
    specCode: "8464 — Biology — Human defence (Trilogy)",
    title: "Human defence systems — Trilogy",
    requiredContent: [
      "Skin, mucus, stomach acid, and platelet clotting as non-specific barriers.",
      "White blood cells: phagocytosis, antibody production; role of lymphocytes at concept level.",
      "Vaccination introduces antigens safely so memory cells respond faster on re-exposure.",
    ],
    requiredSkills: [
      "Distinguish specific and non-specific responses with examples.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Thinking antibodies always kill pathogens directly (neutralisation / opsonisation concepts at simple level).",
    ],
    examCommandWords: ["describe", "explain"],
    linkedTopics: ["Vaccination", "Communicable diseases"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-vaccination",
    route: "biology",
    topic: "Vaccination",
    specCode: "8464 — Biology — Vaccination (Trilogy)",
    title: "Vaccination — Trilogy",
    requiredContent: [
      "Vaccines use dead/inactive pathogens, fragments, or harmless weakened forms to trigger primary immune response.",
      "Memory lymphocytes give rapid secondary response on natural exposure.",
      "Herd immunity protects those who cannot be vaccinated when coverage is high enough.",
    ],
    requiredSkills: [
      "Interpret simple graphs of infection rates before and after vaccination programmes.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Believing vaccines contain full-strength active disease routinely.",
    ],
    examCommandWords: ["explain", "evaluate"],
    linkedTopics: ["Human defence systems", "Viral diseases", "Communicable diseases"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-antibiotics-painkillers",
    route: "biology",
    topic: "Antibiotics and painkillers",
    specCode: "8464 — Biology — Antibiotics and painkillers (Trilogy)",
    title: "Antibiotics and painkillers — Trilogy",
    requiredContent: [
      "Antibiotics treat some bacterial infections; do not affect viruses.",
      "Painkillers block pain signals or reduce inflammation but do not kill pathogens.",
      "Overuse/misuse of antibiotics drives selection for resistant bacteria (overview).",
    ],
    requiredSkills: [
      "Justify appropriate use of antibiotics in simple clinical-style scenarios.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Using the terms antibiotic and antiviral interchangeably.",
    ],
    examCommandWords: ["explain", "describe"],
    linkedTopics: ["Bacterial diseases", "Drug development"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-drug-development",
    route: "biology",
    topic: "Drug development",
    specCode: "8464 — Biology — Drug development (Trilogy)",
    title: "Drug development — Trilogy",
    requiredContent: [
      "New medicines are tested for toxicity and dose in pre-clinical work, then clinical trials (phases overview).",
      "Double-blind trials with placebo controls reduce bias when testing efficacy.",
      "Animal testing raises ethical trade-offs recognised in GCSE contexts.",
    ],
    requiredSkills: [
      "Suggest improvements to trial design from simple outlines.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Thinking a single successful trial proves a drug is always safe for everyone.",
    ],
    examCommandWords: ["describe", "evaluate"],
    linkedTopics: ["Antibiotics and painkillers", "Human defence systems"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-photosynthesis",
    route: "biology",
    topic: "Photosynthesis",
    specCode: "8464 — Biology — Photosynthesis (Trilogy)",
    title: "Photosynthesis — Trilogy",
    requiredContent: [
      "Photosynthesis transfers light energy to chemical energy in glucose; occurs in chloroplasts.",
      "Word summary: carbon dioxide + water → glucose + oxygen (with light as energy input).",
      "Limiting factors include light intensity, CO₂, temperature — interpret simple graphs of rate.",
      "Inverse relationship between net photosynthesis and respiration in plants across a 24 h cycle (conceptual).",
    ],
    requiredSkills: [
      "Use data from experiments changing one limiting factor.",
    ],
    requiredPracticals: [
      "Investigate effect of light intensity (or other specified factor) on photosynthesis rate using an indicator such as bubble count or mass gain.",
    ],
    commonMisconceptions: [
      "Thinking plants only respire at night.",
    ],
    examCommandWords: ["explain", "describe", "suggest"],
    linkedTopics: ["Plant cell organisation", "Respiration", "Ecology"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-respiration",
    route: "biology",
    topic: "Respiration",
    specCode: "8464 — Biology — Respiration (Trilogy)",
    title: "Respiration — Trilogy",
    requiredContent: [
      "Aerobic respiration releases energy from glucose using oxygen; occurs mainly in mitochondria.",
      "Word equation: glucose + oxygen → carbon dioxide plus water (+ energy).",
      "Anaerobic respiration in humans yields lactic acid; in yeast yields ethanol and CO₂ (fermentation overview).",
      "Compare aerobic and anaerobic yields and situations where oxygen is limited.",
    ],
    requiredSkills: [
      "Interpret data comparing respiration rates in different conditions.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Confusing breathing (ventilation) with cellular respiration.",
    ],
    examCommandWords: ["compare", "explain"],
    linkedTopics: ["Photosynthesis", "Ecology", "Cell structure"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-homeostasis",
    route: "biology",
    topic: "Homeostasis",
    specCode: "8464 — Biology — Homeostasis (Trilogy)",
    title: "Homeostasis — Trilogy",
    requiredContent: [
      "Homeostasis maintains steady internal conditions (core temperature, blood glucose, water balance) via control systems.",
      "Negative feedback reduces deviations from a set point once sensors detect change.",
      "Trilogy links thermoregulation, blood sugar, and water reabsorption in kidneys at overview level.",
    ],
    requiredSkills: [
      "Outline simple feedback loops using blood glucose or temperature as examples.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Thinking sweating cools by adding cold to the body rather than by evaporation removing heat.",
    ],
    examCommandWords: ["explain", "describe"],
    linkedTopics: ["Hormonal control", "Nervous system"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-nervous-system",
    route: "biology",
    topic: "Nervous system",
    specCode: "8464 — Biology — Nervous system (Trilogy)",
    title: "Nervous system — Trilogy",
    requiredContent: [
      "Stimulus → receptor → coordinator (CNS) → effector pathway; reflex arcs give rapid protection.",
      "Synapses pass signals chemically between neurones; overall coordination allows learning and movement (Trilogy depth).",
      "Compare nervous (fast, short-lived) with hormonal control (slower, longer-lasting).",
    ],
    requiredSkills: [
      "Interpret simple reflex diagrams and neurone signal flow.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Believing electrical signals jump randomly between neurones without synaptic direction.",
    ],
    examCommandWords: ["describe", "explain", "compare"],
    linkedTopics: ["Hormonal control", "Homeostasis"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-hormonal-control",
    route: "biology",
    topic: "Hormonal control",
    specCode: "8464 — Biology — Hormonal control (Trilogy)",
    title: "Hormonal control — Trilogy",
    requiredContent: [
      "Endocrine glands release hormones into blood; target organs carry receptors.",
      "Insulin and glucagon regulate blood glucose; adrenaline prepares the body for rapid action (overview).",
      "Menstrual cycle hormones (FSH, LH, oestrogen, progesterone) control ovulation and uterus lining at Trilogy level.",
    ],
    requiredSkills: [
      "Explain one hormonal control example using receptor specificity.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Thinking hormones travel to all cells and affect all equally.",
    ],
    examCommandWords: ["explain", "describe"],
    linkedTopics: ["Homeostasis", "Nervous system", "Inheritance"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-inheritance",
    route: "biology",
    topic: "Inheritance",
    specCode: "8464 — Biology — Inheritance (Trilogy)",
    title: "Inheritance — Trilogy",
    requiredContent: [
      "Chromosomes carry genes; diploid body cells vs haploid gametes via meiosis.",
      "Dominant and recessive alleles; monohybrid Punnett squares and family-tree interpretation.",
      "Sex determination in humans (XY); some characteristics are sex-linked at basic level.",
    ],
    requiredSkills: [
      "Construct Punnett squares and interpret probability of phenotypes.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Assuming dominant alleles are «stronger» biologically rather than expressed in heterozygotes.",
    ],
    examCommandWords: ["explain", "calculate", "predict"],
    linkedTopics: ["Variation and evolution", "Cell differentiation"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-variation-evolution",
    route: "biology",
    topic: "Variation and evolution",
    specCode: "8464 — Biology — Variation and evolution (Trilogy)",
    title: "Variation and evolution — Trilogy",
    requiredContent: [
      "Genetic and environmental variation together influence phenotype.",
      "Natural selection: variation, competition, differential survival and reproduction, inheritance of advantageous traits.",
      "Evidence for evolution includes fossil record and antibiotic/antiviral resistance as contemporary examples.",
      "Selective breeding uses artificial selection on inherited traits.",
    ],
    requiredSkills: [
      "Apply Darwin’s theory to simple scenarios and data.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Thinking individuals evolve in their lifetime rather than populations over generations.",
    ],
    examCommandWords: ["explain", "describe", "evaluate"],
    linkedTopics: ["Inheritance", "Ecology", "Antibiotics and painkillers"],
  }),
  trilogyRow({
    id: "aqa-trilogy-bio-ecology",
    route: "biology",
    topic: "Ecology",
    specCode: "8464 — Biology — Ecology (Trilogy)",
    title: "Ecology — Trilogy",
    requiredContent: [
      "Communities and populations within ecosystems; biotic and abiotic factors affect distribution and abundance.",
      "Food chains and webs; pyramids of biomass, numbers, or energy (interpretation only where specified).",
      "Carbon and water cycles: reservoirs and processes linking living and physical systems at Trilogy depth.",
      "Human impacts: pollution, land use, climate-linked changes on biodiversity (overview).",
    ],
    requiredSkills: [
      "Use quadrat/transect-style data to discuss population or distribution (conceptual link to sampling).",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Assuming all energy at one trophic level transfers to the next.",
    ],
    examCommandWords: ["describe", "explain", "evaluate"],
    linkedTopics: [
      "Variation and evolution",
      "Photosynthesis",
      "Transport in plants",
    ],
  }),

  trilogyRow({
    id: "aqa-trilogy-chem-atomic-structure",
    route: "chemistry",
    topic: "Atomic structure",
    specCode: "8464 — Chemistry — Atomic structure (Trilogy)",
    title: "Atomic structure — Trilogy",
    requiredContent: [
      "Atoms contain protons and neutrons in the nucleus, electrons in shells/energy levels.",
      "Atomic number = proton count; mass number ≈ protons plus neutrons; isotopes differ in neutron number.",
      "Electronic structure determines chemical properties and Group/Period patterns for main-group elements.",
    ],
    requiredSkills: [
      "Deduce proton/electron numbers for atoms and simple ions; write electronic configurations for first 20 elements.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Confusing mass number with relative atomic mass of an element in the periodic table.",
    ],
    examCommandWords: ["describe", "explain", "calculate"],
    linkedTopics: ["Bonding", "Quantitative chemistry", "Rates of reaction"],
  }),
  trilogyRow({
    id: "aqa-trilogy-chem-bonding",
    route: "chemistry",
    topic: "Bonding",
    specCode: "8464 — Chemistry — Bonding (Trilogy)",
    title: "Bonding — Trilogy",
    requiredContent: [
      "Ionic bonding by electron transfer; giant ionic lattices with high melting points when strong lattice energy.",
      "Covalent bonding by electron sharing; simple molecules vs giant covalent structures.",
      "Metallic bonding: delocalised electrons explaining conductivity and malleability (qualitative).",
    ],
    requiredSkills: [
      "Draw dot-and-cross diagrams for selected molecules and ions; predict bonding type from element positions.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Believing intermolecular forces are the same as covalent bonds within a molecule.",
    ],
    examCommandWords: ["describe", "explain", "compare"],
    linkedTopics: ["Atomic structure", "Chemical changes", "Organic chemistry"],
  }),
  trilogyRow({
    id: "aqa-trilogy-chem-quantitative",
    route: "chemistry",
    topic: "Quantitative chemistry",
    specCode: "8464 — Chemistry — Quantitative chemistry (Trilogy)",
    title: "Quantitative chemistry — Trilogy",
    requiredContent: [
      "Relative formula mass; moles link mass to particle count at a simple quantitative level.",
      "Conservation of mass in reactions; balanced symbol equations including state symbols where appropriate.",
      "Limiting reactants and percentage yield at Trilogy-required depth (not beyond specification).",
    ],
    requiredSkills: [
      "Perform mole and mass calculations for specified reaction types.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Forgetting to balance equations before using mole ratios.",
    ],
    examCommandWords: ["calculate", "determine"],
    linkedTopics: ["Chemical changes", "Rates of reaction", "Chemical analysis"],
  }),
  trilogyRow({
    id: "aqa-trilogy-chem-chemical-changes",
    route: "chemistry",
    topic: "Chemical changes",
    specCode: "8464 — Chemistry — Chemical changes (Trilogy)",
    title: "Chemical changes — Trilogy",
    requiredContent: [
      "Reactivity series predicts displacement and extraction of metals.",
      "Acids react with metals, bases, and carbonates; neutralisation produces salts (name patterns).",
      "Oxidation and reduction in terms of electron transfer or oxygen gain/loss (Trilogy framing).",
    ],
    requiredSkills: [
      "Write word and symbol equations for specified reaction classes.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Thinking all metal + acid reactions produce hydrogen in every case without checking reactivity.",
    ],
    examCommandWords: ["describe", "explain", "write"],
    linkedTopics: ["Energy changes", "Chemistry of the atmosphere", "Using resources"],
  }),
  trilogyRow({
    id: "aqa-trilogy-chem-energy-changes",
    route: "chemistry",
    topic: "Energy changes",
    specCode: "8464 — Chemistry — Energy changes (Trilogy)",
    title: "Energy changes — Trilogy",
    requiredContent: [
      "Exothermic processes release energy to surroundings; endothermic processes absorb energy (reaction profiles qualitatively).",
      "Bond breaking absorbs energy; bond making releases energy; net determines ΔH direction at overview.",
      "Use of fuels and chemical cells stores/releases energy in practical applications.",
    ],
    requiredSkills: [
      "Interpret simple energy-level diagrams for reactions.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Confusing activation energy with overall exo/endo classification.",
    ],
    examCommandWords: ["explain", "describe"],
    linkedTopics: ["Chemical changes", "Rates of reaction", "Chemistry of the atmosphere"],
  }),
  trilogyRow({
    id: "aqa-trilogy-chem-rates",
    route: "chemistry",
    topic: "Rates of reaction",
    specCode: "8464 — Chemistry — Rates of reaction (Trilogy)",
    title: "Rates of reaction — Trilogy",
    requiredContent: [
      "Rate linked to collision frequency and energy; temperature, concentration, surface area, and catalysts alter rate.",
      "Catalysts provide alternative pathways with lower activation energy; unchanged overall in mass at the end.",
      "Measure rate from gas volume, mass loss, or colour change in specified practical contexts.",
    ],
    requiredSkills: [
      "Interpret graphs of amount vs time; compare gradients as rate measures.",
    ],
    requiredPracticals: [
      "Investigate how one variable affects rate for a simple reaction (e.g. marble chips and acid or similar).",
    ],
    commonMisconceptions: [
      "Thinking catalysts are used up in the stoichiometry of the main reaction.",
    ],
    examCommandWords: ["explain", "describe", "compare"],
    linkedTopics: ["Quantitative chemistry", "Energy changes"],
  }),
  trilogyRow({
    id: "aqa-trilogy-chem-organic",
    route: "chemistry",
    topic: "Organic chemistry",
    specCode: "8464 — Chemistry — Organic chemistry (Trilogy)",
    title: "Organic chemistry — Trilogy",
    requiredContent: [
      "Hydrocarbons: alkanes (saturated) and alkenes (C=C) with basic homologous-series ideas.",
      "Functional groups at Trilogy breadth: alcohols, carboxylic acids (overview), polymers from alkenes (addition polymerisation concept).",
      "Crude oil fractional distillation produces fractions of different chain length and use.",
    ],
    requiredSkills: [
      "Name and draw simple molecules; identify unsaturation with bromine water test (conceptual).",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Assuming all carbon compounds are small molecules.",
    ],
    examCommandWords: ["describe", "explain", "draw"],
    linkedTopics: ["Chemical analysis", "Using resources"],
  }),
  trilogyRow({
    id: "aqa-trilogy-chem-analysis",
    route: "chemistry",
    topic: "Chemical analysis",
    specCode: "8464 — Chemistry — Chemical analysis (Trilogy)",
    title: "Chemical analysis — Trilogy",
    requiredContent: [
      "Pure substances have fixed melting/boiling points; formulations are mixtures with uses.",
      "Chromatography separates mixtures; Rf as a simple ratio for comparison (qualitative).",
      "Flame tests and simple qualitative tests for gases (hydrogen, oxygen, carbon dioxide, chlorine) as per Trilogy.",
    ],
    requiredSkills: [
      "Suggest a suitable separation or test to identify unknowns in simple scenarios.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Thinking chromatography spots always prove identity without comparison to known standards.",
    ],
    examCommandWords: ["describe", "explain"],
    linkedTopics: ["Quantitative chemistry", "Organic chemistry"],
  }),
  trilogyRow({
    id: "aqa-trilogy-chem-atmosphere",
    route: "chemistry",
    topic: "Chemistry of the atmosphere",
    specCode: "8464 — Chemistry — Atmosphere (Trilogy)",
    title: "Chemistry of the atmosphere — Trilogy",
    requiredContent: [
      "Early atmosphere evolution; today’s air is mostly nitrogen and oxygen with small amounts of CO₂, water vapour, noble gases.",
      "Greenhouse effect: IR absorption by greenhouse gases; link to climate change without overstating mechanisms.",
      "Carbon footprint and life-cycle ideas; catalytic converters reduce vehicle emissions (overview).",
    ],
    requiredSkills: [
      "Evaluate simple claims about fuels and emissions using chemistry ideas.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Equating ozone hole and greenhouse effect as identical processes.",
    ],
    examCommandWords: ["explain", "evaluate"],
    linkedTopics: ["Using resources", "Chemical changes"],
  }),
  trilogyRow({
    id: "aqa-trilogy-chem-resources",
    route: "chemistry",
    topic: "Using resources",
    specCode: "8464 — Chemistry — Using resources (Trilogy)",
    title: "Using resources — Trilogy",
    requiredContent: [
      "Finite vs renewable resources; recycling metals and plastics reduces energy use and landfill.",
      "Life-cycle assessment considers extraction, manufacture, use, and disposal stages.",
      "Potable water treatment: screening, sedimentation, filtration, sterilisation; desalination as energy-intensive option.",
    ],
    requiredSkills: [
      "Compare environmental impacts of two materials or processes at GCSE depth.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Assuming recycling has no energy or transport cost.",
    ],
    examCommandWords: ["evaluate", "describe"],
    linkedTopics: ["Chemistry of the atmosphere", "Chemical changes"],
  }),

  trilogyRow({
    id: "aqa-trilogy-phys-energy",
    route: "physics",
    topic: "Energy stores and transfers",
    specCode: "8464 — Physics — Energy (Trilogy)",
    title: "Energy stores and transfers — Trilogy",
    requiredContent: [
      "Energy is stored in magnetic, thermal, kinetic, gravitational, electrostatic, elastic, nuclear, chemical.",
      "Energy transfers between stores via mechanical work, heating, radiation, electrical pathways.",
      "Conservation of energy: total store change balances in a closed quantitative model at Trilogy level.",
    ],
    requiredSkills: [
      "Calculate changes involving efficiency, wasted energy, and Sankey-style diagrams (qualitative/numeric as specified).",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Saying energy is «lost» without identifying dissipation to the surroundings.",
    ],
    examCommandWords: ["describe", "explain", "calculate"],
    linkedTopics: ["Particle model of matter", "Electricity", "Forces"],
  }),
  trilogyRow({
    id: "aqa-trilogy-phys-electricity",
    route: "physics",
    topic: "Electricity",
    specCode: "8464 — Physics — Electricity (Trilogy)",
    title: "Electricity — Trilogy",
    requiredContent: [
      "Current is rate of flow of charge; voltage is energy per unit charge transferred; resistance opposes current.",
      "Ohm’s law for ohmic conductors; series and parallel circuit rules at Trilogy depth.",
      "Domestic electricity: alternating current, plugs, fuses/RCDs, power = IV, energy transferred = power × time in kWh context.",
    ],
    requiredSkills: [
      "Interpret circuit diagrams; use V = IR in simple networks.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Believing current is «used up» around a series circuit rather than conserved.",
    ],
    examCommandWords: ["calculate", "explain", "describe"],
    linkedTopics: ["Energy stores and transfers", "Magnetism and electromagnetism"],
  }),
  trilogyRow({
    id: "aqa-trilogy-phys-particle-model",
    route: "physics",
    topic: "Particle model of matter",
    specCode: "8464 — Physics — Particle model (Trilogy)",
    title: "Particle model of matter — Trilogy",
    requiredContent: [
      "States of matter differ in density and particle arrangement; changes of state are physical.",
      "Internal energy is sum of kinetic and potential stores of particles; heating increases energy in the system.",
      "Specific heat capacity and latent heat link energy input to temperature or state change (Trilogy equations depth).",
      "Gas pressure from particle collisions in a container (qualitative kinetic model).",
    ],
    requiredSkills: [
      "Use Q = mcΔT and Eh = mL in specified problems.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Thinking temperature measures «amount of heat particles».",
    ],
    examCommandWords: ["explain", "calculate"],
    linkedTopics: ["Energy stores and transfers", "Forces"],
  }),
  trilogyRow({
    id: "aqa-trilogy-phys-atomic-radiation",
    route: "physics",
    topic: "Atomic structure and radiation",
    specCode: "8464 — Physics — Atoms and radiation (Trilogy)",
    title: "Atomic structure and radiation — Trilogy",
    requiredContent: [
      "Nuclear model: protons, neutrons, electrons; isotopes and unstable nuclei.",
      "Alpha, beta, gamma emission: penetration and ionisation (comparative); half-life as the time for activity to halve for unstable isotopes (random decay of individual nuclei).",
      "Uses and hazards of radiation in medicine and industry with ALARP / shielding concepts at GCSE level.",
    ],
    requiredSkills: [
      "Interpret simple decay graphs or half-life estimates from data.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Thinking irradiation makes an object long-term radioactive in ordinary classroom contexts.",
    ],
    examCommandWords: ["describe", "explain", "compare"],
    linkedTopics: ["Energy stores and transfers", "Forces"],
  }),
  trilogyRow({
    id: "aqa-trilogy-phys-forces",
    route: "physics",
    topic: "Forces",
    specCode: "8464 — Physics — Forces (Trilogy)",
    title: "Forces — Trilogy",
    requiredContent: [
      "Scalar vs vector quantities; resultant force changes motion (Newton’s first and second laws in qualitative/numeric blend).",
      "Weight = mass × gravitational field strength; Hooke’s law region for springs; moments and simple levers.",
      "Pressure in fluids and gases; distance/displacement, speed/velocity, acceleration relationships and graphs.",
    ],
    requiredSkills: [
      "Construct free-body diagrams for simple situations; interpret distance–time and velocity–time graphs.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Equating weight directly with mass without g.",
    ],
    examCommandWords: ["calculate", "explain", "describe"],
    linkedTopics: ["Energy stores and transfers", "Waves", "Particle model of matter"],
  }),
  trilogyRow({
    id: "aqa-trilogy-phys-waves",
    route: "physics",
    topic: "Waves",
    specCode: "8464 — Physics — Waves (Trilogy)",
    title: "Waves — Trilogy",
    requiredContent: [
      "Transverse vs longitudinal; frequency, wavelength, wave speed relationship v = fλ.",
      "Reflection, refraction, absorption at boundaries; sound as longitudinal in mediums.",
      "Electromagnetic spectrum uses and hazards; ionising vs non-ionising at overview level.",
    ],
    requiredSkills: [
      "Draw or interpret wavefront diagrams; use wave equations in simple calculations.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Thinking electromagnetic waves always need a material medium.",
    ],
    examCommandWords: ["describe", "explain", "calculate"],
    linkedTopics: ["Magnetism and electromagnetism", "Atomic structure and radiation"],
  }),
  trilogyRow({
    id: "aqa-trilogy-phys-magnetism",
    route: "physics",
    topic: "Magnetism and electromagnetism",
    specCode: "8464 — Physics — Magnetism (Trilogy)",
    title: "Magnetism and electromagnetism — Trilogy",
    requiredContent: [
      "Magnetic fields around bar magnets and current-carrying wires; right-hand grip / Fleming’s rules at Trilogy depth.",
      "Electromagnets: coil, core, current control; used in relays, MRI (overview), scrap sorting.",
      "Motor effect and simple DC motor principles; induced potential difference when cutting flux (qualitative generator idea).",
    ],
    requiredSkills: [
      "Predict force direction on a wire or explain simple motor/generator sketches.",
    ],
    requiredPracticals: [],
    commonMisconceptions: [
      "Confusing magnetic poles with electric charge attraction rules without domain alignment ideas.",
    ],
    examCommandWords: ["explain", "describe"],
    linkedTopics: ["Electricity", "Energy stores and transfers"],
  }),
];
