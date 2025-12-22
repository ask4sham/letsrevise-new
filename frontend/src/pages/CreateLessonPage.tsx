import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = "http://localhost:5000";

type UploadedImage = { url: string; filename: string; folder: string };

const EXAM_BOARDS = ["AQA", "OCR", "Edexcel", "WJEC"] as const;

type GcseTier = "" | "foundation" | "higher";

const CreateLessonPage: React.FC = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Image upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "Mathematics",
    level: "GCSE",
    board: "" as "" | (typeof EXAM_BOARDS)[number],
    tier: "" as GcseTier, // GCSE only
    topic: "",
    tags: "",
    content: "",
    externalResources: "",
    estimatedDuration: 60,
    shamCoinPrice: 0,
  });

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  const token = localStorage.getItem("token");

  const onChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "estimatedDuration" || name === "shamCoinPrice"
          ? Number(value)
          : (value as any),
    }));
  };

  // Upload image
  const handleImageUpload = async (file: File) => {
    try {
      setError("");
      setSuccess("");
      setUploadingImage(true);

      const form = new FormData();
      form.append("image", file);

      const res = await axios.post(
        `${API_BASE}/api/uploads/lesson-image`,
        form,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        }
      );

      if (!res.data?.url) throw new Error("Upload failed: no URL returned");

      const uploaded: UploadedImage = {
        url: res.data.url,
        filename: res.data.filename ?? file.name,
        folder: res.data.folder ?? "lesson-images",
      };

      setUploadedImages((prev) => [...prev, uploaded]);

      // Insert markdown image into content automatically
      setFormData((prev) => ({
        ...prev,
        content: `${prev.content}\n\n![${uploaded.filename}](${uploaded.url})\n`,
      }));

      setSuccess("✅ Image uploaded and added to lesson content.");
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Image upload failed."
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const validate = () => {
    if (!formData.title.trim()) return "Lesson Title is required.";
    if (!formData.description.trim())
      return "Short Description is required.";
    if (!formData.subject.trim()) return "Subject is required.";
    if (!formData.level.trim()) return "Level is required.";
    if (!formData.board.trim())
      return "Board is required (AQA/OCR/Edexcel/WJEC).";

    // GCSE: tier is mandatory
    if (formData.level === "GCSE" && !formData.tier.trim()) {
      return "Tier is required for GCSE lessons (Foundation or Higher).";
    }

    if (!formData.content.trim()) return "Lesson Content is required.";
    return "";
  };

  const handleSubmit = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      setSuccess("");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const payload: any = {
        title: formData.title,
        description: formData.description,
        subject: formData.subject,
        level: formData.level,
        board: formData.board,
        topic: formData.topic,
        tags: formData.tags,
        content: formData.content,
        externalResources: formData.externalResources,
        estimatedDuration: formData.estimatedDuration,
        shamCoinPrice: formData.shamCoinPrice,
        uploadedImages,
      };

      // Only send tier for GCSE lessons
      if (formData.level === "GCSE" && formData.tier) {
        payload.tier = formData.tier;
      }

      const baseHeaders = {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      };

      // First try: POST /api/lessons (newer REST style)
      let res;
      try {
        console.log("[CreateLesson] POST", `${API_BASE}/api/lessons`);
        res = await axios.post(`${API_BASE}/api/lessons`, payload, {
          headers: baseHeaders,
        });
      } catch (err: any) {
        const status = err?.response?.status;
        const apiMsg = err?.response?.data?.msg || err?.response?.data?.message;

        // If backend doesn't have POST /api/lessons, fall back to /api/lessons/create
        if (status === 404) {
          console.warn(
            "[CreateLesson] /api/lessons returned 404, trying /api/lessons/create"
          );

          res = await axios.post(
            `${API_BASE}/api/lessons/create`,
            payload,
            { headers: baseHeaders }
          );
        } else {
          throw new Error(apiMsg || err.message || "Failed to create lesson.");
        }
      }

      if (res.data?.success === false) {
        throw new Error(res.data?.message || "Create lesson failed");
      }

      setSuccess("✅ Lesson created successfully!");
      setTimeout(() => navigate("/teacher-dashboard"), 700);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.msg ||
          err?.message ||
          "Failed to create lesson."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #6b66d9 0%, #6c5ce7 50%, #7b68ee 100%)",
        padding: "30px 16px",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div
          style={{
            background: "white",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "18px 20px",
              background: "linear-gradient(135deg, #5b5fe3 0%, #7c3aed 100%)",
              color: "white",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              📘 Create New Lesson
            </div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              Keep it simple: fill the form and click Create Lesson.
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: 18 }}>
            {/* Alerts */}
            {error && (
              <div
                style={{
                  background: "#fee2e2",
                  color: "#991b1b",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #fecaca",
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {success && (
              <div
                style={{
                  background: "#dcfce7",
                  color: "#166534",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #bbf7d0",
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                {success}
              </div>
            )}

            {/* Upload Diagram / Image */}
            <div
              style={{
                border: "2px dashed rgba(245, 158, 11, 0.6)",
                borderRadius: 12,
                padding: 14,
                marginBottom: 14,
                background: "rgba(245, 158, 11, 0.06)",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 6 }}>
                🧩 Upload Diagram / Image
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(0,0,0,0.65)",
                  marginBottom: 10,
                }}
              >
                Upload an image and it will be inserted into lesson content
                automatically.
              </div>

              <input
                type="file"
                accept="image/*"
                disabled={uploadingImage}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                  e.currentTarget.value = "";
                }}
              />

              {uploadingImage && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: "rgba(0,0,0,0.6)",
                  }}
                >
                  Uploading image…
                </div>
              )}
            </div>

            {/* Basic Information */}
            <div style={{ marginBottom: 10, fontWeight: 800 }}>
              📌 Basic Information
            </div>

            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Lesson Title *
            </label>
            <input
              name="title"
              value={formData.title}
              onChange={onChange}
              placeholder="e.g. Introduction to Algebra"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                marginTop: 6,
                marginBottom: 12,
              }}
            />

            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Short Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={onChange}
              placeholder="Brief description of what students will learn…"
              rows={3}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                marginTop: 6,
                marginBottom: 14,
                resize: "vertical",
              }}
            />

            {/* Subject & Level */}
            <div style={{ marginBottom: 10, fontWeight: 800 }}>
              🎯 Subject & Level
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  Subject *
                </label>
                <select
                  name="subject"
                  value={formData.subject}
                  onChange={onChange}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    marginTop: 6,
                  }}
                >
                  <option>Mathematics</option>
                  <option>Biology</option>
                  <option>Chemistry</option>
                  <option>Physics</option>
                  <option>English</option>
                  <option>History</option>
                  <option>Geography</option>
                  <option>Computer Science</option>
                  <option>Business</option>
                  <option>Economics</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  Level *
                </label>
                <select
                  name="level"
                  value={formData.level}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      level: value,
                      tier: value === "GCSE" ? prev.tier : "",
                    }));
                  }}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    marginTop: 6,
                  }}
                >
                  <option>KS3</option>
                  <option>GCSE</option>
                  <option>A-Level</option>
                </select>
              </div>
            </div>

            {/* GCSE Tier */}
            {formData.level === "GCSE" && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Tier *</label>
                <select
                  name="tier"
                  value={formData.tier}
                  onChange={onChange}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    marginTop: 6,
                  }}
                >
                  <option value="">Select tier…</option>
                  <option value="foundation">Foundation</option>
                  <option value="higher">Higher</option>
                </select>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(0,0,0,0.55)",
                    marginTop: 4,
                  }}
                >
                  Only required for GCSE lessons.
                </div>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Board *</label>
              <select
                name="board"
                value={formData.board}
                onChange={onChange}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  marginTop: 6,
                }}
              >
                <option value="">Select board…</option>
                {EXAM_BOARDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700 }}>Topic / Unit</label>
            <input
              name="topic"
              value={formData.topic}
              onChange={onChange}
              placeholder="e.g. Quadratic Equations, Photosynthesis…"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                marginTop: 6,
                marginBottom: 12,
              }}
            />

            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Tags (comma separated)
            </label>
            <input
              name="tags"
              value={formData.tags}
              onChange={onChange}
              placeholder="e.g. algebra, equations, maths-basics"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                marginTop: 6,
                marginBottom: 14,
              }}
            />

            {/* Lesson Content */}
            <div style={{ marginBottom: 10, fontWeight: 800 }}>
              🧠 Lesson Content *
            </div>

            <div
              style={{
                fontSize: 12,
                color: "rgba(0,0,0,0.6)",
                marginBottom: 8,
              }}
            >
              You can use Markdown for formatting: <code>**bold**</code>, lists,
              images, links.
            </div>

            <textarea
              name="content"
              value={formData.content}
              onChange={onChange}
              placeholder="# Introduction..."
              rows={10}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                marginBottom: 14,
                resize: "vertical",
              }}
            />

            {/* External Resources */}
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              External Resources (comma separated URLs)
            </label>
            <input
              name="externalResources"
              value={formData.externalResources}
              onChange={onChange}
              placeholder="e.g. https://example.com/video, https://example.com/worksheet.pdf"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                marginTop: 6,
                marginBottom: 14,
              }}
            />

            {/* Lesson Settings */}
            <div style={{ marginBottom: 10, fontWeight: 800 }}>
              ⚙️ Lesson Settings
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  Estimated Duration (minutes)
                </label>
                <input
                  type="number"
                  name="estimatedDuration"
                  value={formData.estimatedDuration}
                  onChange={onChange}
                  min={0}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    marginTop: 6,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  ShamCoin Price (optional)
                </label>
                <input
                  type="number"
                  name="shamCoinPrice"
                  value={formData.shamCoinPrice}
                  onChange={onChange}
                  min={0}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    marginTop: 6,
                  }}
                />
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 18,
              }}
            >
              <button
                onClick={() => navigate("/teacher-dashboard")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#f3f4f6",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: loading ? "#9ca3af" : "#16a34a",
                  color: "white",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 800,
                }}
              >
                {loading ? "Creating…" : "✅ Create Lesson"}
              </button>
            </div>

            {/* small helper */}
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: "rgba(0,0,0,0.55)",
              }}
            >
              Logged in as: <strong>{user?.email || "Unknown"}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateLessonPage;
