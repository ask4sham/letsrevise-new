import React, { useCallback, useEffect, useMemo, useState } from "react";
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
};

export type DragDropMatchBlockProps = {
  block: DragDropMatchBlockData;
};

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Placed card is identified by the source pair id (one answer card per pair). */
type Placements = Record<string, string | null>;

export function DragDropMatchBlock({ block }: DragDropMatchBlockProps) {
  const pairs = useMemo(() => {
    const raw = Array.isArray(block.pairs) ? block.pairs : [];
    return raw
      .map((p, i) => ({
        id: String(p?.id ?? "").trim() || `row_${i + 1}`,
        prompt: String(p?.prompt ?? "").trim(),
        answer: String(p?.answer ?? "").trim(),
        explanation: p?.explanation != null ? String(p.explanation) : undefined,
      }))
      .filter((p) => p.prompt || p.answer);
  }, [block.pairs]);

  const [placements, setPlacements] = useState<Placements>({});
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const pairKey = pairs.map((p) => p.id).join("|");

  useEffect(() => {
    setPlacements({});
    setSelectedSourceId(null);
    setChecked(false);
  }, [pairKey]);

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
  }, [pairKey]);

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
        const prevOnTarget = next[targetId] ?? null;
        if (prevOnTarget && prevOnTarget !== sourceId) {
          // previous card returns to pool when replaced
        }
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

  if (pairs.length === 0) {
    return (
      <div className="drag-drop-match">
        <p className="drag-drop-match__empty">This activity has no matching pairs yet.</p>
      </div>
    );
  }

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
            <span className="drag-drop-match__tag">Drag &amp; Drop Activity</span>
          </div>
        </div>
      </div>
      {intro ? <p className="drag-drop-match__intro">{intro}</p> : null}
      {instructions ? <p className="drag-drop-match__instruction">{instructions}</p> : null}

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
                        <span className="drag-drop-match__status drag-drop-match__status--ok">Correct</span>
                      ) : null}
                      {checked && isWrong ? (
                        <span className="drag-drop-match__status drag-drop-match__status--bad">Try again</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="drag-drop-match__target-empty">Drop or tap a match</span>
                  )}
                </button>
                {checked && row.explanation && String(row.explanation).trim() ? (
                  <div
                    className="drag-drop-match__feedback"
                    role="note"
                  >
                    {row.explanation}
                  </div>
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
              const sourceId = e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData("text/plain");
              if (!sourceId) return;
              for (const tid of pairs.map((p) => p.id)) {
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
        💡 Tip: Read each function carefully before matching.
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
