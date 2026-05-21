import {
  coerceLessonMcqOptionsFour,
  tryParseFlexibleCheckpointMcq,
  normalizeFlexibleCheckpointPasteText,
} from "./parseFlexibleCheckpointPaste";

describe("tryParseFlexibleCheckpointMcq", () => {
  it("parses format A (** stripped upstream) ⚡ CHECKPOINT + Option labels + Explanation", () => {
    const mcq = `
⚡ CHECKPOINT
Question:
What is mitosis?

Option 1:
A — wrong

Option 2:
Correct line

Answer:
Correct line

Explanation:
Because cells divide.
`;

    const p = tryParseFlexibleCheckpointMcq(mcq)!;
    expect(p).not.toBeNull();
    expect(p.prompt).toMatch(/mitosis/i);
    expect(p.options.slice(0, 2).filter(Boolean).length).toBeGreaterThanOrEqual(2);
    expect(p.correctAnswer).toContain("Correct");
    expect(p.explanation).toMatch(/Because/i);
  });

  it("parses bullet options + Correct answer synonym", () => {
    const raw = normalizeFlexibleCheckpointPasteText(`QUICK CHECK
Question: Pick one

- Alpha
- Beta
- Gamma
- Delta

Correct answer:
Beta`);

    const p = tryParseFlexibleCheckpointMcq(raw)!;
    expect(p).not.toBeNull();
    expect(p.prompt).toMatch(/Pick one/);
    expect(p.correctAnswer).toBe("Beta");
  });

  it("parses numbered topic line preamble", () => {
    const raw = `17 — QUICK CHECK
Paste into: Quick check (checkpoint)

Question:
Test?

Option 1: One
Option 2: Two
Option 3: Three
Option 4: Four

Answer:
Three`;

    const p = tryParseFlexibleCheckpointMcq(raw)!;
    expect(p).not.toBeNull();
    expect(p.correctAnswer).toContain("Three");
  });

  it("converts legacy generator HTML + plaintext Answer: below the list", () => {
    const raw = `12 — CHECKPOINT
Paste into: Checkpoint block

<p><strong>Question</strong></p>
<p>What is 2+2?</p>
<ul><li>Three</li><li>Four</li><li>Five</li><li>Six</li></ul>

Answer:
Four`;

    const p = tryParseFlexibleCheckpointMcq(raw)!;
    expect(p).not.toBeNull();
    expect(p.prompt).toMatch(/2\+2/);
    expect(p.correctAnswer).toBe("Four");
    expect(p.options[1]).toContain("Four");
  });

  it("parses MCQ with <details><summary>Reveal Answer</summary> and no Answer: line (answer from details)", () => {
    const raw = `**⚡ CHECKPOINT**

Question:
Which is smallest?

Option 1:
Cell

Option 2:
Tissue

Option 3:
Organ

Option 4:
Organ system

<details><summary>Reveal Answer</summary>
Cell
</details>`;

    const p = tryParseFlexibleCheckpointMcq(raw)!;
    expect(p).not.toBeNull();
    expect(p.prompt).toMatch(/smallest/i);
    expect(p.prompt).not.toMatch(/Reveal:\s*Reveal/i);
    expect(p.correctAnswer).toMatch(/^Cell$/i);
    expect(p.options[0]).toMatch(/Cell/i);
  });

  it("returns null for legacy HTML MCQ with no Answer line (preview-only export)", () => {
    const raw = `<p><strong>Question</strong></p>
<p>Pick one</p>
<ul><li>A</li><li>B</li></ul>`;

    expect(tryParseFlexibleCheckpointMcq(raw)).toBeNull();
  });

  it("parses SS1 mangled headings (6. CHECKPOINT, bullet, ⚡ CHECKPOINT*)", () => {
    const raw = `6. CHECKPOINT

- ⚡ CHECKPOINT*

Question:

Which sentence best explains why Salmonella causes vomiting and diarrhoea?

Option 1:

Because viruses in the chicken directly kill white blood cells.

Option 2:

Because bacteria reproduce in the gut and release toxins that irritate the intestine.

Option 3:

Because painkillers reduce stomach acid allowing bacteria to grow.

Option 4:

Because antibiotics destroy enzymes in food.

Answer:

Because bacteria reproduce in the gut and release toxins that irritate the intestine.

Explanation:

`;

    const p = tryParseFlexibleCheckpointMcq(raw)!;
    expect(p).not.toBeNull();
    expect(p.prompt).toMatch(/Salmonella/i);
    expect(p.correctAnswer).toContain("bacteria reproduce");
    expect(p.options.filter(Boolean).length).toBe(4);
  });

  it("parses canonical generator **⚡ CHECKPOINT** plain text (Question / Option 1–4 / Answer / Explanation)", () => {
    const canonical = `**⚡ CHECKPOINT**

Question:
What is photosynthesis?

Option 1:
Breaking down glucose

Option 2:
Releasing energy without oxygen

Option 3:
Using light to make glucose

Option 4:
Digestion in leaves

Answer:
Using light to make glucose

Explanation:
Plants convert light energy into chemical energy.`;

    const p = tryParseFlexibleCheckpointMcq(canonical)!;
    expect(p).not.toBeNull();
    expect(p.prompt).toMatch(/photosynthesis/i);
    expect(p.options.length).toBe(4);
    expect(p.options.every((o) => typeof o === "string")).toBe(true);
    expect(p.options[2]).toMatch(/Using light to make glucose/);
    expect(p.correctAnswer).toBe(p.options[2]);
    expect(p.explanation).toMatch(/Plants convert/i);
  });

  it("parses Difficulty: medium before Question (generator tiering)", () => {
    const raw = `**⚡ CHECKPOINT**

Difficulty: medium

Question:
Which process uses enzymes?

Option 1:
Photosynthesis

Option 2:
Digestion

Option 3:
Respiration

Option 4:
Diffusion

Answer:
Digestion`;

    const p = tryParseFlexibleCheckpointMcq(raw)!;
    expect(p).not.toBeNull();
    expect(p.difficultyTier).toBe("medium");
    expect(p.markScheme).toEqual(["@lr-difficulty:medium"]);
    expect(p.prompt).toMatch(/enzymes/i);
    expect(p.correctAnswer).toBe("Digestion");
  });

  it("parses Difficulty with foundation alias", () => {
    const raw = `QUICK CHECK
Difficulty: foundation
Question: State one function of the nucleus.

Option 1: Stores DNA
Option 2: Makes proteins
Option 3: Digests food
Option 4: Absorbs light

Answer:
Stores DNA`;

    const p = tryParseFlexibleCheckpointMcq(raw)!;
    expect(p.difficultyTier).toBe("easy");
    expect(p.markScheme?.[0]).toBe("@lr-difficulty:easy");
  });

  it("coerceLessonMcqOptionsFour normalises arrays and numeric-key objects to four strings", () => {
    expect(coerceLessonMcqOptionsFour(["a", "b"])).toEqual(["a", "b", "", ""]);
    expect(coerceLessonMcqOptionsFour({ 0: "x", 1: "y", 2: "z", 3: "w" })).toEqual(["x", "y", "z", "w"]);
    expect(coerceLessonMcqOptionsFour("not-array" as unknown)).toEqual(["", "", "", ""]);
  });
});
