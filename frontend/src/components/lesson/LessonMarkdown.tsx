import React, { useMemo } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { lessonMarkdownSanitizeSchema } from "./lessonMarkdownSchema";
import "./lessonInlineFormats.css";

const defaultTypography: Partial<Components> = {
  p: ({ children, ...props }) => (
    <p {...props} style={{ margin: "0 0 0.85em", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
      {children}
    </p>
  ),
  li: ({ children, ...props }) => (
    <li {...props} style={{ marginBottom: "0.35em", lineHeight: 1.7 }}>
      {children}
    </li>
  ),
};

export type LessonMarkdownProps = {
  /** Raw markdown / mixed HTML (limited span + u) */
  children: string;
  /** Extra react-markdown components (img, a, …) merged over defaults */
  components?: Partial<Components>;
  urlTransform?: (url: string, key: string, node: unknown) => string;
  /** Wrapper class (typography + spacing) */
  className?: string;
};

/**
 * Renders teacher lesson block content: remark line breaks, GitHub-style markdown, safe raw HTML for lesson-inline spans.
 */
export function LessonMarkdown({
  children,
  components = {},
  urlTransform = defaultUrlTransform,
  className = "lesson-md-body",
}: LessonMarkdownProps) {
  const merged = useMemo(
    () => ({
      ...defaultTypography,
      ...components,
    }),
    [components]
  );

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, lessonMarkdownSanitizeSchema]]}
        components={merged as Components}
        urlTransform={urlTransform}
      >
        {children ?? ""}
      </ReactMarkdown>
    </div>
  );
}
