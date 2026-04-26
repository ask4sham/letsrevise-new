import { defaultSchema } from "hast-util-sanitize";
import type { Schema } from "hast-util-sanitize";

const LESSON_INLINE_CLASS =
  /^(?:lesson-(?:inline|fsz-small|fsz-normal|fsz-large|fsz-xlarge|fc-black|fc-navy|fc-green|fc-red|fc-purple))(?:\s+lesson-(?:inline|fsz-small|fsz-normal|fsz-large|fsz-xlarge|fc-black|fc-navy|fc-green|fc-red|fc-purple))*$/;

/** Glossary key-term marker from the editor: <span data-key-term="..."> */
const KEY_TERM_DATA_ATTR = /^[\s\S]{1,500}$/;

const defaultSpanAttrs = defaultSchema.attributes?.span;
const spanAttributes: Array<[string, RegExp] | string> = [
  ...(Array.isArray(defaultSpanAttrs) ? (defaultSpanAttrs as Array<[string, RegExp] | string>) : []),
  ["className", LESSON_INLINE_CLASS],
  ["dataKeyTerm", KEY_TERM_DATA_ATTR],
];

/**
 * hast-util-sanitize schema: allow limited <span class="lesson-*">, optional data-key-term, and <u> inside teacher markdown (rehype-raw).
 */
export const lessonMarkdownSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "span", "u"],
  attributes: {
    ...defaultSchema.attributes,
    span: spanAttributes,
    u: [],
  },
};
