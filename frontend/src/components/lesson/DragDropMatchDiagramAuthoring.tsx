import React, { useRef } from "react";
import { LessonAutoTextarea } from "./LessonAutoTextarea";
import { DragDropMatchBlock } from "./DragDropMatchBlock";
import "./dragDropMatchBlock.css";
import {
  parseDragDropDiagramImageFit,
  parseDragDropDiagramImagePosition,
  resolveDragDropMatchModeForUi,
} from "../../utils/dragDropMatchDiagram";

export type DragDropMatchAuthoringBlockSlice = {
  title?: string;
  intro?: string;
  instructions?: string;
  imageUrl?: string;
  matchMode?: "text" | "diagram";
  imageFit?: "contain" | "cover";
  imagePosition?: "center center" | "center top" | "center bottom";
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
  /** Optional — wire Supabase/API image upload from the lesson editor (sets imageUrl via onPatch). */
  onDiagramImageFile?: (file: File) => void | Promise<void>;
  diagramImageUploading?: boolean;
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
  onDiagramImageFile,
  diagramImageUploading,
}: DragDropMatchDiagramAuthoringProps): React.ReactElement {
  const placementContainerRef = useRef<HTMLDivElement | null>(null);
  const diagramFileInputRef = useRef<HTMLInputElement | null>(null);
  const zones = Array.isArray(blk.dropZones) ? [...blk.dropZones] : [];
  const pairsDd = Array.isArray(blk.pairs) ? blk.pairs : [];
  const placeIdxDd = placingZoneId ? zones.findIndex((z) => String(z.id) === placingZoneId) : -1;
  const diagSrc =
    blk.imageUrl != null && String(blk.imageUrl).trim()
      ? resolveImageUrlForPreview(String(blk.imageUrl).trim())
      : "";
  const imageFit = parseDragDropDiagramImageFit(blk.imageFit) ?? "contain";
  const imagePosition = parseDragDropDiagramImagePosition(blk.imagePosition) ?? "center center";

  const layoutMode = resolveDragDropMatchModeForUi(blk.matchMode, {
    imageUrl: blk.imageUrl,
    dropZones: blk.dropZones,
  });

  return (
    <React.Fragment>
      <label style={{ display: "block" }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Activity layout</div>
        <select
          value={layoutMode}
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
      {layoutMode === "diagram" ? (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <label style={{ display: "block", flex: "1 1 220px", minWidth: 0 }}>
              <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 13 }}>
                Diagram image URL (or upload below)
              </div>
              <input
                value={safeStr(blk.imageUrl, "")}
                onChange={(e) => onPatch({ imageUrl: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                }}
                placeholder="https://…"
              />
            </label>
            {onDiagramImageFile ? (
              <>
                <input
                  ref={diagramFileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void Promise.resolve(onDiagramImageFile(f));
                  }}
                />
                <button
                  type="button"
                  disabled={Boolean(diagramImageUploading)}
                  onClick={() => diagramFileInputRef.current?.click()}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #0ea5e9",
                    background: diagramImageUploading ? "#e2e8f0" : "#e0f2fe",
                    color: "#0369a1",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: diagramImageUploading ? "not-allowed" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  {diagramImageUploading ? "Uploading…" : "Upload image"}
                </button>
              </>
            ) : null}
          </div>
          <p
            style={{
              margin: "10px 0 0",
              padding: "10px 12px",
              fontSize: 13,
              lineHeight: 1.45,
              color: "#475569",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
            }}
          >
            <strong style={{ color: "#334155" }}>Tip:</strong> If there is too much blank space around your
            diagram, crop the image before upload. The activity does not auto-crop images because that can shift
            hotspot coordinates.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            <label style={{ display: "block", flex: "1 1 180px", minWidth: 0 }}>
              <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 13 }}>Image fit</div>
              <select
                value={imageFit}
                onChange={(e) =>
                  onPatch({
                    imageFit: e.target.value === "cover" ? "cover" : "contain",
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                }}
              >
                <option value="contain">Contain (safe default)</option>
                <option value="cover">Cover (crops edges)</option>
              </select>
            </label>
            <label style={{ display: "block", flex: "1 1 180px", minWidth: 0 }}>
              <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 13 }}>Image vertical focus</div>
              <select
                value={imagePosition}
                onChange={(e) => {
                  const v = String(e.target.value);
                  onPatch({
                    imagePosition:
                      v === "center top" || v === "center bottom" ? v : "center center",
                  });
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                }}
              >
                <option value="center center">Center</option>
                <option value="center top">Top</option>
                <option value="center bottom">Bottom</option>
              </select>
            </label>
          </div>
          {imageFit === "cover" ? (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 12,
                color: "#9a3412",
                fontWeight: 700,
                background: "#fff7ed",
                border: "1px solid #fdba74",
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              Cover can crop edges and shift what appears under each marker. For best accuracy, upload a tightly cropped
              image or re-check zone placement after switching fit.
            </p>
          ) : null}
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
            <div className="drag-drop-match-diagram-authoring-preview-shell">
              <DragDropMatchBlock
                resolveImageUrl={resolveImageUrlForPreview}
                block={{
                  title: safeStr(blk.title, ""),
                  intro: safeStr(blk.intro, ""),
                  instructions: safeStr(blk.instructions, ""),
                  matchMode: "diagram",
                  imageUrl: String(blk.imageUrl ?? ""),
                  imageFit,
                  imagePosition,
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
              <div className="drag-drop-match-diagram-authoring-placement-shell">
                <div
                  ref={placementContainerRef}
                  className="drag-drop-match-diagram-authoring-placement-inner"
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
                  style={{ cursor: "crosshair" }}
                >
                  <img
                    src={diagSrc}
                    alt="Drag-drop diagram placement"
                    style={{
                      pointerEvents: "none",
                      objectFit: imageFit,
                      objectPosition: imagePosition,
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

