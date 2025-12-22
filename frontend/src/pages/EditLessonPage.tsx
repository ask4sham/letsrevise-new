import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const EditLessonPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    subject: "",
    level: "",
    topic: "",
    estimatedDuration: "",
    shamCoinPrice: "",
    tags: "",
    isPublished: false
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchLesson();
  }, [id]);

  const fetchLesson = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`http://localhost:5000/api/lessons/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const lesson = response.data;
      setFormData({
        title: lesson.title,
        description: lesson.description,
        content: lesson.content,
        subject: lesson.subject,
        level: lesson.level,
        topic: lesson.topic,
        estimatedDuration: lesson.estimatedDuration.toString(),
        shamCoinPrice: lesson.shamCoinPrice.toString(),
        tags: lesson.tags?.join(", ") || "",
        isPublished: lesson.isPublished
      });
    } catch (err) {
      setError("Failed to load lesson");
      console.error("Error fetching lesson:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const lessonData = {
        ...formData,
        estimatedDuration: parseInt(formData.estimatedDuration),
        shamCoinPrice: parseInt(formData.shamCoinPrice),
        tags: formData.tags.split(",").map(tag => tag.trim()).filter(tag => tag)
      };

      await axios.put(`http://localhost:5000/api/lessons/${id}`, lessonData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert("Lesson updated successfully!");
      navigate("/teacher-dashboard");
      
    } catch (err: any) {
      setError(err.response?.data?.msg || "Failed to update lesson");
      console.error("Error updating lesson:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>Loading Lesson...</h2>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1 style={{ marginBottom: "30px", color: "#333" }}>Edit Lesson</h1>
      
      {error && (
        <div style={{ 
          background: "#fee", 
          color: "#c00", 
          padding: "15px", 
          borderRadius: "8px", 
          marginBottom: "20px",
          border: "1px solid #fcc"
        }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: "white", padding: "30px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#333" }}>
            Title *
          </label>
          <input
            type="text"
            name="title"
            required
            value={formData.title}
            onChange={handleChange}
            style={{ width: "100%", padding: "12px", border: "2px solid #e2e8f0", borderRadius: "6px" }}
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#333" }}>
            Description *
          </label>
          <textarea
            name="description"
            required
            value={formData.description}
            onChange={handleChange}
            rows={3}
            style={{ width: "100%", padding: "12px", border: "2px solid #e2e8f0", borderRadius: "6px" }}
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#333" }}>
            Content *
          </label>
          <textarea
            name="content"
            required
            value={formData.content}
            onChange={handleChange}
            rows={8}
            style={{ width: "100%", padding: "12px", border: "2px solid #e2e8f0", borderRadius: "6px" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#333" }}>
              Subject *
            </label>
            <select
              name="subject"
              required
              value={formData.subject}
              onChange={handleChange}
              style={{ width: "100%", padding: "12px", border: "2px solid #e2e8f0", borderRadius: "6px" }}
            >
              <option value="">Select Subject</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Biology">Biology</option>
              <option value="English">English</option>
              <option value="History">History</option>
              <option value="Geography">Geography</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Economics">Economics</option>
              <option value="Business">Business</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#333" }}>
              Level *
            </label>
            <select
              name="level"
              required
              value={formData.level}
              onChange={handleChange}
              style={{ width: "100%", padding: "12px", border: "2px solid #e2e8f0", borderRadius: "6px" }}
            >
              <option value="">Select Level</option>
              <option value="KS3">KS3</option>
              <option value="GCSE">GCSE</option>
              <option value="A-Level">A-Level</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#333" }}>
            Topic *
          </label>
          <input
            type="text"
            name="topic"
            required
            value={formData.topic}
            onChange={handleChange}
            style={{ width: "100%", padding: "12px", border: "2px solid #e2e8f0", borderRadius: "6px" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#333" }}>
              Duration (minutes) *
            </label>
            <input
              type="number"
              name="estimatedDuration"
              required
              min="5"
              max="300"
              value={formData.estimatedDuration}
              onChange={handleChange}
              style={{ width: "100%", padding: "12px", border: "2px solid #e2e8f0", borderRadius: "6px" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#333" }}>
              Price (ShamCoins)
            </label>
            <input
              type="number"
              name="shamCoinPrice"
              min="0"
              value={formData.shamCoinPrice}
              onChange={handleChange}
              style={{ width: "100%", padding: "12px", border: "2px solid #e2e8f0", borderRadius: "6px" }}
            />
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#333" }}>
            Tags (comma separated)
          </label>
          <input
            type="text"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            placeholder="algebra, math, gcse"
            style={{ width: "100%", padding: "12px", border: "2px solid #e2e8f0", borderRadius: "6px" }}
          />
        </div>

        <div style={{ marginBottom: "30px", display: "flex", alignItems: "center" }}>
          <input
            type="checkbox"
            id="isPublished"
            name="isPublished"
            checked={formData.isPublished}
            onChange={handleChange}
            style={{ marginRight: "10px" }}
          />
          <label htmlFor="isPublished" style={{ fontWeight: "bold", color: "#333" }}>
            Publish this lesson (make it visible to students)
          </label>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "14px 28px",
              background: saving ? "#999" : "#667eea",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: saving ? "not-allowed" : "pointer"
            }}
          >
            {saving ? "Saving..." : "Update Lesson"}
          </button>
          
          <button
            type="button"
            onClick={() => navigate("/teacher-dashboard")}
            style={{
              padding: "14px 28px",
              background: "#e2e8f0",
              color: "#333",
              border: "none",
              borderRadius: "6px",
              fontSize: "16px",
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditLessonPage;