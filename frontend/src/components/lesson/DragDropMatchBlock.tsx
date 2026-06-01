import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { hasRenderableLessonImageSrc } from "../../constants/lessonImageDisplay";
import {
  buildTextToImageMainDropZones,
  detectTtiMainImageLayout,
  dragDropBlockHasRenderableMainImage,
  dragDropPairsHaveTargetImages,
  inferTtiMainImageLayoutFromUrl,
  isDragDropDiagramMode,
  isDragDropTextToImageMode,
  ttiBoxedZoneSizePct,
  type TtiMainImageBoxedLayout,
  type DragDropMatchAuthoringMatchMode,
  mergeDiagramZoneExplanation,
  parseDragDropDiagramImageFit,
  parseDragDropDiagramImagePosition,
  readDragDropPairAnswerImageUrl,
  readDragDropPairImageAlt,
  readDragDropPairTargetImageUrl,
  sanitizePlacedDiagramDropZones,
  type PlacedDragDropDiagramZone,
} from "../../utils/dragDropMatchDiagram";
import { resolveLessonStepImageSrc, resolveUploadedDiagramImageSrc } from "../../utils/assetUrl";
import { AnswerCardPreviewShell } from "./DragDropAnswerCardPreview";
import { AssessmentFeedback } from "./AssessmentFeedback";
import { TtiPlacedAnswerMagnify } from "./TtiPlacedAnswerMagnify";
import { hideBrokenLessonImage, LessonImageFrame } from "./LessonImageFrame";
import { LessonRichText } from "./LessonRichText";
import "./dragDropMatchBlock.css";
import "./dragDropTextToImageLayout.css";
import "./dragDropDiagramWorksheetLayout.css";

const DND_MIME = "application/x-letsrevise-dnd-pair";

export type DragDropMatchPair = {
  id: string;
  prompt: string;
  answer: string;
  explanation?: string;
  /** Optional thumbnail on draggable answer cards (text + diagram modes). */
  answerImageUrl?: string;
  /** Text-to-image mode: large target visual (falls back to answerImageUrl). */
  imageUrl?: string;
  imageAlt?: string;
};

function readDragPairId(e: React.DragEvent): string {
  return String(e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData("text/plain") || "").trim();
}

/** Canonical pair lookup by id (first match). Prefer over Map — duplicate pair ids would make Map overwrite entries. */
function findPairById(
  pairs: DragDropMatchPair[],
  pairId: string | null | undefined
): DragDropMatchPair | undefined {
  const id = String(pairId ?? "").trim();
  if (!id) return undefined;
  return pairs.find((p) => p.id === id);
}

function pairIdExists(pairs: DragDropMatchPair[], pairId: string): boolean {
  return pairs.some((p) => p.id === pairId);
}

/** Letter / number shown on diagram markers only (not the answer text). */
function diagramZoneMarkerLabel(zoneIndex: number): string {
  if (zoneIndex >= 0 && zoneIndex < 26) return String.fromCharCode(65 + zoneIndex);
  return String(zoneIndex + 1);
}

/** Short preview for on-diagram chips (keeps markers compact). */
function truncateDiagramChipText(text: string, maxChars = 22): string {
  const t = String(text ?? "").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(0, maxChars - 1))}…`;
}

/** Diagram zone chip: pair prompt/title when present; otherwise truncated answer (legacy pairs). */
function diagramZoneChipDisplay(pair: DragDropMatchPair): string {
  const prompt = String(pair.prompt ?? "").trim();
  const answer = String(pair.answer ?? "").trim();
  const src = prompt || answer || "(No text)";
  return truncateDiagramChipText(src);
}

/** Resolve display URL for pair thumbnails — tolerate resolvers that return null/undefined/non-string. */
function resolvePairThumbDisplaySrc(raw: string, resolveImg: (url: string) => string): string {
  const t = raw.trim();
  if (!t) return "";
  let resolved: unknown;
  try {
    resolved = resolveImg(t);
  } catch {
    resolved = "";
  }
  const s = typeof resolved === "string" ? resolved.trim() : "";
  return s || t;
}

const DDM_PAIR_IMG_DEBUG_KEY = "DDM_PAIR_IMG_DEBUG";

function ddmPairImgDebugEnabled(): boolean {
  return typeof window !== "undefined" && window.localStorage?.getItem(DDM_PAIR_IMG_DEBUG_KEY) === "1";
}

/**
 * Pair answer thumbnails: do not use {@link hideBrokenLessonImage} — it sets `display:none` on the &lt;img&gt;,
 * which makes cards look “text only” when the URL fails (blocked URL, transient CDN error, etc.).
 */
function onDdmPairAnswerThumbError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (ddmPairImgDebugEnabled()) {
    console.warn("[DragDropMatchBlock] answer thumb img onError", {
      src: img.currentSrc || img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    });
  }
  img.classList.add("drag-drop-match__answer-thumb--broken");
  img.alt = "Image failed to load";
}

/** Optional small thumbnail for answer cards — returns null when URL missing or not renderable. */
function renderAnswerThumbImg(
  pair: DragDropMatchPair,
  resolveImg: (url: string) => string,
  thumbExtraClass: string
): React.ReactNode {
  const raw = String(pair.answerImageUrl ?? "").trim();
  if (!raw || !hasRenderableLessonImageSrc(raw)) return null;
  const src = resolvePairThumbDisplaySrc(raw, resolveImg);
  if (!hasRenderableLessonImageSrc(src)) return null;
  return (
    <img
      className={`drag-drop-match__answer-thumb${thumbExtraClass ? ` ${thumbExtraClass}` : ""}`}
      src={src}
      alt=""
      onError={onDdmPairAnswerThumbError}
    />
  );
}

function pairAnswerPreviewImageSrc(
  pair: DragDropMatchPair,
  resolveImg: (url: string) => string
): string | null {
  const raw = String(pair.answerImageUrl ?? "").trim();
  if (!raw || !hasRenderableLessonImageSrc(raw)) return null;
  const src = resolvePairThumbDisplaySrc(raw, resolveImg);
  return hasRenderableLessonImageSrc(src) ? src : null;
}

function DragDropAnswerWithOptionalThumb({
  pair,
  resolveImg,
  textClassName,
  thumbExtraClass,
  enablePreviewZoom = false,
}: {
  pair: DragDropMatchPair;
  resolveImg: (url: string) => string;
  textClassName: string;
  thumbExtraClass: string;
  enablePreviewZoom?: boolean;
}): React.ReactElement {
  const thumb = renderAnswerThumbImg(pair, resolveImg, thumbExtraClass);
  const text = pair.answer || "(No text)";
  const previewSrc = enablePreviewZoom ? pairAnswerPreviewImageSrc(pair, resolveImg) : null;

  const inner = !thumb ? (
    <span {...(textClassName ? { className: textClassName } : {})}>{text}</span>
  ) : (
    <span className="drag-drop-match__answer-line">
      {thumb}
      <span {...(textClassName ? { className: textClassName } : {})}>{text}</span>
    </span>
  );

  return (
    <AnswerCardPreviewShell
      enablePreviewZoom={enablePreviewZoom}
      answerText={text}
      imageSrc={previewSrc}
    >
      {inner}
    </AnswerCardPreviewShell>
  );
}

export type DragDropMatchBlockData = {
  title?: string;
  intro?: string;
  instructions?: string;
  pairs?: DragDropMatchPair[];
  matchMode?: DragDropMatchAuthoringMatchMode;
  imageUrl?: string;
  imageFit?: "contain" | "cover";
  imagePosition?: "center center" | "center top" | "center bottom";
  dropZones?: Array<{
    id: string;
    x?: number;
    y?: number;
    correctPairId: string;
    explanation?: string;
  }>;
};

export type DragDropMatchBlockProps = {
  block: DragDropMatchBlockData;
  resolveImageUrl?: (url: string) => string;
};

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Placed card is identified by the source pair id (one answer card per pair). Target id = row id (text) or drop zone id (diagram). */
type Placements = Record<string, string | null>;

export function DragDropMatchBlock({ block, resolveImageUrl }: DragDropMatchBlockProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const textToImageRequested = isDragDropTextToImageMode(block.matchMode);
  const diagramMode =
    !textToImageRequested &&
    isDragDropDiagramMode(block.matchMode, {
      imageUrl: block.imageUrl,
      dropZones: block.dropZones,
    });
  const resolveImg = useMemo(
    () => resolveImageUrl ?? ((u: string) => u),
    [resolveImageUrl]
  );

  const pairs = useMemo(() => {
    const raw = Array.isArray(block.pairs) ? block.pairs : [];
    return raw
      .map((p, i) => {
        const thumb = readDragDropPairAnswerImageUrl(p);
        const targetImg = readDragDropPairTargetImageUrl(p);
        const alt = readDragDropPairImageAlt(p);
        return {
          id: String(p?.id ?? "").trim() || `row_${i + 1}`,
          prompt: String(p?.prompt ?? "").trim(),
          answer: String(p?.answer ?? "").trim(),
          explanation: p?.explanation != null ? String(p.explanation) : undefined,
          ...(thumb ? { answerImageUrl: thumb } : {}),
          ...(targetImg ? { imageUrl: targetImg } : {}),
          ...(alt ? { imageAlt: alt } : {}),
        };
      })
      .filter((p) => {
        if (diagramMode) return p.answer.length > 0;
        if (textToImageRequested) return Boolean(p.prompt || p.imageUrl || p.answer);
        return Boolean(p.prompt || p.answer);
      });
  }, [block.pairs, diagramMode, textToImageRequested]);

  const textToImageMainMode =
    textToImageRequested &&
    !diagramMode &&
    dragDropBlockHasRenderableMainImage(block, hasRenderableLessonImageSrc);

  const textToImagePerPairMode =
    textToImageRequested &&
    !diagramMode &&
    !textToImageMainMode &&
    dragDropPairsHaveTargetImages(pairs, hasRenderableLessonImageSrc);

  const textToImageMode = textToImageMainMode || textToImagePerPairMode;
  const worksheetImageMode = diagramMode || textToImageMainMode;
  const useTtiConceptBank = textToImageMainMode;
  const useTtiBoxedZones = textToImageMainMode;

  const [ttiMainImageLayout, setTtiMainImageLayout] = useState<TtiMainImageBoxedLayout | null>(
    null
  );

  useLayoutEffect(() => {
    if (typeof window === "undefined" || window.localStorage?.getItem(DDM_PAIR_IMG_DEBUG_KEY) !== "1") return;
    const thumbRows = pairs.map((p) => {
      const raw = String(p.answerImageUrl ?? "").trim();
      const src = raw ? resolvePairThumbDisplaySrc(raw, resolveImg) : "";
      return {
        id: p.id,
        answer: p.answer,
        answerImageUrl: p.answerImageUrl,
        rawTrimmed: raw,
        resolvedSrc: src,
        okRaw: hasRenderableLessonImageSrc(raw),
        okResolved: hasRenderableLessonImageSrc(src),
        rendersThumb: Boolean(raw && hasRenderableLessonImageSrc(raw) && hasRenderableLessonImageSrc(src)),
      };
    });
    console.log("[DragDropMatchBlock] normalized pairs + thumb pipeline", thumbRows);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const root = rootRef.current;
        const imgs = root?.querySelectorAll<HTMLImageElement>("img.drag-drop-match__answer-thumb") ?? [];
        const domInfo = Array.from(imgs).map((el) => {
          const cs = window.getComputedStyle(el);
          return {
            src: el.currentSrc || el.src,
            complete: el.complete,
            naturalWidth: el.naturalWidth,
            naturalHeight: el.naturalHeight,
            clientWidth: el.clientWidth,
            clientHeight: el.clientHeight,
            display: cs.display,
            visibility: cs.visibility,
            opacity: cs.opacity,
            brokenClass: el.classList.contains("drag-drop-match__answer-thumb--broken"),
          };
        });
        console.log("[DragDropMatchBlock] DOM .drag-drop-match__answer-thumb", {
          count: domInfo.length,
          imgs: domInfo,
        });
      });
    });
  }, [pairs, resolveImg]);

  const pairIds = useMemo(() => pairs.map((p) => p.id), [pairs]);

  const ttiBoxedLayout = useMemo((): TtiMainImageBoxedLayout | null => {
    if (!textToImageMainMode || pairIds.length !== 4) return null;
    if (ttiMainImageLayout) return ttiMainImageLayout;
    return inferTtiMainImageLayoutFromUrl(block.imageUrl) ?? "square-display";
  }, [textToImageMainMode, pairIds.length, ttiMainImageLayout, block.imageUrl]);

  const ttiOverlayBoxStyle = useMemo((): React.CSSProperties | undefined => {
    if (!useTtiBoxedZones) return undefined;
    const dims = ttiBoxedZoneSizePct(ttiBoxedLayout);
    if (!dims) return undefined;
    return {
      "--tti-boxed-w": `${dims.widthPct}%`,
      "--tti-boxed-h": `${dims.heightPct}%`,
    } as React.CSSProperties;
  }, [useTtiBoxedZones, ttiBoxedLayout]);

  const zones: PlacedDragDropDiagramZone[] = useMemo(() => {
    if (diagramMode) {
      return sanitizePlacedDiagramDropZones(block.dropZones, pairIds);
    }
    if (textToImageMainMode) {
      const placed = sanitizePlacedDiagramDropZones(block.dropZones, pairIds);
      if (placed.length > 0) return placed;
      return buildTextToImageMainDropZones(pairIds, ttiBoxedLayout);
    }
    return [];
  }, [diagramMode, textToImageMainMode, block.dropZones, pairIds, ttiBoxedLayout]);

  const [placements, setPlacements] = useState<Placements>({});
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const layoutResetKey = worksheetImageMode
    ? `${textToImageMainMode ? "tti-main" : "diagram"}|${String(block.imageUrl ?? "").trim()}|${pairIds.join("|")}|${zones.map((z) => `${z.id}:${z.x}:${z.y}:${z.correctPairId}`).join("|")}`
    : `${textToImageMode ? "tti" : "text"}|${pairIds.join("|")}`;

  useEffect(() => {
    setPlacements({});
    setSelectedSourceId(null);
    setChecked(false);
  }, [layoutResetKey]);

  const targetIds = useMemo(
    () => (worksheetImageMode ? zones.map((z) => z.id) : pairs.map((p) => p.id)),
    [worksheetImageMode, zones, pairs]
  );

  const poolIds = useMemo(() => {
    const used = new Set(
      Object.values(placements).filter((v): v is string => Boolean(v && String(v).trim()))
    );
    return pairs.map((p) => p.id).filter((id) => !used.has(id));
  }, [pairs, placements]);

  const [bankOrder, setBankOrder] = useState<string[]>([]);

  useEffect(() => {
    const ids = pairs.map((p) => p.id);
    setBankOrder(shuffleInPlace([...ids]));
  }, [layoutResetKey]);

  const bankDisplayIds = useMemo(() => {
    const poolSet = new Set(poolIds);
    return bankOrder.filter((id) => poolSet.has(id));
  }, [bankOrder, poolIds]);

  /** Worksheet modes: pair id → zone marker letter for placed cards (badges). */
  const diagramPairToMarker = useMemo(() => {
    const m = new Map<string, string>();
    if (!worksheetImageMode) return m;
    zones.forEach((z, zi) => {
      const pid = placements[z.id];
      if (pid) m.set(pid, diagramZoneMarkerLabel(zi));
    });
    return m;
  }, [worksheetImageMode, zones, placements]);

  const place = useCallback((targetId: string, sourceId: string) => {
    const sid = String(sourceId ?? "").trim();
    if (!sid) return;
    setPlacements((prev) => {
      const next = { ...prev } as Placements;
      for (const k of Object.keys(next)) {
        if (next[k] === sid) next[k] = null;
      }
      next[targetId] = sid;
      return next;
    });
    setSelectedSourceId(null);
    setChecked(false);
  }, []);

  const clearTarget = useCallback((targetId: string) => {
    setPlacements((prev) => {
      const next = { ...prev } as Placements;
      next[targetId] = null;
      return next;
    });
    setChecked(false);
  }, []);

  /** Clear whichever zone holds this answer card (diagram bank click). */
  const clearPlacementForPair = useCallback((pairId: string) => {
    const pid = String(pairId).trim();
    if (!pid) return;
    setPlacements((prev) => {
      const tid = Object.entries(prev).find(([, v]) => v === pid)?.[0];
      if (!tid) return prev;
      const next = { ...prev } as Placements;
      next[tid] = null;
      return next;
    });
    setChecked(false);
    setSelectedSourceId(null);
  }, []);

  const onPickFromPool = useCallback(
    (sourceId: string) => {
      if (selectedSourceId === sourceId) {
        setSelectedSourceId(null);
        return;
      }
      setSelectedSourceId(sourceId);
      setChecked(false);
    },
    [selectedSourceId]
  );

  const onDiagramBankCardClick = useCallback(
    (sid: string) => {
      if (diagramPairToMarker.has(sid)) {
        clearPlacementForPair(sid);
        return;
      }
      onPickFromPool(sid);
    },
    [diagramPairToMarker, clearPlacementForPair, onPickFromPool]
  );

  const onTargetClick = useCallback(
    (targetId: string) => {
      const placed = placements[targetId] ?? null;
      if (placed) {
        clearTarget(targetId);
        return;
      }
      if (selectedSourceId) {
        place(targetId, selectedSourceId);
      }
    },
    [placements, selectedSourceId, place, clearTarget]
  );

  const onCheck = () => {
    setChecked(true);
  };

  /** Runs when Check is used — logs runtime grading inputs before paint (set localStorage.DEBUG_DDM = "1"). */
  useLayoutEffect(() => {
    if (!diagramMode || !checked) return;
    if (typeof window === "undefined" || window.localStorage.getItem("DEBUG_DDM") !== "1") return;

    const rows = zones.map((zone, zi) => {
      const placedPairId = placements[zone.id] ?? null;
      const corr = zone.correctPairId;
      const expectedPair = findPairById(pairs, corr);
      const placedPair = findPairById(pairs, placedPairId);
      const isCorrect = Boolean(corr && placedPairId && placedPairId === corr);
      return {
        letter: diagramZoneMarkerLabel(zi),
        zoneId: zone.id,
        correctPairId: corr,
        placedPairId,
        expectedAnswer: expectedPair?.answer,
        placedAnswer: placedPair?.answer,
        isCorrect,
      };
    });

    console.log("[DragDropMatchBlock] raw block.dropZones (from props)", block.dropZones);
    console.log("[DragDropMatchBlock] sanitized zones (runtime)", zones);
    console.log("[DragDropMatchBlock] pairs (runtime order)", pairs);
    console.log("[DragDropMatchBlock] placements", placements);
    console.log("[DragDropMatchBlock] per-zone grading — feedback uses pairs.find(p => p.id === zone.correctPairId)");
    console.table(rows);
  }, [diagramMode, checked, zones, pairs, placements, block.dropZones]);

  const onReset = () => {
    setPlacements({});
    setSelectedSourceId(null);
    setChecked(false);
    setBankOrder((prev) => {
      const ids = pairs.map((p) => p.id);
      if (ids.length) return shuffleInPlace([...ids]);
      return prev;
    });
  };

  /** Full-area overlay catcher only while dragging so diagram image clicks still work when idle. */
  const [diagramDragActive, setDiagramDragActive] = useState(false);
  const diagramOverlayRef = useRef<HTMLDivElement | null>(null);

  const onDragStartPool = (e: React.DragEvent, sourceId: string) => {
    const sid = String(sourceId).trim();
    e.dataTransfer.setData(DND_MIME, sid);
    e.dataTransfer.setData("text/plain", sid);
    e.dataTransfer.effectAllowed = "move";
    if (worksheetImageMode) setDiagramDragActive(true);
  };

  const onDragEndPool = () => {
    setDiagramDragActive(false);
  };

  useEffect(() => {
    const end = () => setDiagramDragActive(false);
    window.addEventListener("dragend", end);
    return () => window.removeEventListener("dragend", end);
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDropOnTarget = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const sourceId = readDragPairId(e);
      if (typeof window !== "undefined" && window.localStorage?.getItem("DEBUG_DDM") === "1") {
        console.log("[DragDropMatch diagram] drop on zone button", { zoneId: targetId, sourceId });
      }
      if (!sourceId || !pairIdExists(pairs, sourceId)) return;
      place(targetId, sourceId);
    },
    [pairs, place]
  );

  const onDropDiagramOverlayNearest = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const sourceId = readDragPairId(e);
      if (typeof window !== "undefined" && window.localStorage?.getItem("DEBUG_DDM") === "1") {
        console.log("[DragDropMatch diagram] drop on overlay (nearest zone)", { sourceId, clientX: e.clientX, clientY: e.clientY });
      }
      if (!sourceId || !pairIdExists(pairs, sourceId)) return;
      const overlayEl = diagramOverlayRef.current;
      if (!overlayEl || zones.length === 0) return;
      const rect = overlayEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      let bestId: string | null = null;
      let bestD = Infinity;
      for (const z of zones) {
        const zx = typeof z.x === "number" && Number.isFinite(z.x) ? z.x : 0;
        const zy = typeof z.y === "number" && Number.isFinite(z.y) ? z.y : 0;
        const dx = px - zx;
        const dy = py - zy;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          bestId = z.id;
        }
      }
      if (bestId) place(bestId, sourceId);
    },
    [pairs, place, zones]
  );

  const title = String(block.title ?? "").trim();
  const intro = String(block.intro ?? "").trim();
  const instructions = String(block.instructions ?? "").trim();

  const imgRaw = worksheetImageMode ? String(block.imageUrl ?? "").trim() : "";
  const imgDisplaySrc = imgRaw ? resolveImg(imgRaw) || imgRaw : "";
  /** TTI main: use `.display.png` so overlay coords match the 600×600 artboard (SS1/SS2). */
  const imgResolved = imgRaw
    ? textToImageMainMode
      ? imgDisplaySrc
      : resolveUploadedDiagramImageSrc(imgDisplaySrc)
    : "";
  const imgLightboxSrc = imgRaw
    ? textToImageMainMode
      ? resolveUploadedDiagramImageSrc(imgDisplaySrc)
      : imgResolved
    : "";
  const diagramImageFit = parseDragDropDiagramImageFit(block.imageFit) ?? "contain";
  const diagramImagePosition =
    parseDragDropDiagramImagePosition(block.imagePosition) ?? "center center";
  const showWorksheetImg =
    worksheetImageMode &&
    hasRenderableLessonImageSrc(imgRaw) &&
    hasRenderableLessonImageSrc(imgResolved);

  useEffect(() => {
    if (!textToImageMainMode) {
      setTtiMainImageLayout(null);
    }
  }, [textToImageMainMode]);

  const onTtiMainDiagramImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (!textToImageMainMode) return;
      const img = e.currentTarget;
      setTtiMainImageLayout(detectTtiMainImageLayout(img.naturalWidth, img.naturalHeight));
    },
    [textToImageMainMode]
  );

  if (pairs.length === 0) {
    return (
      <div className="drag-drop-match">
        <p className="drag-drop-match__empty">This activity has no matching pairs yet.</p>
      </div>
    );
  }

  const worksheetZonesEmptyOrMissing = worksheetImageMode && showWorksheetImg && zones.length === 0;

  return (
    <section
      ref={rootRef}
      className={
        "drag-drop-match" +
        (textToImageMode ? " drag-drop-match--text-to-image text-to-image" : "") +
        (textToImageMainMode ? " drag-drop-match--tti-main" : "") +
        (diagramMode ? " drag-drop-match--diagram" : "")
      }
      aria-label={title || "Drag and drop match activity"}
    >
      <div className="drag-drop-match__hero">
        <div className="drag-drop-match__hero-main">
          <div className="drag-drop-match__big-icon" aria-hidden="true">
            🧩
          </div>
          <div>
            <div className="drag-drop-match__header">
              {title ? <h3 className="drag-drop-match__title">{title}</h3> : null}
            </div>
            <span className="drag-drop-match__tag">
              {diagramMode
                ? "Diagram drag and drop"
                : textToImageMode
                  ? "Text to image match"
                  : "Drag and Drop Activity"}
            </span>
          </div>
        </div>
      </div>
      <LessonRichText text={intro} className="drag-drop-match__intro" />
      <LessonRichText text={instructions} className="drag-drop-match__instruction" />

      {textToImagePerPairMode ? (
        <div
          className="drag-drop-match__tti-grid"
          data-testid="drag-drop-tti-grid"
          data-tti-layout="clues-left-v1"
        >
          <div className="drag-drop-match__tti-targets-column">
            <div className="drag-drop-match__panel-title drag-drop-match__panel-title--tti-targets">
              🖼️ Match to the image
            </div>
            <div className="drag-drop-match__tti-targets image-target-list" role="list">
              {pairs.map((row) => {
                const sourcePlaced = placements[row.id] ?? null;
                const card = sourcePlaced ? findPairById(pairs, sourcePlaced) : null;
                const isCorrect = checked && sourcePlaced != null && sourcePlaced === row.id;
                const isWrong = checked && sourcePlaced != null && sourcePlaced !== row.id;
                const isEmpty = checked && sourcePlaced == null;
                const targetClass =
                  "drag-drop-match__tti-drop" +
                  (isCorrect ? " drag-drop-match__tti-drop--correct" : "") +
                  (isWrong ? " drag-drop-match__tti-drop--incorrect" : "") +
                  (selectedSourceId && !sourcePlaced ? " drag-drop-match__tti-drop--active" : "");
                const imgRaw = String(row.imageUrl ?? "").trim();
                const imgResolvedTti = imgRaw
                  ? resolveLessonStepImageSrc(resolveImg(imgRaw))
                  : "";
                const showTtiImg =
                  hasRenderableLessonImageSrc(imgRaw) &&
                  hasRenderableLessonImageSrc(imgResolvedTti);
                const labelText = String(row.answer ?? "").trim();

                return (
                  <div
                    className="drag-drop-match__tti-target image-target-card"
                    key={row.id}
                    role="listitem"
                  >
                    <div className="drag-drop-match__tti-image-wrap">
                      {showTtiImg ? (
                        <LessonImageFrame
                          className="drag-drop-match__tti-frame"
                          variant="primary"
                          lightboxSrc={imgResolvedTti}
                        >
                          <img
                            className="drag-drop-match__tti-image"
                            src={imgResolvedTti}
                            alt={row.imageAlt || labelText || "Biology diagram"}
                          />
                        </LessonImageFrame>
                      ) : (
                        <div className="drag-drop-match__tti-image-placeholder" role="status">
                          No image for this target
                        </div>
                      )}
                    </div>
                    {checked && labelText ? (
                      <div className="drag-drop-match__tti-revealed-label">{labelText}</div>
                    ) : null}
                    <button
                      type="button"
                      className={targetClass}
                      onClick={() => onTargetClick(row.id)}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDropOnTarget(e, row.id)}
                      aria-label={
                        sourcePlaced
                          ? `Remove ${card?.prompt ?? "placed card"} from image target`
                          : `Drop concept onto image target ${row.imageAlt || labelText || row.id}`
                      }
                    >
                      {sourcePlaced && card ? (
                        <span className="drag-drop-match__tti-placed">
                          <span className="drag-drop-match__tti-placed-text">
                            {card.prompt || card.answer}
                          </span>
                          {checked && isCorrect ? (
                            <span className="drag-drop-match__status drag-drop-match__status--ok">
                              Correct
                            </span>
                          ) : null}
                          {checked && (isWrong || isEmpty) ? (
                            <span className="drag-drop-match__status drag-drop-match__status--bad">
                              Try again
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="drag-drop-match__tti-drop-empty">
                          {selectedSourceId ? "Tap to place selected concept" : "Drop or tap to place concept"}
                        </span>
                      )}
                    </button>
                    {checked ? (
                      <AssessmentFeedback
                        className="drag-drop-match__assessment-feedback"
                        status={
                          isCorrect ? "correct" : isWrong || isEmpty ? "incorrect" : undefined
                        }
                        answer={labelText || undefined}
                        answerLabel="Correct label"
                        explanation={row.explanation}
                        explanationLabel="Explanation"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="drag-drop-match__tti-concept-column concept-card-column">
            <div className="drag-drop-match__panel-title drag-drop-match__panel-title--tti-cards">
              📝 Concept cards
            </div>
            <div
              className="drag-drop-match__answers drag-drop-match__answers--tti"
              onDragOver={onDragOver}
              onDrop={(e) => {
                e.preventDefault();
                const sourceId = readDragPairId(e);
                if (!sourceId) return;
                for (const tid of targetIds) {
                  if (placements[tid] === sourceId) {
                    clearTarget(tid);
                    return;
                  }
                }
              }}
            >
              <div className="drag-drop-match__card-list drag-drop-match__card-list--tti">
                {bankDisplayIds.length === 0 ? (
                  <p className="drag-drop-match__pool-empty">All cards placed</p>
                ) : (
                  bankDisplayIds.map((sid, index) => {
                    const p = findPairById(pairs, sid);
                    if (!p) return null;
                    const selected = selectedSourceId === sid;
                    const tone = index % 6;
                    return (
                      <button
                        key={sid}
                        type="button"
                        draggable
                        onDragStart={(e) => onDragStartPool(e, sid)}
                        onDragEnd={onDragEndPool}
                        onClick={() => onPickFromPool(sid)}
                        className={
                          "drag-drop-match__card drag-drop-match__card--tone-" +
                          tone +
                          (selected ? " drag-drop-match__card--selected" : "") +
                          " drag-drop-match__card--tti-prompt"
                        }
                        aria-pressed={selected}
                        aria-label={`Select concept: ${p.prompt || p.answer || "card"}`}
                      >
                        <AnswerCardPreviewShell
                          enablePreviewZoom
                          answerText={p.prompt || p.answer || "(No text)"}
                        >
                          <span className="drag-drop-match__card-text drag-drop-match__card-text--tti">
                            {p.prompt || "(No text)"}
                          </span>
                        </AnswerCardPreviewShell>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : worksheetImageMode ? (
        <div
          className="drag-drop-match__diagram-worksheet"
          data-ddm-diagram-layout="side-by-side-v1"
          data-testid={
            useTtiConceptBank ? "drag-drop-tti-main-worksheet" : "drag-drop-diagram-worksheet"
          }
        >
          <div
            className={
              "drag-drop-match__panel-title drag-drop-match__panel-title--diagram" +
              (useTtiConceptBank ? " drag-drop-match__panel-title--tti-targets" : "")
            }
          >
            {useTtiConceptBank ? "🖼️ Match to the image" : "📍 Diagram — drop zones"}
          </div>
          <div className="drag-drop-match__diagram-worksheet-stage">
          <div className="drag-drop-match__diagram-panel">
            {showWorksheetImg ? (
              <>
                <div className="drag-drop-match__diagram-visual">
                  <div className="drag-drop-match__diagram-image-container">
                    <LessonImageFrame
                      className="drag-drop-match__diagram-frame"
                      variant="primary"
                      lightboxSrc={imgLightboxSrc}
                    >
                      <img
                        className="drag-drop-match__diagram-img"
                        src={imgResolved}
                        alt={title || "Diagram for drag and drop activity"}
                        style={{
                          objectFit: diagramImageFit,
                          objectPosition: diagramImagePosition,
                        }}
                        onLoad={textToImageMainMode ? onTtiMainDiagramImageLoad : undefined}
                        onError={hideBrokenLessonImage}
                      />
                    </LessonImageFrame>
                    {zones.length > 0 ? (
                      <div
                        ref={diagramOverlayRef}
                        className="drag-drop-match__diagram-overlay"
                        style={ttiOverlayBoxStyle}
                      >
                          {diagramDragActive ? (
                            <div
                              className="drag-drop-match__diagram-overlay-catcher"
                              aria-hidden="true"
                              onDragOver={onDragOver}
                              onDrop={onDropDiagramOverlayNearest}
                            />
                          ) : null}
                          {zones.map((zone, zi) => {
                            const sourcePlaced = placements[zone.id] ?? null;
                            const card = sourcePlaced ? findPairById(pairs, sourcePlaced) : null;
                            const corr = zone.correctPairId;
                            const correctPair = corr ? findPairById(pairs, corr) : null;
                            const placedMagnifyExplanation = mergeDiagramZoneExplanation(
                              zone.explanation,
                              correctPair?.explanation
                            );
                            const mark = diagramZoneMarkerLabel(zi);
                            const isCorrect =
                              checked && sourcePlaced != null && sourcePlaced === corr;
                            const isWrong = checked && sourcePlaced != null && sourcePlaced !== corr;
                            const isEmpty = checked && sourcePlaced == null;
                            const zxPct =
                              typeof zone.x === "number" && Number.isFinite(zone.x)
                                ? Math.min(100, Math.max(0, zone.x))
                                : 50;
                            const chipGrowRight = zxPct < 50;
                            const targetClass =
                              "drag-drop-match__diagram-zone" +
                              (useTtiBoxedZones ? " drag-drop-match__diagram-zone--tti-boxed" : "") +
                              (sourcePlaced ? " drag-drop-match__diagram-zone--filled" : "") +
                              (sourcePlaced ? ` drag-drop-match__diagram-zone--chip-tone-${zi % 6}` : "") +
                              (!useTtiBoxedZones && sourcePlaced
                                ? chipGrowRight
                                  ? " drag-drop-match__diagram-zone--chip-grow-right"
                                  : " drag-drop-match__diagram-zone--chip-grow-left"
                                : "") +
                              (isCorrect ? " drag-drop-match__diagram-zone--correct" : "") +
                              (isWrong || isEmpty ? " drag-drop-match__diagram-zone--incorrect" : "") +
                              (selectedSourceId && !sourcePlaced
                                ? " drag-drop-match__diagram-zone--active"
                                : "") +
                              (sourcePlaced && !checked
                                ? " drag-drop-match__diagram-zone--has-placement"
                                : "");
                            const chipLabel = card ? diagramZoneChipDisplay(card) : "";
                            return (
                              <button
                                key={zone.id}
                                type="button"
                                className={targetClass}
                                style={{
                                  left: `${zone.x}%`,
                                  top: `${zone.y}%`,
                                  ...(sourcePlaced && card && !useTtiBoxedZones
                                    ? {
                                        maxWidth: chipGrowRight
                                          ? `min(260px, calc(100% - ${zxPct}% - 10px))`
                                          : `min(260px, calc(${zxPct}% - 10px))`,
                                      }
                                    : {}),
                                }}
                                onClick={() => onTargetClick(zone.id)}
                                onDragEnter={(e) => {
                                  e.preventDefault();
                                }}
                                onDragOver={onDragOver}
                                onDrop={(e) => onDropOnTarget(e, zone.id)}
                                aria-label={
                                  sourcePlaced && card
                                    ? `Zone ${mark}: ${card.answer || "answer"}. Click to remove, or drag another card to replace.`
                                    : useTtiBoxedZones
                                      ? `Drop concept in box ${mark}`
                                      : useTtiConceptBank
                                        ? `Drop concept on marker ${mark}`
                                        : `Drop answer on marker ${mark}`
                                }
                              >
                                {sourcePlaced && card ? (
                                  useTtiBoxedZones ? (
                                    <span className="drag-drop-match__diagram-zone-boxed-fill">
                                      <span className="drag-drop-match__diagram-zone-boxed-text">
                                        {chipLabel}
                                      </span>
                                      {checked ? (
                                        isCorrect ? (
                                          <>
                                            <span
                                              className="drag-drop-match__diagram-zone-boxed-status drag-drop-match__diagram-zone-boxed-status--ok"
                                              aria-hidden="true"
                                            >
                                              ✓
                                            </span>
                                            <TtiPlacedAnswerMagnify
                                              conceptCard={String(card.prompt ?? "")}
                                              answer={String(correctPair?.answer ?? "")}
                                              explanation={placedMagnifyExplanation}
                                              markerLabel={mark}
                                            />
                                          </>
                                        ) : isWrong ? (
                                          <span
                                            className="drag-drop-match__diagram-zone-boxed-status drag-drop-match__diagram-zone-boxed-status--bad"
                                            aria-hidden="true"
                                          >
                                            ✗
                                          </span>
                                        ) : null
                                      ) : null}
                                    </span>
                                  ) : (
                                  <span className="drag-drop-match__diagram-zone-chip">
                                    <span
                                      className="drag-drop-match__diagram-zone-chip-mark"
                                      aria-hidden="true"
                                    >
                                      {mark}
                                    </span>
                                    {(() => {
                                      const thumb = renderAnswerThumbImg(
                                        card,
                                        resolveImg,
                                        "drag-drop-match__answer-thumb--chip"
                                      );
                                      if (!thumb) return null;
                                      return (
                                        <span className="drag-drop-match__diagram-zone-chip-thumb-shell">
                                          {thumb}
                                        </span>
                                      );
                                    })()}
                                    <span className="drag-drop-match__diagram-zone-chip-text">
                                      {chipLabel}
                                    </span>
                                    {checked ? (
                                      isCorrect ? (
                                        <span
                                          className="drag-drop-match__diagram-zone-chip-status drag-drop-match__diagram-zone-chip-status--ok"
                                          aria-hidden="true"
                                        >
                                          ✓
                                        </span>
                                      ) : isWrong || isEmpty ? (
                                        <span
                                          className="drag-drop-match__diagram-zone-chip-status drag-drop-match__diagram-zone-chip-status--bad"
                                          aria-hidden="true"
                                        >
                                          ✗
                                        </span>
                                      ) : null
                                    ) : (
                                      <span
                                        className="drag-drop-match__diagram-zone-chip-clear-hint"
                                        aria-hidden="true"
                                      >
                                        ×
                                      </span>
                                    )}
                                  </span>
                                  )
                                ) : useTtiBoxedZones ? (
                                  checked && (isCorrect || isWrong || isEmpty) ? (
                                    <span className="drag-drop-match__diagram-zone-boxed-status-only">
                                      {isCorrect ? (
                                        <span
                                          className="drag-drop-match__diagram-zone-boxed-status drag-drop-match__diagram-zone-boxed-status--ok"
                                          aria-hidden="true"
                                        >
                                          ✓
                                        </span>
                                      ) : (
                                        <span
                                          className="drag-drop-match__diagram-zone-boxed-status drag-drop-match__diagram-zone-boxed-status--bad"
                                          aria-hidden="true"
                                        >
                                          ✗
                                        </span>
                                      )}
                                    </span>
                                  ) : null
                                ) : (
                                  <span className="drag-drop-match__diagram-zone-marker-inner">
                                    <span
                                      className="drag-drop-match__diagram-zone-letter"
                                      aria-hidden="true"
                                    >
                                      {mark}
                                    </span>
                                    {checked ? (
                                      isCorrect ? (
                                        <span className="drag-drop-match__diagram-zone-status drag-drop-match__diagram-zone-status--ok">
                                          ✓
                                        </span>
                                      ) : isWrong || isEmpty ? (
                                        <span className="drag-drop-match__diagram-zone-status drag-drop-match__diagram-zone-status--bad">
                                          ✗
                                        </span>
                                      ) : null
                                    ) : null}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                </div>
                {zones.length > 0 ? (
                  <div className="drag-drop-match__diagram-summary drag-drop-match__diagram-summary--under-image">
                    <div className="drag-drop-match__diagram-summary-heading">
                      {useTtiConceptBank ? "Correct labels" : "Your labels"}
                    </div>
                    <ul
                      className="drag-drop-match__diagram-summary-list"
                      role="list"
                      aria-label={useTtiConceptBank ? "Correct labels" : "Your labels"}
                    >
                      {zones.map((zone, zi) => {
                        const mark = diagramZoneMarkerLabel(zi);
                        const sourcePlaced = placements[zone.id] ?? null;
                        const card = sourcePlaced ? findPairById(pairs, sourcePlaced) : null;
                        const corr = zone.correctPairId;
                        const correctPair = corr ? findPairById(pairs, corr) : undefined;
                        const mergedExpl = mergeDiagramZoneExplanation(
                          zone.explanation,
                          correctPair?.explanation
                        );
                        const isCorrect =
                          Boolean(corr) && checked && sourcePlaced != null && sourcePlaced === corr;
                        const isWrong =
                          Boolean(corr) && checked && sourcePlaced != null && sourcePlaced !== corr;
                        const isEmptyChecked = checked && sourcePlaced == null;
                        const summaryStatus =
                          checked && corr ? (isCorrect ? "Correct" : "Try again") : null;
                        return (
                          <li key={zone.id} className="drag-drop-match__diagram-summary-item" role="listitem">
                            <div className="drag-drop-match__diagram-summary-main">
                              <span className="drag-drop-match__diagram-summary-mark">{mark}</span>
                              <span className="drag-drop-match__diagram-summary-arrow" aria-hidden="true">
                                →
                              </span>
                              <span className="drag-drop-match__diagram-summary-text">
                                {(() => {
                                  if (!card) {
                                    return (
                                      <span className="drag-drop-match__diagram-summary-placeholder">
                                        Not placed yet
                                      </span>
                                    );
                                  }
                                  const thumb = renderAnswerThumbImg(
                                    card,
                                    resolveImg,
                                    "drag-drop-match__answer-thumb--summary"
                                  );
                                  if (card.answer) {
                                    return (
                                      <span className="drag-drop-match__diagram-summary-answer">
                                        {thumb}
                                        <span>{card.answer}</span>
                                      </span>
                                    );
                                  }
                                  if (thumb) {
                                    return (
                                      <span className="drag-drop-match__diagram-summary-answer">{thumb}</span>
                                    );
                                  }
                                  return (
                                    <span className="drag-drop-match__diagram-summary-placeholder">
                                      Not placed yet
                                    </span>
                                  );
                                })()}
                              </span>
                              {summaryStatus ? (
                                <span
                                  className={
                                    "drag-drop-match__diagram-summary-status" +
                                    (isCorrect
                                      ? " drag-drop-match__diagram-summary-status--ok"
                                      : " drag-drop-match__diagram-summary-status--bad")
                                  }
                                >
                                  {summaryStatus}
                                </span>
                              ) : null}
                            </div>
                            {checked && corr ? (
                              <AssessmentFeedback
                                className="drag-drop-match__assessment-feedback drag-drop-match__assessment-feedback--diagram-row"
                                status={
                                  isCorrect ? "correct" : isWrong || isEmptyChecked ? "incorrect" : undefined
                                }
                                answer={correctPair?.answer}
                                answerLabel="Correct answer"
                                explanation={mergedExpl}
                                explanationLabel="Explanation"
                              />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {worksheetZonesEmptyOrMissing ? (
                  <p className="drag-drop-match__diagram-hint" role="status">
                    {useTtiConceptBank
                      ? "This activity has no drop targets yet. Add matching pairs in the lesson editor."
                      : "This diagram has no drop zones yet. Your teacher can add targets in the lesson editor."}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="drag-drop-match__diagram-hint" role="status">
                Add a diagram image in the lesson editor to use diagram mode.
              </p>
            )}
          </div>

          <div className="drag-drop-match__diagram-bank">
            <div
              className={
                "drag-drop-match__panel-title drag-drop-match__panel-title--answers" +
                (useTtiConceptBank ? " drag-drop-match__panel-title--tti-cards" : "")
              }
            >
              {useTtiConceptBank ? "📝 Concept cards" : "🧩 Answer cards"}
            </div>
            <div
              className={
                "drag-drop-match__answers" +
                (useTtiConceptBank
                  ? " drag-drop-match__answers--tti"
                  : " drag-drop-match__answers--diagram")
              }
              onDragOver={onDragOver}
              onDrop={(e) => {
                e.preventDefault();
                const sourceId = readDragPairId(e);
                if (!sourceId) return;
                for (const tid of targetIds) {
                  if (placements[tid] === sourceId) {
                    clearTarget(tid);
                    return;
                  }
                }
              }}
            >
              <div
                className={
                  "drag-drop-match__card-list" +
                  (useTtiConceptBank
                    ? " drag-drop-match__card-list--tti"
                    : " drag-drop-match__card-list--diagram-wrap")
                }
              >
                {useTtiConceptBank
                  ? bankDisplayIds.map((sid, index) => {
                      const p = findPairById(pairs, sid);
                      if (!p) return null;
                      const placedMark = diagramPairToMarker.get(sid);
                      const isPlaced = Boolean(placedMark);
                      const selected = selectedSourceId === sid;
                      const tone = index % 6;
                      return (
                        <button
                          key={sid}
                          type="button"
                          draggable={!isPlaced}
                          onDragStart={
                            isPlaced ? undefined : (e: React.DragEvent) => onDragStartPool(e, sid)
                          }
                          onDragEnd={onDragEndPool}
                          onClick={() => onDiagramBankCardClick(sid)}
                          className={
                            "drag-drop-match__card drag-drop-match__card--tone-" +
                            tone +
                            (selected ? " drag-drop-match__card--selected" : "") +
                            (isPlaced ? " drag-drop-match__card--diagram-placed" : "") +
                            " drag-drop-match__card--tti-prompt"
                          }
                          aria-pressed={selected}
                          aria-label={
                            isPlaced
                              ? `Concept placed at ${placedMark}: ${p.prompt || p.answer}. Click to remove placement.`
                              : `Select concept: ${p.prompt || p.answer || "card"}`
                          }
                        >
                          <AnswerCardPreviewShell
                            enablePreviewZoom
                            answerText={p.prompt || p.answer || "(No text)"}
                          >
                            <span className="drag-drop-match__card-text drag-drop-match__card-text--tti">
                              {p.prompt || "(No text)"}
                            </span>
                          </AnswerCardPreviewShell>
                          {isPlaced ? (
                            <span className="drag-drop-match__card-placed-badge">Placed: {placedMark}</span>
                          ) : null}
                        </button>
                      );
                    })
                  : bankOrder
                      .filter((sid) => pairIdExists(pairs, sid))
                      .map((sid, index) => {
                        const p = findPairById(pairs, sid);
                        if (!p) return null;
                        const placedMark = diagramPairToMarker.get(sid);
                        const isPlaced = Boolean(placedMark);
                        const zoneForCard = zones.find((z) => placements[z.id] === sid);
                        const corrId = zoneForCard?.correctPairId;
                        const isCorrect = checked && isPlaced && Boolean(corrId) && corrId === sid;
                        const isWrong = checked && isPlaced && Boolean(corrId) && corrId !== sid;
                        const selected = selectedSourceId === sid;
                        const tone = index % 6;
                        return (
                          <button
                            key={sid}
                            type="button"
                            draggable={!isPlaced}
                            onDragStart={
                              isPlaced ? undefined : (e: React.DragEvent) => onDragStartPool(e, sid)
                            }
                            onDragEnd={onDragEndPool}
                            onClick={() => onDiagramBankCardClick(sid)}
                            className={
                              "drag-drop-match__card drag-drop-match__card--tone-" +
                              tone +
                              (selected ? " drag-drop-match__card--selected" : "") +
                              (isPlaced ? " drag-drop-match__card--diagram-placed" : "") +
                              (isCorrect ? " drag-drop-match__card--diagram-correct" : "") +
                              (isWrong ? " drag-drop-match__card--diagram-incorrect" : "")
                            }
                            aria-pressed={selected}
                            aria-label={
                              isPlaced
                                ? `Answer placed at ${placedMark}: ${p.answer}. Click to remove placement.`
                                : `Select answer: ${p.answer}`
                            }
                          >
                            <span className="drag-drop-match__card-inner">
                              <DragDropAnswerWithOptionalThumb
                                pair={p}
                                resolveImg={resolveImg}
                                textClassName="drag-drop-match__card-text"
                                thumbExtraClass="drag-drop-match__answer-thumb--diagram-card"
                                enablePreviewZoom
                              />
                              {isPlaced ? (
                                <span className="drag-drop-match__card-placed-badge">
                                  Placed: {placedMark}
                                </span>
                              ) : null}
                              {checked && isPlaced && (isCorrect || isWrong) ? (
                                <span
                                  className={
                                    "drag-drop-match__card-check" +
                                    (isCorrect
                                      ? " drag-drop-match__card-check--ok"
                                      : " drag-drop-match__card-check--bad")
                                  }
                                >
                                  {isCorrect ? "Correct" : "Try again"}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
              </div>
            </div>
          </div>
          </div>

          {diagramImageFit === "cover" ? (
            <p className="drag-drop-match__diagram-hint" role="status">
              Cover mode may crop edges and shift visual alignment. Re-check drop zone positions or upload a tightly
              cropped image for best accuracy.
            </p>
          ) : null}

          {typeof window !== "undefined" &&
            window.localStorage?.getItem("DEBUG_DDM") === "1" &&
            showWorksheetImg &&
            zones.length > 0 ? (
              <div
                className="drag-drop-match__ddm-debug-panel"
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 8,
                  border: "2px dashed #f97316",
                  background: "#fff7ed",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                  lineHeight: 1.45,
                  color: "#0f172a",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  DDM debug — Zone D row highlighted (localStorage.DEBUG_DDM = 1)
                </div>
                {zones.map((zone, zi) => {
                  const mark = diagramZoneMarkerLabel(zi);
                  const placedPairId = placements[zone.id] ?? null;
                  const corr = zone.correctPairId;
                  const expectedPair = findPairById(pairs, corr);
                  const placedPair = findPairById(pairs, placedPairId);
                  const isD = mark === "D";
                  return (
                    <div
                      key={`ddm-dbg-${zone.id}-${zi}`}
                      style={{
                        marginTop: 4,
                        padding: 6,
                        borderRadius: 6,
                        background: isD ? "rgba(251,146,60,0.28)" : "rgba(148,163,184,0.12)",
                        border: isD ? "1px solid #ea580c" : "1px solid #cbd5e1",
                      }}
                    >
                      <strong>{mark}</strong> zone.id=<code>{zone.id}</code>
                      <br />
                      correctPairId=<code>{corr}</code> → expected answer:{" "}
                      <code>{expectedPair?.answer ?? "(none)"}</code>
                      <br />
                      placedPairId=<code>{placedPairId ?? "null"}</code> → placed answer:{" "}
                      <code>{placedPair?.answer ?? "(none)"}</code>
                    </div>
                  );
                })}
              </div>
            ) : null}
        </div>
      ) : (
        <div className="drag-drop-match__grid">
          <div>
            <div className="drag-drop-match__panel-title drag-drop-match__panel-title--targets">
              🎯 Drop your answers here
            </div>
            <div className="drag-drop-match__targets" role="list">
              {pairs.map((row) => {
                const sourcePlaced = placements[row.id] ?? null;
                const card = sourcePlaced ? findPairById(pairs, sourcePlaced) : null;
                const isCorrect = checked && sourcePlaced != null && sourcePlaced === row.id;
                const isWrong = checked && sourcePlaced != null && sourcePlaced !== row.id;
                const isEmpty = checked && sourcePlaced == null;
                const targetClass =
                  "drag-drop-match__target" +
                  (isCorrect ? " drag-drop-match__target--correct" : "") +
                  (isWrong ? " drag-drop-match__target--incorrect" : "") +
                  (selectedSourceId && !sourcePlaced ? " drag-drop-match__target--active" : "");

                return (
                  <div className="drag-drop-match__row" key={row.id} role="listitem">
                    <div className="drag-drop-match__prompt">{row.prompt || "(Untitled item)"}</div>
                    <button
                      type="button"
                      className={targetClass}
                      onClick={() => onTargetClick(row.id)}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDropOnTarget(e, row.id)}
                      aria-label={
                        sourcePlaced
                          ? `Remove ${card?.answer ?? "placed answer"} from ${row.prompt || "target"}`
                          : `Place answer into ${row.prompt || "target"}`
                      }
                    >
                      {sourcePlaced && card ? (
                        <span className="drag-drop-match__target-inner">
                          <DragDropAnswerWithOptionalThumb
                            pair={card}
                            resolveImg={resolveImg}
                            textClassName="drag-drop-match__placed-text"
                            thumbExtraClass=""
                          />
                          {checked && isCorrect ? (
                            <span className="drag-drop-match__status drag-drop-match__status--ok">
                              Correct
                            </span>
                          ) : null}
                          {checked && (isWrong || isEmpty) ? (
                            <span className="drag-drop-match__status drag-drop-match__status--bad">
                              Try again
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="drag-drop-match__target-empty">Drop or tap a match</span>
                      )}
                    </button>
                    {checked ? (
                      <AssessmentFeedback
                        className="drag-drop-match__assessment-feedback"
                        status={
                          isCorrect ? "correct" : isWrong || isEmpty ? "incorrect" : undefined
                        }
                        answer={row.answer}
                        answerLabel="Correct answer"
                        explanation={row.explanation}
                        explanationLabel="Explanation"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="drag-drop-match__panel-title drag-drop-match__panel-title--answers">
              🧩 Answer cards
            </div>
            <div
              className="drag-drop-match__answers"
              onDragOver={onDragOver}
              onDrop={(e) => {
                e.preventDefault();
                const sourceId = readDragPairId(e);
                if (!sourceId) return;
                for (const tid of targetIds) {
                  if (placements[tid] === sourceId) {
                    clearTarget(tid);
                    return;
                  }
                }
              }}
            >
              <div className="drag-drop-match__card-list">
                {bankDisplayIds.length === 0 ? (
                  <p className="drag-drop-match__pool-empty">All cards placed</p>
                ) : (
                  bankDisplayIds.map((sid, index) => {
                    const p = findPairById(pairs, sid);
                    if (!p) return null;
                    const selected = selectedSourceId === sid;
                    const tone = index % 6;
                    return (
                      <button
                        key={sid}
                        type="button"
                        draggable
                        onDragStart={(e) => onDragStartPool(e, sid)}
                        onDragEnd={onDragEndPool}
                        onClick={() => onPickFromPool(sid)}
                        className={
                          "drag-drop-match__card drag-drop-match__card--tone-" +
                          tone +
                          (selected ? " drag-drop-match__card--selected" : "")
                        }
                        aria-pressed={selected}
                        aria-label={`Select answer: ${p.answer}`}
                      >
                        <DragDropAnswerWithOptionalThumb
                          pair={p}
                          resolveImg={resolveImg}
                          textClassName="drag-drop-match__card-text"
                          thumbExtraClass=""
                        />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="drag-drop-match__tip">
        {diagramMode
          ? "💡 Tip: Drag cards onto A/B/C/D on the diagram — each zone shows a compact label when filled. Tap the zone or the card row to clear or replace. Check answers for feedback."
          : textToImageMode
            ? "💡 Tip: Tap a concept card, then tap an image drop zone to place it — or drag concepts onto the zones. Check answers to reveal labels and explanations."
            : "💡 Tip: Read each function carefully before matching."}
      </div>

      <div className="drag-drop-match__actions">
        <button type="button" className="drag-drop-match__check" onClick={onCheck}>
          Check answers
        </button>
        <button type="button" className="drag-drop-match__reset" onClick={onReset}>
          Reset
        </button>
      </div>
    </section>
  );
}
