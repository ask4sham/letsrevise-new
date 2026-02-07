import React, { useEffect, useState } from "react";
import api from "../services/api";

const AssessmentPaperBuilderPage: React.FC = () => {
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPapers = async () => {
      try {
        const res = await api.get("/assessment-papers");
        setPapers(res.data.papers || []);
      } catch (err) {
        console.error("Failed to load assessment papers", err);
      } finally {
        setLoading(false);
      }
    };

    loadPapers();
  }, []);

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading assessment papers…</div>;
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Assessment Papers</h1>

      {papers.length === 0 && (
        <p>No assessment papers created yet.</p>
      )}

      <ul>
        {papers.map(paper => (
          <li key={paper._id}>
            <strong>{paper.title}</strong> — {paper.subject} ({paper.kind})
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AssessmentPaperBuilderPage;
