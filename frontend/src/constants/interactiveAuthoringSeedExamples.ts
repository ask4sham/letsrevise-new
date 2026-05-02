/**
 * Minimal seed blocks for Create Lesson QA — structured only (no markdown body).
 * Use with insertPreparedLessonBlock / local state; call newId() per hotspot/pair id.
 */

export function seedInteractiveDiagramBlock(newId: () => string): Record<string, unknown> {
  return {
    type: "interactiveDiagram",
    content: "",
    title: "Seed: Interactive diagram (A–D)",
    intro:
      "Tap each hotspot on the diagram. Hotspot A includes an example MCQ. Replace the placeholder image with your own upload or URL.",
    imageUrl: "https://placehold.co/720x480/e2e8f0/1e293b?text=Your+diagram+image",
    role: "hotspot",
    hotspots: [
      {
        id: newId(),
        x: 20,
        y: 28,
        label: "A",
        description: "Example structure — edit this explanation.",
        explanation: "Example structure — edit this explanation.",
        test: {
          question: "Which label is this hotspot?",
          options: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "This marker is labelled A.",
        },
      },
      {
        id: newId(),
        x: 55,
        y: 30,
        label: "B",
        description: "Second feature — edit me.",
        explanation: "Second feature — edit me.",
      },
      {
        id: newId(),
        x: 32,
        y: 62,
        label: "C",
        description: "Third feature — edit me.",
        explanation: "Third feature — edit me.",
      },
      {
        id: newId(),
        x: 70,
        y: 64,
        label: "D",
        description: "Fourth feature — edit me.",
        explanation: "Fourth feature — edit me.",
      },
    ],
  };
}

export function seedDragDropMatchBlock(newId: () => string): Record<string, unknown> {
  return {
    type: "dragDropMatch",
    content: "",
    title: "Seed: Drag and drop match",
    intro: "Drag each answer card to the correct prompt on the left.",
    instructions: "Match each organelle to its function.",
    role: "match",
    pairs: [
      {
        id: newId(),
        prompt: "Mitochondria",
        answer: "Aerobic respiration / ATP",
        explanation: "Site of respiration in eukaryotic cells.",
      },
      {
        id: newId(),
        prompt: "Nucleus",
        answer: "Contains genetic material (DNA)",
        explanation: "Controls the cell; holds chromosomes.",
      },
      {
        id: newId(),
        prompt: "Ribosome",
        answer: "Protein synthesis",
        explanation: "Assembles proteins from amino acids.",
      },
      {
        id: newId(),
        prompt: "Cell membrane",
        answer: "Controls entry and exit of substances",
        explanation: "Selectively permeable barrier.",
      },
    ],
  };
}
