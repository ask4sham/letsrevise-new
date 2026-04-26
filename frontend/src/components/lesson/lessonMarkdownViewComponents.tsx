import type { Components } from "react-markdown";
import { defaultUrlTransform } from "react-markdown";
import React from "react";
import { makeAbsoluteAssetUrl } from "../../utils/assetUrl";
import { hasRenderableLessonImageSrc } from "../../constants/lessonImageDisplay";
import { hideBrokenLessonImage, LessonImageFrame } from "./LessonImageFrame";

/**
 * Asset URLs for react-markdown v10 (pass-through for same-origin uploads, else default sanitization).
 */
export function lessonMarkdownUrlTransform(
  url: string,
  _key?: string,
  _node?: unknown
): string {
  try {
    const decoded = url?.includes("%") ? decodeURIComponent(url) : (url ?? "");
    const abs = makeAbsoluteAssetUrl(decoded);
    if (abs) return abs;
    return defaultUrlTransform(url ?? "");
  } catch {
    return defaultUrlTransform(url ?? "");
  }
}

type SafeStr = (v: any, fallback?: string) => string;

/**
 * Headings, lists, media, and links for student/teacher lesson markdown (LessonView, classroom mode, etc.).
 */
export function createLessonMarkdownViewComponents(
  safeStr: SafeStr
): Partial<Components> {
  const leftBlock: React.CSSProperties = { textAlign: "left" };

  const headingBase: React.CSSProperties = {
    ...leftBlock,
    color: "#111827",
    fontWeight: 900,
    lineHeight: 1.2,
    marginTop: 12,
    marginBottom: 8,
  };

  return {
    h1: ({ children, ...props }: any) => (
      <h1
        {...props}
        style={{
          ...(props.style || {}),
          ...headingBase,
          fontSize: "2.4rem",
          marginTop: 10,
        }}
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2
        {...props}
        style={{
          ...(props.style || {}),
          ...headingBase,
          fontSize: "2.0rem",
        }}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3
        {...props}
        style={{
          ...(props.style || {}),
          ...headingBase,
          fontSize: "1.65rem",
        }}
      >
        {children}
      </h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4
        {...props}
        style={{
          ...(props.style || {}),
          ...headingBase,
          fontSize: "1.35rem",
        }}
      >
        {children}
      </h4>
    ),
    ul: ({ ...props }: any) => (
      <ul
        style={{
          paddingLeft: 22,
          margin: "8px 0",
          listStyleType: "disc",
          textAlign: "left",
          lineHeight: 1.8,
        }}
        {...props}
      />
    ),
    ol: ({ ...props }: any) => (
      <ol
        style={{
          paddingLeft: 22,
          margin: "8px 0",
          listStyleType: "decimal",
          textAlign: "left",
          lineHeight: 1.8,
        }}
        {...props}
      />
    ),
    li: ({ ...props }: any) => (
      <li
        style={{
          margin: "4px 0",
          textAlign: "left",
        }}
        {...props}
      />
    ),
    blockquote: ({ ...props }: any) => (
      <blockquote
        {...props}
        style={{
          ...(props.style || {}),
          ...leftBlock,
          borderLeft: "4px solid rgba(59,130,246,0.35)",
          paddingLeft: 12,
          marginLeft: 0,
          color: "rgba(0,0,0,0.75)",
        }}
      />
    ),
    /** rehype-raw often emits block HTML as <div> / <section>, not <p> — needed for keyword highlight merge */
    div: ({ children, ...props }: any) => (
      <div
        {...props}
        style={{
          textAlign: "left",
          lineHeight: 1.7,
          ...(props.style || {}),
        }}
      >
        {children}
      </div>
    ),
    section: ({ children, ...props }: any) => (
      <section
        {...props}
        style={{
          textAlign: "left",
          lineHeight: 1.7,
          ...(props.style || {}),
        }}
      >
        {children}
      </section>
    ),
    img: ({ node, ...props }: any) => {
      const rawSrc = safeStr(props.src, "");
      if (!hasRenderableLessonImageSrc(rawSrc)) return null;

      const srcAbs = makeAbsoluteAssetUrl(rawSrc) ?? "";
      const resolved = srcAbs || rawSrc;
      if (!hasRenderableLessonImageSrc(resolved)) return null;

      const caption = props.title || "";

      return (
        <figure className="lesson-image-card-figure">
          <LessonImageFrame variant="secondary" lightboxSrc={resolved}>
            <img
              {...props}
              src={resolved}
              alt={props.alt || "Lesson image"}
              onError={hideBrokenLessonImage}
            />
            {caption ? <p className="lesson-image-caption">{caption}</p> : null}
          </LessonImageFrame>
        </figure>
      );
    },
    p: ({ node, children, ...props }: any) => {
      const hasImageChild = node?.children?.some(
        (child: any) => child.tagName === "img"
      );

      if (hasImageChild) {
        return <>{children}</>;
      }

      return (
        <p
          {...props}
          style={{
            textAlign: "left",
            margin: "0 0 0.85em",
            whiteSpace: "pre-wrap",
            lineHeight: 1.7,
            ...(props.style || {}),
          }}
        >
          {children}
        </p>
      );
    },
    a: ({ ...props }: any) => {
      const href = safeStr(props.href, "");
      const childStr =
        typeof props.children === "string"
          ? props.children
          : Array.isArray(props.children) &&
              typeof props.children[0] === "string"
            ? props.children[0]
            : "";
      const isVideoLink = childStr && String(childStr).startsWith("Video:") && href;
      if (isVideoLink) {
        const srcAbs = href.startsWith("http")
          ? href
          : (makeAbsoluteAssetUrl(href) ?? href);
        return (
          <div style={{ margin: "12px 0", textAlign: "center" }}>
            <video
              controls
              src={srcAbs}
              style={{
                width: "100%",
                maxWidth: "100%",
                borderRadius: 12,
                background: "#000",
              }}
            />
            {childStr !== "Video:" && (
              <div
                style={{ marginTop: 6, fontSize: "0.9rem", color: "#6b7280" }}
              >
                {childStr.replace(/^Video:\s*/, "")}
              </div>
            )}
          </div>
        );
      }
      return (
        <a {...props} target="_blank" rel="noopener noreferrer">
          {props.children}
        </a>
      );
    },
  };
}

const defaultSafeStrForSharedImg: SafeStr = (v, fallback = "") => String(v ?? fallback);
const _sharedLessonMarkdownView = createLessonMarkdownViewComponents(defaultSafeStrForSharedImg);

/**
 * Img renderer only — use as defaults for {@link LessonMarkdown} when no custom `components` are passed.
 */
export const lessonMarkdownImageComponentsOnly: Partial<Components> = {
  img: _sharedLessonMarkdownView.img as Components["img"],
};
