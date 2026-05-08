import React, { useRef } from "react";
import { LessonAutoTextarea } from "./LessonAutoTextarea";
import { DragDropMatchBlock } from "./DragDropMatchBlock";
import { parseDragDropMatchMode } from "../../utils/dragDropMatchDiagram";

export type DragDropMatchAuthoringBlockSlice = {
  title?: string;
  intro?: string;
  instructions?: string;
  imageUrl?: string;
  matchMode?: "text" | "diagram";
  pairs?: Array<{ id: string; prompt: string; answer: string; explanation?: string }>;
  dropZones?: Array<{
    id: string;
    x?: number;
    y?: number;
    correctPairId: string;
    explanation?: string;
  }>;
};

export type DragDropMatchDiagramAuthoringProps = {
  blk: DragDropMatchAuthoringBlockSlice;
  onPatch: (patch: Partial<DragDropMatchAuthoringBlockSlice>) => void;
  newId: () => string;
  placingZoneId: string | null;
  onPlacingZoneId: (id: string | null) => void;
  resolveImageUrlForPreview: (url: string) => string;
  safeStr: (v: unknown, fallback: string) => string;
};

/**
 * Teacher authoring for dragDropMatch diagram mode — layout toggle, image URL, placement canvas, zone rows.
 */
export function DragDropMatchDiagramAuthoring({
  blk,
  onPatch,
  newId,
  placingZoneId,
  onPlacingZoneId,
  resolveImageUrlForPreview,
  safeStr,
}: DragDropMatchDiagramAuthoringProps): React.ReactElement {
  const placementContainerRef = useRef<HTMLDivElement | null>(null);
  const zones = Array.isArray(blk.dropZones) ? [...blk.dropZones] : [];
  const pairsDd = Array.isArray(blk.pairs) ? blk.pairs : [];
  const placeIdxDd = placingZoneId ? zones.findIndex((z) => String(z.id) === placingZoneId) : -1;
  const diagSrc =
    blk.imageUrl != null && String(blk.imageUrl).trim()
      ? resolveImageUrlForPreview(String(blk.imageUrl).trim())
      : "";

  return (
    <React.Fragment>
      <label style={{ display: "block" }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Activity layout</div>
        <select
          value={parseDragDropMatchMode(blk.matchMode) === "diagram" ? "diagram" : "text"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "diagram") {
              onPatch({
                matchMode: "diagram",
                dropZones: Array.isArray(blk.dropZones) ? blk.dropZones : [],
              });
            } else {
              onPatch({
                matchMode: "text",
                dropZones: [],
              });
              onPlacingZoneId(null);
            }
          }}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontWeight: 600,
          }}
        >
          <option value="text">Text prompts + drop targets (classic)</option>
          <option value="diagram">Diagram — image + drop zones</option>
        </select>
      </label>
      {parseDragDropMatchMode(blk.matchMode) === "diagram" ? (
        <>
          <label style={{ display: "block" }}>
            <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 13 }}>
              Diagram image URL (or upload elsewhere and paste URL)
            </div>
            <input
              value={safeStr(blk.imageUrl, "")}
              onChange={(e) => onPatch({ imageUrl: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
              }}
              placeholder="https://…"
            />
          </label>
          <div
            style={{
              marginTop: 8,
              padding: 14,
              borderRadius: 12,
              border: "1px solid #bfdbfe",
              background: "linear-gradient(180deg, rgba(239,246,255,0.9) 0%, #ffffff 100%)",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6 }}>Student preview</div>
            <div
              style={{
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                overflow: "hidden",
                background: "#fff",
                maxWidth: 960,
              }}
            >
              <DragDropMatchBlock
                resolveImageUrl={resolveImageUrlForPreview}
                block={{
                  title: safeStr(blk.title, ""),
                  intro: safeStr(blk.intro, ""),
                  instructions: safeStr(blk.instructions, ""),
                  matchMode: "diagram",
                  imageUrl: String(blk.imageUrl ?? ""),
                  pairs: pairsDd.map((p, pi) => ({
                    id: String(p?.id ?? "").trim() || `p${pi}`,
                    prompt: String(p?.prompt ?? ""),
                    answer: String(p?.answer ?? ""),
                    explanation: p?.explanation != null ? String(p.explanation) : undefined,
                  })),
                  dropZones: zones.map((z, zi) => ({
                    id: String(z?.id ?? "").trim() || `z${zi}`,
                    ...(typeof z.x === "number" ? { x: z.x } : {}),
                    ...(typeof z.y === "number" ? { y: z.y } : {}),
                    correctPairId: String(z?.correctPairId ?? "").trim(),
                    ...(z?.explanation != null && String(z.explanation).trim()
                      ? { explanation: String(z.explanation).trim() }
                      : {}),
                  })),
                }}
              />
            </div>
          </div>
          {diagSrc ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8 }}>Place drop zones on diagram</div>
              <p
                style={{
                  margin: "0 0 10px 0",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "#0f172a",
                  fontWeight: 600,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(219, 234, 254, 0.5)",
                  border: "1px solid #bfdbfe",
                }}
              >
                {placingZoneId ? (
                  <>
                    <strong>Click the image</strong> to place zone{" "}
                    <strong>{placeIdxDd >= 0 ? placeIdxDd + 1 : "?"}</strong>, or pick another row below.
                  </>
                ) : (
                  <>
                    <strong>Click the image</strong> to add a zone, or use <strong>Place on diagram</strong> on a row
                    below, then click the image.
                  </>
                )}
              </p>
              <div
                style={{
                  width: "100%",
                  maxWidth: 960,
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid #e2e8f0",
                  lineHeight: 0,
                  boxShadow: "0 2px 12px rgba(15, 23, 42, 0.06)",
                }}
              >
                <div
                  ref={placementContainerRef}
                  role="presentation"
                  onClick={(e) => {
                    const el = placementContainerRef.current;
                    if (!el) return;
                    const t = e.target as HTMLElement;
                    if (t.closest("button[data-ddm-placement-marker]")) return;
                    const rect = el.getBoundingClientRect();
                    if (rect.width <= 0 || rect.height <= 0) return;
                    const x = Math.max(
                      0,
                      Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10)
                    );
                    const y = Math.max(
                      0,
                      Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10)
                    );
                    const zlist = Array.isArray(blk.dropZones) ? [...blk.dropZones] : [];
                    const pidFirst = pairsDd.find((p) => String(p?.id ?? "").trim())?.id;
                    if (!pidFirst) return;
                    if (placingZoneId) {
                      const nextZ = zlist.map((zo) =>
                        String(zo.id) === placingZoneId ? { ...zo, x, y } : zo
                      );
                      onPlacingZoneId(null);
                      onPatch({ dropZones: nextZ });
                      return;
                    }
                    onPatch({
                      dropZones: [
                        ...zlist,
                        {
                          id: newId(),
                          x,
                          y,
                          correctPairId: String(pidFirst),
                          explanation: "",
                        },
                      ],
                    });
                  }}
                  style={{ position: "relative", cursor: "crosshair" }}
                >
                  <img
                    src={diagSrc}
                    alt="Drag-drop diagram placement"
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                      pointerEvents: "none",
                    }}
                  />
                  {zones
                    .filter(
                      (zo) =>
                        typeof zo.x === "number" &&
                        Number.isFinite(zo.x) &&
                        typeof zo.y === "number" &&
                        Number.isFinite(zo.y)
                    )
                    .map((zo, zi) => (
                      <button
                        key={String(zo.id)}
                        type="button"
                        data-ddm-placement-marker
                        onClick={(ev) => ev.stopPropagation()}
                        style={{
                          position: "absolute",
                          left: `${zo.x as number}%`,
                          top: `${zo.y as number}%`,
                          transform: "translate(-50%, -50%)",
                          width: 36,
                          height: 36,
                          borderRadius: 999,
                          border: "2px solid #2563eb",
                          background: "rgba(255,255,255,0.95)",
                          fontWeight: 900,
                          fontSize: 14,
                          color: "#1d4ed8",
                          cursor: "default",
                          boxShadow: "0 2px 8px rgba(15,23,42,0.12)",
                        }}
                      >
                        {zi + 1}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b", fontWeight: 600 }}>
              Add an image URL above to position drop zones on the diagram.
            </p>
          )}
          <div
            style={{
              marginTop: 14,
              fontWeight: 900,
              fontSize: 14,
              color: "#0f172a",
              borderBottom: "2px solid #bae6fd",
              paddingBottom: 6,
            }}
          >
            Drop zone list
          </div>
          {zones.length === 0 ? (
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#64748b" }}>
              No zones yet. With an image set, click the diagram to add a zone and choose the correct answer card for
              each.
            </p>
          ) : null}
          {zones.map((zone, zi) => {
            const hid = String(zone.id ?? zi);
            const placed =
              typeof zone.x === "number" &&
              Number.isFinite(zone.x) &&
              typeof zone.y === "number" &&
              Number.isFinite(zone.y);
            const placingThis = placingZoneId === hid;
            return (
              <div
                key={hid}
                style={{
                  padding: 12,
                  marginTop: 10,
                  borderRadius: 10,
                  border: placingThis ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                  background: placingThis ? "rgba(219, 234, 254, 0.35)" : "#fafafa",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 8, color: "#0369a1" }}>
                  Zone {zi + 1}
                  {placed ? (
                    <span style={{ fontWeight: 600, color: "#166534", marginLeft: 8 }}>
                      Placed: {Math.round(zone.x as number)}%, {Math.round(zone.y as number)}%
                    </span>
                  ) : (
                    <span style={{ fontWeight: 600, color: "#9a3412", marginLeft: 8 }}>Unplaced</span>
                  )}
                </div>
                <label style={{ display: "block", marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>Correct answer card</div>
                  <select
                    value={
                      pairsDd.some((p) => String(p.id) === String(zone.correctPairId))
                        ? String(zone.correctPairId)
                        : String(pairsDd[0]?.id ?? "")
                    }
                    onChange={(e) => {
                      const next = [...zones];
                      if (next[zi]) next[zi] = { ...next[zi], correctPairId: e.target.value };
                      onPatch({ dropZones: next });
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    {pairsDd.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {safeStr(p.answer, "(Empty)")} — id {String(p.id).slice(0, 8)}…
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "block", marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>
                    Explanation (optional, shown after Check)
                  </div>
                  <LessonAutoTextarea
                    editorVariant="plain"
                    value={safeStr(zone.explanation, "")}
                    onChange={(v) => {
                      const next = [...zones];
                      if (next[zi]) next[zi] = { ...next[zi], explanation: v };
                      onPatch({ dropZones: next });
                    }}
                    placeholder="Override or add to the pair explanation…"
                    minHeightPx={56}
                    style={{ fontSize: "0.875rem" }}
                  />
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      onPlacingZoneId(hid);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #3b82f6",
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Place on diagram
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (placingZoneId === hid) onPlacingZoneId(null);
                      onPatch({ dropZones: zones.filter((_, j) => j !== zi) });
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #f87171",
                      background: "#fef2f2",
                      color: "#b91c1c",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Delete zone
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => {
              const pid0 = pairsDd.find((p) => String(p?.id ?? "").trim())?.id;
              if (!pid0) return;
              onPatch({
                dropZones: [
                  ...zones,
                  {
                    id: newId(),
                    correctPairId: String(pid0),
                    explanation: "",
                  },
                ],
              });
            }}
            style={{
              marginTop: 10,
              padding: "6px 12px",
              borderRadius: 8,
              border: "2px solid rgba(14,165,233,0.45)",
              background: "rgba(224,242,254,0.5)",
              cursor: pairsDd.length ? "pointer" : "not-allowed",
              fontWeight: 700,
              opacity: pairsDd.length ? 1 : 0.5,
            }}
            disabled={!pairsDd.length}
          >
            + Add zone (unplaced — then place on diagram)
          </button>
        </>
      ) : null}
    </React.Fragment>
  );
}
