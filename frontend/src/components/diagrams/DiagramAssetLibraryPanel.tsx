import React, { useCallback, useEffect, useMemo, useState } from "react";
import { makeAbsoluteAssetUrl } from "../../utils/assetUrl";
import {
  filterDiagramAssets,
  listDiagramAssets,
  uploadDiagramAsset,
  type DiagramAssetRecord,
} from "../../api/diagramAssets";

export type DiagramAssetLibraryDefaults = {
  subject?: string;
  topic?: string;
  examBoard?: string;
  tier?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onAttach: (asset: DiagramAssetRecord) => void;
  defaults?: DiagramAssetLibraryDefaults;
};

const ACCEPTED_UPLOAD =
  ".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml";

function isAcceptedDiagramFile(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t === "image/png" || t === "image/jpeg" || t === "image/webp" || t === "image/svg+xml") {
    return true;
  }
  return /\.(png|jpe?g|webp|svg)$/i.test(file.name || "");
}

const DiagramAssetLibraryPanel: React.FC<Props> = ({ open, onClose, onAttach, defaults }) => {
  const [tab, setTab] = useState<"browse" | "upload">("browse");
  const [assets, setAssets] = useState<DiagramAssetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadSubject, setUploadSubject] = useState(defaults?.subject || "Biology");
  const [uploadTopic, setUploadTopic] = useState(defaults?.topic || "");
  const [uploadExamBoard, setUploadExamBoard] = useState(defaults?.examBoard || "AQA");
  const [uploadTier, setUploadTier] = useState(defaults?.tier || "Higher");
  const [uploadKeywords, setUploadKeywords] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const refreshAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listDiagramAssets({ limit: 100 });
      setAssets(rows);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (e as Error)?.message ||
        "Could not load diagram library";
      setError(msg);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setTab("browse");
    setSearch("");
    setUploadTitle("");
    setUploadSubject(defaults?.subject || "Biology");
    setUploadTopic(defaults?.topic || "");
    setUploadExamBoard(defaults?.examBoard || "AQA");
    setUploadTier(defaults?.tier || "Higher");
    setUploadKeywords("");
    setSelectedFile(null);
    void refreshAssets();
  }, [open, defaults, refreshAssets]);

  const filtered = useMemo(() => filterDiagramAssets(assets, search), [assets, search]);

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Choose an image file to upload.");
      return;
    }
    if (!isAcceptedDiagramFile(selectedFile)) {
      setError("Please upload PNG, JPG, WEBP, or SVG.");
      return;
    }
    const title = uploadTitle.trim() || selectedFile.name.replace(/\.[^.]+$/, "") || "Untitled diagram";
    setUploading(true);
    setError(null);
    try {
      const asset = await uploadDiagramAsset({
        file: selectedFile,
        title,
        subject: uploadSubject.trim() || "Biology",
        topic: uploadTopic.trim(),
        examBoard: uploadExamBoard.trim() || "AQA",
        tier: uploadTier.trim() || "Higher",
        keywords: uploadKeywords,
        source: "chatgpt",
      });
      setAssets((prev) => [asset, ...prev.filter((a) => a.id !== asset.id)]);
      setTab("browse");
      setSearch("");
      onAttach(asset);
      onClose();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (e as Error)?.message ||
        "Upload failed";
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagram-asset-library-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "min(920px, 100%)",
          maxHeight: "88vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 48px rgba(0,0,0,0.22)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <div id="diagram-asset-library-title" style={{ fontWeight: 900, fontSize: 18 }}>
            Diagram Library
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
            Upload ChatGPT-generated diagrams and reuse them across lessons. This is not AI generation.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={() => setTab("browse")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: tab === "browse" ? "2px solid #2563eb" : "1px solid #d1d5db",
                background: tab === "browse" ? "#eff6ff" : "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Browse
            </button>
            <button
              type="button"
              onClick={() => setTab("upload")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: tab === "upload" ? "2px solid #2563eb" : "1px solid #d1d5db",
                background: tab === "upload" ? "#eff6ff" : "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Upload new
            </button>
          </div>
        </div>

        <div style={{ padding: 20, overflow: "auto", flex: 1 }}>
          {error ? (
            <div
              role="alert"
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                borderRadius: 8,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : null}

          {tab === "browse" ? (
            <>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, topic, subject, keywords…"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "2px solid rgba(0,0,0,0.12)",
                  marginBottom: 14,
                  boxSizing: "border-box",
                }}
              />
              {loading ? (
                <p style={{ color: "#64748b", fontSize: 14 }}>Loading library…</p>
              ) : filtered.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    textAlign: "center",
                    borderRadius: 12,
                    border: "2px dashed #cbd5e1",
                    color: "#64748b",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  No diagrams yet. Upload a ChatGPT-generated diagram to start your library.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: 12,
                  }}
                >
                  {filtered.map((asset) => {
                    const thumb = makeAbsoluteAssetUrl(asset.imageUrl) || asset.imageUrl;
                    return (
                      <div
                        key={asset.id}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                          overflow: "hidden",
                          background: "#f8fafc",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <div style={{ aspectRatio: "4/3", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={asset.title}
                              style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            />
                          ) : (
                            <div style={{ padding: 16, color: "#94a3b8", fontSize: 12 }}>No preview</div>
                          )}
                        </div>
                        <div style={{ padding: 10, flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.3 }}>{asset.title}</div>
                          {asset.topic ? (
                            <div style={{ fontSize: 12, color: "#64748b" }}>{asset.topic}</div>
                          ) : null}
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>
                            {[asset.subject, asset.examBoard, asset.tier].filter(Boolean).join(" · ")}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onAttach(asset);
                              onClose();
                            }}
                            style={{
                              marginTop: "auto",
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "2px solid rgba(34,197,94,0.4)",
                              background: "rgba(34,197,94,0.1)",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Attach
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
              <label style={{ display: "block" }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Image file</div>
                <input
                  type="file"
                  accept={ACCEPTED_UPLOAD}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setSelectedFile(f);
                    if (f && !uploadTitle.trim()) {
                      setUploadTitle(f.name.replace(/\.[^.]+$/, ""));
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              <label style={{ display: "block" }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Title</div>
                <input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Reflex arc overview"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid rgba(0,0,0,0.12)" }}
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Subject</div>
                  <input
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid rgba(0,0,0,0.12)" }}
                  />
                </label>
                <label>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Topic</div>
                  <input
                    value={uploadTopic}
                    onChange={(e) => setUploadTopic(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid rgba(0,0,0,0.12)" }}
                  />
                </label>
                <label>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Exam board</div>
                  <input
                    value={uploadExamBoard}
                    onChange={(e) => setUploadExamBoard(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid rgba(0,0,0,0.12)" }}
                  />
                </label>
                <label>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Tier</div>
                  <input
                    value={uploadTier}
                    onChange={(e) => setUploadTier(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid rgba(0,0,0,0.12)" }}
                  />
                </label>
              </div>
              <label style={{ display: "block" }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Keywords</div>
                <input
                  value={uploadKeywords}
                  onChange={(e) => setUploadKeywords(e.target.value)}
                  placeholder="reflex, neurone, stimulus"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid rgba(0,0,0,0.12)" }}
                />
              </label>
              <button
                type="button"
                disabled={uploading || !selectedFile}
                onClick={() => void handleUpload()}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "2px solid rgba(34,197,94,0.4)",
                  background: "rgba(34,197,94,0.12)",
                  fontWeight: 800,
                  cursor: uploading || !selectedFile ? "not-allowed" : "pointer",
                  opacity: uploading || !selectedFile ? 0.6 : 1,
                }}
              >
                {uploading ? "Uploading…" : "Upload and attach"}
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiagramAssetLibraryPanel;
