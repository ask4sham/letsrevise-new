// /frontend/src/components/lesson/ImageUploader.tsx
import React from "react";
import axios from "axios";

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
      setError("Please choose an image first.");
      return;
    }

    try {
      setStatus("Uploading...");

      const form = new FormData();
      form.append("file", file);
      form.append("folder", folder);

      // ✅ Use same API base as the app (env-safe)
      // If you must hardcode locally, keep localhost, but env is safer for Netlify/Render.
      const RAW_API_BASE =
        process.env.REACT_APP_API_URL ||
        process.env.REACT_APP_API_BASE ||
        "http://localhost:5000";
      const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

      const res = await axios.post(`${API_BASE}/api/uploads/image`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const url = res.data?.url as string | undefined;
      if (!url) {
        throw new Error("Upload succeeded but no URL returned.");
      }

      // ✅ Build markdown snippet to auto-insert
      const markdown = `\n\n![${altText}](${url})\n\n`;

      setStatus("Uploaded ✅");

      // ✅ New callback (auto-insert)
      if (onInserted) {
        onInserted(markdown, url);
      }

      // ✅ Backwards-compatible callback
      if (onUploaded) {
        onUploaded(url);
      }

      setFile(null);
    } catch (e: any) {
      setStatus("");
      setError(e?.response?.data?.error || e?.message || "Upload failed.");
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
        Upload an image (PNG/JPG/WebP/GIF)
      </div>

      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
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
          Upload Image
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
