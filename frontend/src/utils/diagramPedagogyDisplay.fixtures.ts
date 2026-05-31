/**
 * Regression fixtures from Biology — Metabolism (AQA GCSE) diagram blocks (migration audit).
 */

/** Block 6 — metabolism-defined diagram (bloated subtitle + short caption). */
export const METABOLISM_DEFINED_DIAGRAM_BLOCK = {
  type: "diagram",
  title: "CORE LEARNING",
  imageUrl:
    "https://example.com/lesson-media/page/block_4/metabolism-defined.display.png",
  caption: "Metabolism defined",
  alt: "Metabolism defined",
  subtitle: `<h2><strong>Metabolism: the cell's economy</strong></h2>
<p>Let's ensure every label you use earns you marks.</p>
<h3><strong>Central idea</strong></h3>
<p><strong>Catabolism</strong> involves breaking down molecules and releasing energy.</p>
<ul>
<li>After digestion, cells receive <strong>glucose</strong>.</li>
<li><strong>ATP</strong> then drives <strong>anabolic</strong> reactions.</li>
</ul>`,
  intro: `<h2><strong>Metabolism: the cell's economy</strong></h2>
<p>Let's ensure every label you use earns you marks.</p>`,
  note: `<h2><strong>Metabolism: the cell's economy</strong></h2>`,
  content: `<h2><strong>Metabolism: the cell's economy</strong></h2>
<p>Let's ensure every label you use earns you marks.</p>`,
} as const;

/** Block 8 — map-of-metabolism (title duplicates caption; examiner prose in subtitle). */
export const METABOLISM_MAP_DIAGRAM_BLOCK = {
  type: "diagram",
  title: "Map of metabolism",
  imageUrl: "https://example.com/lesson-media/page/block_5/map-of-metabolism.display.png",
  caption: "Map of metabolism",
  alt: "Map of metabolism",
  subtitle: `<h3><strong>Think like an examiner</strong></h3>
<p>Utilize precise pairs and chains to maximize your marks:</p>
<ul>
<li><strong>Glucose → respiration → ATP</strong></li>
</ul>`,
  content: `<h3><strong>Think like an examiner</strong></h3>
<p>Utilize precise pairs and chains to maximize your marks:</p>`,
} as const;

/** Glucose journey student task + reveal answer (must show task above image, answer in accordion). */
export const METABOLISM_GLUCOSE_JOURNEY_TASK_BLOCK = {
  type: "diagram",
  title: "Map of metabolism",
  imageUrl: "https://example.com/lesson-media/page/block_5/map-of-metabolism.display.png",
  caption: "Map of metabolism",
  subtitle: `<p>Trace the journey of glucose through the diagram.</p>
<p><strong>Task:</strong></p>
<ul>
<li>Identify one pathway where glucose is broken down.</li>
<li>Identify one pathway where glucose is stored.</li>
<li>Identify one pathway where glucose is used to build larger molecules.</li>
</ul>
<p>Then explain how ATP links these processes together.</p>
<details>
<summary>Reveal Answer</summary>
<p>Catabolic reactions such as respiration release energy and transfer it to ATP. ATP then powers anabolic reactions that build storage molecules and larger structures.</p>
</details>`,
} as const;

/** Diagram caption with reveal answer (must not show answer until expanded). */
export const DIAGRAM_WITH_REVEAL_BLOCK = {
  type: "diagram",
  title: "Cell diagram",
  caption: `<p>Label the organelles.</p>
<details>
<summary>Reveal Answer</summary>
<p>mitochondria — site of aerobic respiration</p>
</details>`,
  subtitle: "Label the organelles on the diagram.",
  imageUrl: "https://example.com/cell.png",
} as const;
