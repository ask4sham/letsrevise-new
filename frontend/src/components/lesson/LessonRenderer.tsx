import React, { useMemo } from "react";
import type { Components } from "react-markdown";
import { defaultUrlTransform } from "react-markdown";
import { LessonMarkdown } from "./LessonMarkdown";
import { preprocessMarkdownAssetUrls } from "../../utils/assetUrl";
import { parseLessonText, type LessonSegment } from "../../lib/parseLessonText";
import { SectionHeading } from "./SectionHeading";
import { CheckpointCard } from "./CheckpointCard";
import "./lessonRenderer.css";

export type LessonRendererProps = {
  text: string;
  /** Same custom components as editor preview (images, links, …) */
  markdownComponents?: Partial<Components>;
  urlTransform?: (url: string, key: string, node: unknown) => string;
};

function segmentKey(seg: LessonSegment, index: number): string {
  if (seg.type === "heading") return `h-${index}-${seg.text.slice(0, 24)}`;
  if (seg.type === "checkpoint") return `cp-${index}-${seg.question.slice(0, 16)}`;
  return `md-${index}-${seg.text.length}`;
}

/**
 * Permanent LetsRevise lesson text renderer: section headings, checkpoint cards, markdown fallback.
 * Raw `text` is unchanged in storage — used for preview/output only.
 */
export function LessonRenderer({
  text,
  markdownComponents,
  urlTransform = defaultUrlTransform,
}: LessonRendererProps): React.ReactElement {
  const segments = useMemo((): LessonSegment[] => {
    try {
      return parseLessonText(text ?? "");
    } catch {
      return [{ type: "markdown", text: text ?? "" }];
    }
  }, [text]);

  return (
    <div className="lesson-renderer-root">
      {segments.map((seg, idx) => {
        if (seg.type === "heading") {
          return <SectionHeading key={segmentKey(seg, idx)}>{seg.text}</SectionHeading>;
        }
        if (seg.type === "checkpoint") {
          return (
            <CheckpointCard
              key={segmentKey(seg, idx)}
              question={seg.question}
              options={seg.options}
              answer={seg.answer}
            />
          );
        }
        const md = seg.text ?? "";
        if (!md.trim()) {
          return <React.Fragment key={segmentKey(seg, idx)} />;
        }
        return (
          <LessonMarkdown
            key={segmentKey(seg, idx)}
            className="lesson-md-body"
            components={markdownComponents}
            urlTransform={urlTransform}
          >
            {preprocessMarkdownAssetUrls(md)}
          </LessonMarkdown>
        );
      })}
    </div>
  );
}

export default LessonRenderer;
