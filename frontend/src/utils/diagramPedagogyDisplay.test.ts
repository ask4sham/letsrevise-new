import {
  blockHasDiagramTeachingProse,
  containsDiagramAnswerMaterial,
  diagramCaptionForDisplayFromBlock,
  diagramInstructionsForDisplayFromBlock,
  diagramInstructionsHiddenFromStudents,
  diagramPedagogyDisplayFromBlock,
  diagramPedagogyRenderFromBlock,
  extractDiagramRevealSections,
  extractExplicitDiagramStudentInstructions,
  extractVisibleInstructionsFromCleaned,
  hasExplicitDiagramStudentMarker,
  isDiagramStudentTask,
  isDiagramTeachingProse,
  normalizeDiagramPedagogyAuthoringForPersist,
  pedagogyTitleDuplicatesBlockHeading,
} from "./diagramPedagogyDisplay";
import {
  DIAGRAM_WITH_REVEAL_BLOCK,
  METABOLISM_DEFINED_DIAGRAM_BLOCK,
  METABOLISM_GLUCOSE_JOURNEY_TASK_BLOCK,
  METABOLISM_MAP_DIAGRAM_BLOCK,
} from "./diagramPedagogyDisplay.fixtures";

describe("extractDiagramRevealSections", () => {
  it("pulls answer out of details and leaves remainder", () => {
    const raw = `<p>Study the diagram.</p>
<details><summary>Reveal Answer</summary><p>glucose + oxygen → carbon dioxide + water</p></details>`;
    const { remainder, reveals } = extractDiagramRevealSections(raw);
    expect(reveals).toHaveLength(1);
    expect(reveals[0].body).toContain("glucose");
    expect(remainder).toContain("Study the diagram");
    expect(remainder).not.toMatch(/<details>/i);
  });
});

describe("metabolism diagram regression", () => {
  it("detects teaching-heavy blocks so short intro cannot become instructions", () => {
    expect(blockHasDiagramTeachingProse(METABOLISM_DEFINED_DIAGRAM_BLOCK)).toBe(true);
  });

  it("does not show bloated teaching prose as instructions or below-image caption", () => {
    const display = diagramPedagogyDisplayFromBlock(METABOLISM_DEFINED_DIAGRAM_BLOCK);
    expect(display.visibleInstructions).toBeUndefined();
    expect(display.instructions).toBeUndefined();
    expect(display.title).toBeUndefined();
    expect(display.caption).toBe("Metabolism defined");
    const joined = [display.visibleInstructions, display.caption, display.title]
      .filter(Boolean)
      .join(" ");
    expect(joined).not.toMatch(/<p>|<ul>|<li>/i);
    expect(joined).not.toMatch(/cell's economy/i);
  });

  it("still shows explicit Instruction: line on teaching-heavy blocks", () => {
    const display = diagramPedagogyDisplayFromBlock({
      ...METABOLISM_DEFINED_DIAGRAM_BLOCK,
      intro: "Instruction: Name the three inputs to respiration.",
    });
    expect(display.studentTask).toMatch(/Instruction:\s*Name the three inputs to respiration/i);
    expect(display.caption).toBe("Metabolism defined");
  });

  it("flags editor warning when teaching prose lacks explicit student markers", () => {
    expect(diagramInstructionsHiddenFromStudents(METABOLISM_DEFINED_DIAGRAM_BLOCK)).toBe(true);
    expect(
      diagramInstructionsHiddenFromStudents({
        ...METABOLISM_DEFINED_DIAGRAM_BLOCK,
        intro: "Instruction: Label the organelles.",
      })
    ).toBe(false);
  });

  it("suppresses caption when it duplicates title (map of metabolism)", () => {
    const display = diagramPedagogyDisplayFromBlock(METABOLISM_MAP_DIAGRAM_BLOCK);
    expect(display.visibleInstructions).toBeUndefined();
    expect(display.title).toBeUndefined();
    expect(display.caption).toBeUndefined();
  });

  it("suppresses pedagogy title when it matches the lesson block title", () => {
    const block = {
      type: "diagram",
      number: 6,
      title: "Metabolism in a nutshell",
      subtitle: "Task:\n- Identify one pathway where glucose is broken down.",
      imageUrl: "https://example.com/map.png",
    };
    expect(pedagogyTitleDuplicatesBlockHeading(block, "Metabolism in a nutshell")).toBe(true);
    expect(pedagogyTitleDuplicatesBlockHeading(block, "metabolism in a nutshell!")).toBe(true);
    const display = diagramPedagogyDisplayFromBlock(block);
    expect(display.title).toBeUndefined();
    expect(display.studentTask).toContain("Identify one pathway");
  });

  it("does not treat unrelated labels as duplicates", () => {
    const block = {
      type: "diagram",
      number: 6,
      title: "Metabolism in a nutshell",
    };
    expect(pedagogyTitleDuplicatesBlockHeading(block, "Energy transfer in cells")).toBe(false);
    expect(pedagogyTitleDuplicatesBlockHeading(block, "Metabolism in a nutshell")).toBe(true);
    expect(pedagogyTitleDuplicatesBlockHeading(block, "6 — Metabolism in a nutshell")).toBe(true);
  });

  it("shows student task with bullets and hides preamble plus model answer in reveal", () => {
    const display = diagramPedagogyDisplayFromBlock(METABOLISM_GLUCOSE_JOURNEY_TASK_BLOCK);
    const visible = display.studentTask ?? display.visibleInstructions ?? "";
    expect(visible).toMatch(/Task:/i);
    expect(visible).toContain("- Identify one pathway where glucose is broken down");
    expect(visible).toContain("Then explain how ATP links");
    expect(visible).not.toContain("Trace the journey of glucose");
    expect(visible).not.toMatch(/<p>|<ul>|<li>|Reveal Answer/i);
    expect(visible).not.toContain("Catabolic reactions such as respiration");

    expect(display.hiddenAnswer?.body).toContain("Catabolic reactions such as respiration");
    expect(display.hiddenAnswer?.body).not.toMatch(/<p>/i);
    expect(display.caption).toBeUndefined();
  });
});

describe("diagramPedagogyRenderFromBlock", () => {
  it("renders caption from dedicated field even without studentTask", () => {
    const rendered = diagramPedagogyRenderFromBlock({
      type: "diagram",
      subtitle: "Task\n\n1. Name the five stages.",
      caption: "GCSE AQA Biology Higher Tier: Reflex Arc",
      imageUrl: "https://example.com/reflex.png",
    });
    expect(rendered.instructions).toContain("Name the five stages");
    expect(rendered.caption).toBe("GCSE AQA Biology Higher Tier: Reflex Arc");
  });

  it("reads instructions from content when studentTask is set but subtitle key is empty", () => {
    const rendered = diagramPedagogyRenderFromBlock({
      type: "diagram",
      content: "Study the reflex arc shown in the diagram.",
      studentTask: "Task\n\n1. Name the five stages.",
      caption: "GCSE AQA Biology Higher Tier",
    });
    expect(rendered.instructions).toContain("Study the reflex arc");
    expect(rendered.studentTask).toContain("Name the five stages");
    expect(rendered.caption).toBe("GCSE AQA Biology Higher Tier");
  });

  it("falls back to raw authoring fields when display normalizer omits them", () => {
    const rendered = diagramPedagogyRenderFromBlock({
      type: "diagram",
      subtitle: "Study the reflex arc shown in the diagram.",
      studentTask: "Task\n\n1. Name the five stages.",
      caption: "GCSE AQA Biology Higher Tier",
    });
    expect(rendered.instructions).toContain("Study the reflex arc");
    expect(rendered.studentTask).toContain("Name the five stages");
    expect(rendered.caption).toBe("GCSE AQA Biology Higher Tier");
  });
});

describe("dedicated studentTask field", () => {
  it("shows short subtitle as instructions even when legacy content is teaching-heavy", () => {
    const display = diagramPedagogyDisplayFromBlock({
      type: "diagram",
      title: "Metabolism map",
      subtitle: "Study the reflex arc shown in the diagram.",
      studentTask: "Task\n\n1. Name the five stages.",
      content:
        "Think like an examiner\n- long legacy teaching prose\n- more teaching\n- even more teaching content that used to hide student-facing copy",
      imageUrl: "https://example.com/map.png",
    });
    expect(display.instructions).toContain("Study the reflex arc");
    expect(display.studentTask).toContain("Name the five stages");
  });
  it("splits instructions and student task when studentTask is set", () => {
    const display = diagramPedagogyDisplayFromBlock({
      type: "diagram",
      title: "The reflex arc",
      subtitle: "Study the reflex arc shown in the diagram.",
      studentTask:
        "Task\n\n1. Name the five stages.\n2. Describe the pathway from receptor to effector.",
      caption: "GCSE AQA Biology Higher Tier",
      imageUrl: "https://example.com/reflex.png",
    });
    expect(display.instructions).toContain("Study the reflex arc");
    expect(display.studentTask).toContain("Name the five stages");
    expect(display.caption).toBe("GCSE AQA Biology Higher Tier");
    expect(display.visibleInstructions).toBeUndefined();
  });

  it("renders nothing for student task when field is absent", () => {
    const display = diagramPedagogyDisplayFromBlock({
      type: "diagram",
      title: "Cell diagram",
      subtitle: "Instruction: Label the organelles.",
      caption: "Figure 1",
      imageUrl: "https://example.com/cell.png",
    });
    expect(display.instructions).toBeUndefined();
    expect(display.studentTask).toMatch(/Instruction:/i);
  });
});

describe("explicit diagram student markers", () => {
  it("renders Task: marked instructions only", () => {
    const display = diagramPedagogyDisplayFromBlock({
      type: "diagram",
      title: "Nervous system",
      imageUrl: "https://example.com/diagram.png",
      caption: "Reflex arc",
      subtitle: "Task:\n- Label the sensory neurone\n- Describe the relay neurone",
    });
    expect(display.studentTask).toMatch(/Task:/i);
    expect(display.studentTask).toContain("sensory neurone");
    expect(display.caption).toBe("Reflex arc");
  });

  it("renders Diagram task: and Student task: markers", () => {
    expect(
      extractExplicitDiagramStudentInstructions(
        "Diagram task:\n- Sketch the reflex pathway"
      )
    ).toContain("Sketch the reflex pathway");
    expect(
      diagramPedagogyDisplayFromBlock({
        type: "diagram",
        imageUrl: "https://example.com/x.png",
        subtitle: "Student task:\n- Name structure A",
      }).studentTask
    ).toMatch(/Student task:/i);
  });

  it("hides unmarked short lines and unmarked long teaching prose", () => {
    expect(
      extractVisibleInstructionsFromCleaned("Label the parts on the diagram.")
    ).toBeUndefined();
    expect(
      diagramPedagogyDisplayFromBlock({
        type: "diagram",
        imageUrl: "https://example.com/x.png",
        subtitle: "Label the parts on the diagram.",
        caption: "Figure 1",
      }).visibleInstructions
    ).toBeUndefined();
    expect(hasExplicitDiagramStudentMarker("Instruction: one line")).toBe(true);
    expect(isDiagramStudentTask("Think like an examiner\n- a\n- b\n- c")).toBe(false);
  });
});

describe("reveal answer handling", () => {
  it("does not leave Reveal Answer as plain visible caption text", () => {
    const display = diagramPedagogyDisplayFromBlock({
      ...DIAGRAM_WITH_REVEAL_BLOCK,
      subtitle: "Instruction: Label the organelles on the diagram.",
    });
    expect(display.studentTask).toMatch(/Instruction:/i);
    expect(display.studentTask).toContain("Label the organelles");
    expect(display.caption).toBeUndefined();
    expect(display.hiddenAnswer?.body).toContain("mitochondria");
    expect(display.hiddenAnswer?.body).not.toMatch(/<p>/i);
  });

  it("flags answer material in plain text", () => {
    expect(containsDiagramAnswerMaterial("Reveal Answer\n\nglucose → CO₂")).toBe(true);
    expect(isDiagramTeachingProse("Think like an examiner\n- point one\n- point two\n- point three")).toBe(
      true
    );
  });

  it("treats explicit Task marker as student task, not teaching prose", () => {
    const taskHtml = `<p><strong>Task:</strong></p><ul><li>Identify A</li><li>Identify B</li></ul>`;
    const { remainder } = extractDiagramRevealSections(taskHtml);
    const visible = extractVisibleInstructionsFromCleaned(remainder.replace(/<[^>]+>/g, "\n"));
    expect(isDiagramStudentTask(visible ?? "")).toBe(true);
    expect(isDiagramTeachingProse(visible ?? "")).toBe(false);
    expect(visible).toMatch(/Task:/i);
  });
});

describe("normalizeDiagramPedagogyAuthoringForPersist", () => {
  it("converts HTML task + details to plain text for save", () => {
    const raw = METABOLISM_GLUCOSE_JOURNEY_TASK_BLOCK.subtitle;
    const out = normalizeDiagramPedagogyAuthoringForPersist(raw);
    expect(out).not.toMatch(/<p>|<ul>|<details>/i);
    expect(out).toContain("Trace the journey");
    expect(out).toContain("Reveal Answer");
    expect(out).toContain("Catabolic reactions");
  });
});

describe("diagramCaptionForDisplayFromBlock", () => {
  it("allows genuine source note only", () => {
    expect(
      diagramCaptionForDisplayFromBlock({
        type: "diagram",
        caption: "Credit: AQA past paper 2023",
      })
    ).toBe("Credit: AQA past paper 2023");
  });

  it("suppresses duplicate task in caption when instructions exist", () => {
    const block = {
      type: "diagram",
      subtitle: "Task:\n- Label the parts on the diagram.",
      caption: "Label the parts on the diagram.",
    };
    expect(diagramInstructionsForDisplayFromBlock(block)).toContain("Label the parts");
    expect(diagramCaptionForDisplayFromBlock(block)).toBeUndefined();
  });
});
