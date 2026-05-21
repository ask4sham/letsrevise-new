/**

 * Whether teaching blocks should render in student view (omit empty shells).

 */



import { hasRenderableLessonImageSrc } from "../constants/lessonImageDisplay";

import { htmlToPlainText } from "./parseFlexibleCheckpointPaste";



const TEACHER_PLANNING_LINE =

  /^(Placement|What it should show|Brand\/style|Board plan|Key labels|Why it helps|Type)\s*:/i;



export const STUDENT_PLACEHOLDER_TEXT_PATTERNS = [

  /diagram\s+image\s+is\s+not\s+available/i,

  /diagram\s+unavailable/i,

  /image\s+unavailable/i,

  /add\s+an\s+image\s+for\s+this\s+step/i,

];



function plainLen(html: string): number {

  return htmlToPlainText(String(html ?? "")).replace(/\s+/g, " ").trim().length;

}



function studentFacingDiagramText(html: string): string {

  return String(html ?? "")

    .split("\n")

    .filter((line) => !TEACHER_PLANNING_LINE.test(line.trim()))

    .join("\n");

}



export function isStudentPlaceholderBannerText(html: string): boolean {

  const plain = htmlToPlainText(String(html ?? "")).replace(/\s+/g, " ");

  if (!plain) return false;

  return STUDENT_PLACEHOLDER_TEXT_PATTERNS.some((re) => re.test(plain));

}



/** Diagram (concept) block worth showing to students. */

export function isStudentVisibleDiagramBlock(block: {

  type?: string;

  imageUrl?: string;

  visualId?: string;

  caption?: string;

  content?: string;

}): boolean {

  const imageUrl = block.imageUrl != null ? String(block.imageUrl).trim() : "";

  if (hasRenderableLessonImageSrc(imageUrl)) return true;

  const visualId = block.visualId != null ? String(block.visualId).trim() : "";

  if (visualId) return true;

  const caption = block.caption != null ? String(block.caption).trim() : "";

  const content = studentFacingDiagramText(String(block.content ?? "").trim());

  if (isStudentPlaceholderBannerText(content)) return false;

  const textLen = plainLen(content) + plainLen(caption);

  return textLen >= 48;

}



/** Interactive diagram requires a renderable image (hotspots need a canvas). */

export function isStudentVisibleInteractiveDiagramBlock(block: {

  imageUrl?: string;

  intro?: string;

  content?: string;

}): boolean {

  const imageUrl = block.imageUrl != null ? String(block.imageUrl).trim() : "";

  if (!hasRenderableLessonImageSrc(imageUrl)) return false;

  const intro = String(block.intro ?? "");

  const content = String(block.content ?? "");

  if (isStudentPlaceholderBannerText(intro) || isStudentPlaceholderBannerText(content)) {

    return hasRenderableLessonImageSrc(imageUrl);

  }

  return true;

}



function sequenceStepHasStudentValue(step: {

  title?: string;

  description?: string;

  imageUrl?: string;

}): boolean {

  const title = String(step.title ?? "").trim();

  const desc = String(step.description ?? "").trim();

  const img = String(step.imageUrl ?? "").trim();

  if (hasRenderableLessonImageSrc(img)) return true;

  if (isStudentPlaceholderBannerText(desc)) return false;

  return plainLen(desc) >= 20 || title.length >= 8;

}



/** Step-by-step block worth showing (at least one substantive step or intro). */

export function isStudentVisibleInteractiveSequenceBlock(block: {

  intro?: string;

  content?: string;

  sequenceSteps?: Array<{ title?: string; description?: string; imageUrl?: string }>;

  steps?: Array<{ title?: string; description?: string; imageUrl?: string }>;

}): boolean {

  const intro = String(block.intro ?? "");

  const content = String(block.content ?? "");

  if (isStudentPlaceholderBannerText(intro) && isStudentPlaceholderBannerText(content)) {

    return false;

  }

  const raw = block.sequenceSteps ?? block.steps;

  const steps = Array.isArray(raw) ? raw : [];

  if (steps.some(sequenceStepHasStudentValue)) return true;

  return plainLen(intro) + plainLen(content) >= 48;

}


