import { defaultSchema } from "hast-util-sanitize";
import type { Schema } from "hast-util-sanitize";

const LESSON_INLINE_CLASS =
  /^(?:lesson-(?:inline|fsz-small|fsz-normal|fsz-large|fsz-xlarge|fc-black|fc-navy|fc-green|fc-red|fc-purple))(?:\s+lesson-(?:inline|fsz-small|fsz-normal|fsz-large|fsz-xlarge|fc-black|fc-navy|fc-green|fc-red|fc-purple))*$/;

/**
 * hast-util-sanitize schema: allow limited <span class="lesson-*"> and <u> inside teacher markdown (rehype-raw).
 */
export const lessonMarkdownSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "span", "u"],
  attributes: {
    ...defaultSchema.attributes,
    span: [["className", LESSON_INLINE_CLASS]],
    u: [],
  },
};
