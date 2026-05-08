import React, { useCallback, useEffect, useMemo, useState } from "react";
import { hasRenderableLessonImageSrc } from "../../constants/lessonImageDisplay";
import {
  isDragDropDiagramMode,
  mergeDiagramZoneExplanation,
  sanitizePlacedDiagramDropZones,
  type PlacedDragDropDiagramZone,
} from "../../utils/dragDropMatchDiagram";
import { AssessmentFeedback } from "./AssessmentFeedback";
import { hideBrokenLessonImage, LessonImageFrame } from "./LessonImageFrame";
import "./dragDropMatchBlock.css";

const DND_MIME = "application/x-letsrevise-dnd-pair";

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
  const diagramMode = isDragDropDiagramMode(block.matchMode);
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

  const byId = useMemo(() => {
    const m = new Map<string, DragDropMatchPair>();
    for (const p of pairs) m.set(p.id, p);
    return m;
  }, [pairs]);

  const place = useCallback(
    (targetId: string, sourceId: string) => {
      setPlacements((prev) => {
        const next = { ...prev } as Placements;
        for (const k of Object.keys(next)) {
          if (next[k] === sourceId) next[k] = null;
        }
        next[targetId] = sourceId;
        return next;
      });
      setSelectedSourceId(null);
      setChecked(false);
    },
    [setPlacements]
  );

  const clearTarget = useCallback((targetId: string) => {
    setPlacements((prev) => {
      const next = { ...prev } as Placements;
      next[targetId] = null;
      return next;
    });
    setChecked(false);
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

  const onDragStartPool = (e: React.DragEvent, sourceId: string) => {
    e.dataTransfer.setData(DND_MIME, sourceId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDropOnTarget = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData("text/plain");
    if (!sourceId) return;
    if (!byId.get(sourceId) || !poolIds.includes(sourceId)) return;
    place(targetId, sourceId);
  };

  const title = String(block.title ?? "").trim();
  const intro = String(block.intro ?? "").trim();
  const instructions = String(block.instructions ?? "").trim();

  const imgRaw = diagramMode ? String(block.imageUrl ?? "").trim() : "";
  const imgResolved = imgRaw ? resolveImg(imgRaw) : "";
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

  const gridClass =
    "drag-drop-match__grid" + (diagramMode ? " drag-drop-match__grid--diagram" : "");

  const renderTargetFeedbackRow = (
    targetId: string,
    headline: string,
    correctPairId: string | undefined
  ) => {
    if (!correctPairId) return null;
    const correctPair = byId.get(correctPairId);
    const placedId = placements[targetId] ?? null;
    const isCorrect = checked && placedId != null && placedId === correctPairId;
    const isWrong = checked && placedId != null && placedId !== correctPairId;
    const isEmpty = checked && placedId == null;
    const zoneDiagram = zones.find((z) => z.id === targetId);
    const mergedExpl = mergeDiagramZoneExplanation(zoneDiagram?.explanation, correctPair?.explanation);
    return checked ? (
      <AssessmentFeedback
        className="drag-drop-match__assessment-feedback"
        title={headline}
        status={isCorrect ? "correct" : isWrong || isEmpty ? "incorrect" : undefined}
        answer={correctPair?.answer}
        answerLabel="Correct answer"
        explanation={mergedExpl}
        explanationLabel="Explanation"
      />
    ) : null;
  };

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

      <div className={gridClass}>
        <div>
          <div
            className={
              "drag-drop-match__panel-title drag-drop-match__panel-title--targets" +
              (diagramMode ? " drag-drop-match__panel-title--diagram" : "")
            }
          >
            {diagramMode ? "📍 Diagram — drop zones" : "🎯 Drop your answers here"}
          </div>

          {diagramMode ? (
            <>
              <div className="drag-drop-match__diagram-panel">
                {showDiagramImg ? (
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
                          onError={hideBrokenLessonImage}
                        />
                      </LessonImageFrame>
                      {zones.length > 0 ? (
                        <div className="drag-drop-match__diagram-overlay">
                          {zones.map((zone, zi) => {
                            const sourcePlaced = placements[zone.id] ?? null;
                            const card = sourcePlaced ? byId.get(sourcePlaced) : null;
                            const corr = zone.correctPairId;
                            const isCorrect =
                              checked && sourcePlaced != null && sourcePlaced === corr;
                            const isWrong = checked && sourcePlaced != null && sourcePlaced !== corr;
                            const isEmpty = checked && sourcePlaced == null;
                            const targetClass =
                              "drag-drop-match__diagram-zone" +
                              (isCorrect ? " drag-drop-match__diagram-zone--correct" : "") +
                              (isWrong || isEmpty ? " drag-drop-match__diagram-zone--incorrect" : "") +
                              (selectedSourceId && !sourcePlaced
                                ? " drag-drop-match__diagram-zone--active"
                                : "");
                            return (
                              <button
                                key={zone.id}
                                type="button"
                                className={targetClass}
                                style={{
                                  left: `${zone.x}%`,
                                  top: `${zone.y}%`,
                                }}
                                onClick={() => onTargetClick(zone.id)}
                                onDragOver={onDragOver}
                                onDrop={(e) => onDropOnTarget(e, zone.id)}
                                aria-label={
                                  sourcePlaced
                                    ? `Remove ${card?.answer ?? "placed answer"} from zone ${zi + 1}`
                                    : `Drop answer into zone ${zi + 1}`
                                }
                              >
                                {sourcePlaced && card ? (
                                  <span className="drag-drop-match__diagram-zone-inner">
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
                                  <span className="drag-drop-match__target-empty">+</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                    {diagramZonesEmptyOrMissing ? (
                      <p className="drag-drop-match__diagram-hint" role="status">
                        This diagram has no drop zones yet. Your teacher can add targets in the lesson editor.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="drag-drop-match__diagram-hint" role="status">
                    Add a diagram image in the lesson editor to use diagram mode.
                  </p>
                )}
                {checked && zones.length > 0 ? (
                  <div className="drag-drop-match__diagram-feedback-list">
                    {zones.map((zone, zi) => (
                      <div key={`fb-${zone.id}`} className="drag-drop-match__diagram-feedback-item">
                        {renderTargetFeedbackRow(zone.id, `Zone ${zi + 1}`, zone.correctPairId)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
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
          )}
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
              const sourceId = e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData("text/plain");
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

      <div className="drag-drop-match__tip">
        {diagramMode
          ? "💡 Tip: Drag each answer card onto a circle on the diagram, then check your answers."
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
