// /src/data/demoLessons/gcse-biology-cell-structure.ts

import type { Lesson } from "../../types/lesson";

export const gcseBiologyCellStructureLesson: Lesson = {
  id: "gcse-bio-cell-structure-001",
  title: "Cell Structure (GCSE Biology)",
  stage: "GCSE",
  subject: "Biology",
  topic: "Cells & Organelles",
  difficulty: "Foundation",
  estimatedTime: 25,
  blocks: [
    { type: "heading", level: 1, text: "Learning Objectives" },
    {
      type: "text",
      content:
        "By the end of this lesson you should be able to:\n" +
        "• Identify key organelles in animal and plant cells\n" +
        "• Describe the function of each organelle\n" +
        "• Compare plant cells and animal cells\n",
    },

    { type: "heading", level: 2, text: "Key Idea" },
    {
      type: "text",
      content:
        "Cells are the basic units of life. Most cells contain structures called organelles that carry out specific functions.",
    },

    {
      type: "image",
      // ✅ NEW: real image path served from React public/ folder
      src: "/images/gcse/cell-structure-animal-vs-plant.png",
      prompt:
        "A clear labelled diagram comparing an animal cell and a plant cell side-by-side. Labels: nucleus, cytoplasm, cell membrane, mitochondria, ribosomes, cell wall, chloroplasts, vacuole. GCSE style, colourful, clean.",
      caption: "Animal vs Plant Cell (labelled diagram)",
    },

    { type: "heading", level: 2, text: "Plant vs Animal (Quick Comparison)" },
    {
      type: "table",
      headers: ["Organelle", "Animal Cell", "Plant Cell", "Function (short)"],
      rows: [
        ["Nucleus", "✓", "✓", "Controls cell activities; contains DNA"],
        ["Cell membrane", "✓", "✓", "Controls what enters/leaves the cell"],
        ["Cytoplasm", "✓", "✓", "Where most chemical reactions happen"],
        ["Mitochondria", "✓", "✓", "Site of aerobic respiration (energy release)"],
        ["Ribosomes", "✓", "✓", "Protein synthesis"],
        ["Cell wall", "✗", "✓", "Strengthens and supports the cell"],
        ["Chloroplasts", "✗", "✓", "Photosynthesis (contains chlorophyll)"],
        ["Permanent vacuole", "Small/none", "Large", "Contains cell sap; keeps cell turgid"],
      ],
    },

    { type: "heading", level: 2, text: "Quick Quiz" },
    {
      type: "quiz",
      questions: [
        {
          id: "q1",
          question: "Which organelle controls the cell’s activities?",
          options: ["Ribosome", "Nucleus", "Mitochondrion", "Cell wall"],
          correctAnswer: 1,
          explanation: "The nucleus contains genetic material (DNA) and controls cell activities.",
        },
        {
          id: "q2",
          question: "Where does most aerobic respiration happen?",
          options: ["Mitochondria", "Cytoplasm", "Nucleus", "Vacuole"],
          correctAnswer: 0,
          explanation: "Mitochondria are the site of aerobic respiration, releasing energy.",
        },
        {
          id: "q3",
          question: "Which structure is found in plant cells but not animal cells?",
          options: ["Cell membrane", "Cytoplasm", "Cell wall", "Ribosomes"],
          correctAnswer: 2,
          explanation: "Plant cells have a cell wall; animal cells do not.",
        },
        {
          id: "q4",
          question: "Which organelle is responsible for photosynthesis?",
          options: ["Chloroplast", "Mitochondrion", "Ribosome", "Nucleus"],
          correctAnswer: 0,
          explanation: "Chloroplasts contain chlorophyll and are where photosynthesis happens.",
        },
        {
          id: "q5",
          question: "Ribosomes are the site of…",
          options: ["Respiration", "Protein synthesis", "Photosynthesis", "DNA storage"],
          correctAnswer: 1,
          explanation: "Ribosomes build proteins from amino acids.",
        },
      ],
    },

    { type: "heading", level: 2, text: "Flashcards (Revision)" },
    {
      type: "flashcards",
      cards: [
        { front: "Function of nucleus", back: "Controls cell activities; contains DNA" },
        { front: "Function of mitochondria", back: "Site of aerobic respiration; releases energy" },
        { front: "Function of ribosomes", back: "Protein synthesis" },
        { front: "Function of cell membrane", back: "Controls what enters/leaves the cell" },
        { front: "Function of chloroplasts", back: "Photosynthesis (contains chlorophyll)" },
      ],
    },

    {
      type: "cta",
      label: "Next: Enzymes (coming next in the AI Library)",
      action: "next-lesson",
    },
  ],
};
