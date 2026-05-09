import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hasRenderableLessonImageSrc } from "../../constants/lessonImageDisplay";
import {
  isDragDropDiagramMode,
  mergeDiagramZoneExplanation,
  parseDragDropDiagramImageFit,
  parseDragDropDiagramImagePosition,
  sanitizePlacedDiagramDropZones,
  type PlacedDragDropDiagramZone,
} from "../../utils/dragDropMatchDiagram";
import { AssessmentFeedback } from "./AssessmentFeedback";
import { hideBrokenLessonImage, LessonImageFrame } from "./LessonImageFrame";
import "./dragDropMatchBlock.css";

const DND_MIME = "application/x-letsrevise-dnd-pair";

function readDragPairId(e: React.DragEvent): string {
  return String(e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData("text/plain") || "").trim();
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

export type DragDropMatchPair = {
  id: string;
  prompt: string;
  answer: string;
  explanation?: string;
};

export type DragDropMatchBlockData = {
  title?: string;
  intro?: string;
  instructions?: string;
  pairs?: DragDropMatchPair[];
  matchMode?: "text" | "diagram";
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
  const diagramMode = isDragDropDiagramMode(block.matchMode, {
    imageUrl: block.imageUrl,
    dropZones: block.dropZones,
  });
  const resolveImg = resolveImageUrl ?? ((u: string) => u);

  const pairs = useMemo(() => {
    const raw = Array.isArray(block.pairs) ? block.pairs : [];
    return raw
      .map((p, i) => ({
        id: String(p?.id ?? "").trim() || `row_${i + 1}`,
        prompt: String(p?.prompt ?? "").trim(),
        answer: String(p?.answer ?? "").trim(),
        explanation: p?.explanation != null ? String(p.explanation) : undefined,
      }))
      .filter((p) => (diagramMode ? p.answer.length > 0 : p.prompt || p.answer));
  }, [block.pairs, diagramMode]);

  const pairIds = useMemo(() => pairs.map((p) => p.id), [pairs]);

  const zones: PlacedDragDropDiagramZone[] = useMemo(
    () => (diagramMode ? sanitizePlacedDiagramDropZones(block.dropZones, pairIds) : []),
    [diagramMode, block.dropZones, pairIds]
  );

  const [placements, setPlacements] = useState<Placements>({});
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const layoutResetKey = diagramMode
    ? `${pairIds.join("|")}|${zones.map((z) => `${z.id}:${z.x}:${z.y}:${z.correctPairId}`).join("|")}`
    : pairIds.join("|");

  useEffect(() => {
    setPlacements({});
    setSelectedSourceId(null);
    setChecked(false);
  }, [layoutResetKey]);

  const targetIds = useMemo(
    () => (diagramMode ? zones.map((z) => z.id) : pairs.map((p) => p.id)),
    [diagramMode, zones, pairs]
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

  /** Diagram mode: pair id → zone marker letter for placed cards (badges). */
  const diagramPairToMarker = useMemo(() => {
    const m = new Map<string, string>();
    if (!diagramMode) return m;
    zones.forEach((z, zi) => {
      const pid = placements[z.id];
      if (pid) m.set(pid, diagramZoneMarkerLabel(zi));
    });
    return m;
  }, [diagramMode, zones, placements]);

  const byId = useMemo(() => {
    const m = new Map<string, DragDropMatchPair>();
    for (const p of pairs) m.set(p.id, p);
    return m;
  }, [pairs]);

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
    if (diagramMode) setDiagramDragActive(true);
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
      if (!sourceId || !byId.get(sourceId)) return;
      place(targetId, sourceId);
    },
    [byId, place]
  );

  const onDropDiagramOverlayNearest = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const sourceId = readDragPairId(e);
      if (typeof window !== "undefined" && window.localStorage?.getItem("DEBUG_DDM") === "1") {
        console.log("[DragDropMatch diagram] drop on overlay (nearest zone)", { sourceId, clientX: e.clientX, clientY: e.clientY });
      }
      if (!sourceId || !byId.get(sourceId)) return;
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
    [byId, place, zones]
  );

  const title = String(block.title ?? "").trim();
  const intro = String(block.intro ?? "").trim();
  const instructions = String(block.instructions ?? "").trim();

  const imgRaw = diagramMode ? String(block.imageUrl ?? "").trim() : "";
  const imgResolved = imgRaw ? resolveImg(imgRaw) : "";
  const diagramImageFit = parseDragDropDiagramImageFit(block.imageFit) ?? "contain";
  const diagramImagePosition =
    parseDragDropDiagramImagePosition(block.imagePosition) ?? "center center";
  const showDiagramImg =
    diagramMode && hasRenderableLessonImageSrc(imgRaw) && hasRenderableLessonImageSrc(imgResolved);

  if (pairs.length === 0) {
    return (
      <div className="drag-drop-match">
        <p className="drag-drop-match__empty">This activity has no matching pairs yet.</p>
      </div>
    );
  }

  const diagramZonesEmptyOrMissing = diagramMode && showDiagramImg && zones.length === 0;

  return (
    <section className="drag-drop-match" aria-label={title || "Drag and drop match activity"}>
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
              {diagramMode ? "Diagram drag and drop" : "Drag &amp; Drop Activity"}
            </span>
          </div>
        </div>
      </div>
      {intro ? <p className="drag-drop-match__intro">{intro}</p> : null}
      {instructions ? <p className="drag-drop-match__instruction">{instructions}</p> : null}

      {diagramMode ? (
        <div className="drag-drop-match__diagram-worksheet">
          <div className="drag-drop-match__panel-title drag-drop-match__panel-title--diagram">
            📍 Diagram — drop zones
          </div>
          <div className="drag-drop-match__diagram-panel">
            {showDiagramImg ? (
              <>
                <div className="drag-drop-match__diagram-visual">
                  <div className="drag-drop-match__diagram-image-container">
                    <LessonImageFrame
                      className="drag-drop-match__diagram-frame"
                      variant="primary"
                      lightboxSrc={imgResolved}
                    >
                      <img
                        className="drag-drop-match__diagram-img"
                        src={imgResolved}
                        alt={title || "Diagram for drag and drop activity"}
                        style={{
                          objectFit: diagramImageFit,
                          objectPosition: diagramImagePosition,
                        }}
                        onError={hideBrokenLessonImage}
                      />
                    </LessonImageFrame>
                    {zones.length > 0 ? (
                      <div ref={diagramOverlayRef} className="drag-drop-match__diagram-overlay">
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
                            const card = sourcePlaced ? byId.get(sourcePlaced) : null;
                            const corr = zone.correctPairId;
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
                              (sourcePlaced ? " drag-drop-match__diagram-zone--filled" : "") +
                              (sourcePlaced ? ` drag-drop-match__diagram-zone--chip-tone-${zi % 6}` : "") +
                              (sourcePlaced
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
                                  ...(sourcePlaced && card
                                    ? {
                                        maxWidth: chipGrowRight
                                          ? `min(132px, calc(100% - ${zxPct}% - 10px))`
                                          : `min(132px, calc(${zxPct}% - 10px))`,
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
                                    : `Drop answer on marker ${mark}`
                                }
                              >
                                {sourcePlaced && card ? (
                                  <span className="drag-drop-match__diagram-zone-chip">
                                    <span
                                      className="drag-drop-match__diagram-zone-chip-mark"
                                      aria-hidden="true"
                                    >
                                      {mark}
                                    </span>
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
                {diagramZonesEmptyOrMissing ? (
                  <p className="drag-drop-match__diagram-hint" role="status">
                    This diagram has no drop zones yet. Your teacher can add targets in the lesson editor.
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
            <div className="drag-drop-match__panel-title drag-drop-match__panel-title--answers">
              🧩 Answer cards
            </div>
            <div
              className="drag-drop-match__answers drag-drop-match__answers--diagram"
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
              <div className="drag-drop-match__card-list drag-drop-match__card-list--diagram-wrap">
                {bankOrder
                  .filter((sid) => byId.has(sid))
                  .map((sid, index) => {
                    const p = byId.get(sid);
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
                          <span className="drag-drop-match__card-text">{p.answer || "(No text)"}</span>
                          {isPlaced ? (
                            <span className="drag-drop-match__card-placed-badge">Placed: {placedMark}</span>
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

          {diagramImageFit === "cover" ? (
            <p className="drag-drop-match__diagram-hint" role="status">
              Cover mode may crop edges and shift visual alignment. Re-check drop zone positions or upload a tightly
              cropped image for best accuracy.
            </p>
          ) : null}

          {showDiagramImg && zones.length > 0 ? (
            <div className="drag-drop-match__diagram-summary">
              <div className="drag-drop-match__diagram-summary-heading">Your labels</div>
              <ul
                className="drag-drop-match__diagram-summary-list"
                role="list"
                aria-label="Your labels"
              >
                {zones.map((zone, zi) => {
                  const mark = diagramZoneMarkerLabel(zi);
                  const sourcePlaced = placements[zone.id] ?? null;
                  const card = sourcePlaced ? byId.get(sourcePlaced) : null;
                  const corr = zone.correctPairId;
                  const correctPair = corr ? byId.get(corr) : undefined;
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
                          {card?.answer ? (
                            card.answer
                          ) : (
                            <span className="drag-drop-match__diagram-summary-placeholder">
                              Not placed yet
                            </span>
                          )}
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
                const card = sourcePlaced ? byId.get(sourcePlaced) : null;
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
                          <span className="drag-drop-match__placed-text">{card.answer}</span>
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
                    const p = byId.get(sid);
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
                        {p.answer || "(No text)"}
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
