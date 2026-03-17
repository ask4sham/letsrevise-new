// /frontend/src/components/lesson/ImageUploader.tsx
import React from "react";
import api from "../../services/api";
import { toAbsoluteAssetUrl } from "../../services/mediaUrl";

type Props = {
  folder?: string; // e.g. "images/gcse"

  /**
   * Backwards-compatible: existing callers can keep using this to receive "/uploads/..."
   */
  onUploaded?: (publicUrl: string) => void;

  /**
   * ✅ NEW (recommended): caller can receive BOTH the markdown snippet and the URL
   * so the editor can auto-insert it into the text.
   */
  onInserted?: (markdown: string, publicUrl: string) => void;

  /**
   * Optional: customize the alt text that gets inserted.
   */
  altText?: string;
};

const ImageUploader: React.FC<Props> = ({
  folder = "images",
  onUploaded,
  onInserted,
  altText = "Uploaded image",
}) => {
  const [file, setFile] = React.useState<File | null>(null);
  const [status, setStatus] = React.useState<string>("");
  const [error, setError] = React.useState<string>("");

  const upload = async () => {
    setError("");
    setStatus("");

    if (!file) {
      setError("Please choose an image or video first.");
      return;
    }
    const isVideo = file.type.startsWith("video/");
    if (!file.type.startsWith("image/") && !isVideo) {
      setError("Please choose an image (png/jpg/webp/gif) or video (mp4/webm/mov).");
      return;
    }

    try {
      setStatus("Uploading...");

      const form = new FormData();
      form.append("file", file);
      const endpoint = isVideo ? "/uploads/video" : `/uploads/image?folder=${encodeURIComponent(folder)}`;
      if (!isVideo) form.append("folder", folder);

      const res = await api.post(endpoint, form);

      const url = res.data?.url as string | undefined;
      if (!url) {
        throw new Error("Upload succeeded but no URL returned.");
      }
      const absoluteUrl = toAbsoluteAssetUrl(url);

      // ✅ Build markdown snippet to auto-insert (image or video) — use absolute URL
      const markdown = isVideo
        ? `\n\n[Video: ${altText}](${absoluteUrl})\n\n`
        : `\n\n![${altText}](${absoluteUrl})\n\n`;

      setStatus("Uploaded ✅");

      // ✅ New callback (auto-insert)
      if (onInserted) {
        onInserted(markdown, absoluteUrl);
      }

      // ✅ Backwards-compatible callback
      if (onUploaded) {
        onUploaded(absoluteUrl);
      }

      setFile(null);
    } catch (e: any) {
      setStatus("");
      const reqUrl =
        e?.config?.url != null
          ? (e?.config?.baseURL || "") + e.config.url
          : (isVideo ? "/api/uploads/video" : "/api/uploads/image");
      const status = e?.response?.status;
      const body =
        e?.response?.data != null
          ? (typeof e.response.data === "object"
              ? (e.response.data?.error || e.response.data?.message || JSON.stringify(e.response.data))
              : String(e.response.data))
          : e?.message || "No response";
      setError(
        status != null
          ? `Upload failed. Request: POST ${reqUrl}. Response: ${status} — ${body}`
          : `Upload failed. Request: POST ${reqUrl}. ${body}`
      );
    }
  };

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 14,
        background: "white",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8 }}>
        Upload an image (PNG/JPG/WebP/GIF) or video (MP4/WebM/MOV)
      </div>

      <input
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={upload}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            background: "#3b82f6",
            color: "white",
            fontWeight: 800,
          }}
        >
          Upload
        </button>

        <div style={{ color: "#6b7280", fontSize: "0.95rem" }}>
          Folder: <code>{folder}</code>
        </div>

        {status ? (
          <div style={{ color: "#16a34a", fontWeight: 800 }}>{status}</div>
        ) : null}
        {error ? (
          <div style={{ color: "#dc2626", fontWeight: 800 }}>{error}</div>
        ) : null}
      </div>
    </div>
  );
};

export default ImageUploader;
