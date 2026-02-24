/**
 * PR-PAST-PAPERS-UI-2: Detail panel for one past paper (info + questions + topics + link flow).
 */
import React, { useEffect, useState } from "react";
import type { PastPaper } from "../../api/pastPapers";
import {
  fetchPastPaperQuestions,
  createPastPaperQuestion,
  type PastPaperQuestionItem,
} from "../../api/pastPaperQuestions";
import type { TaxonomyResponse } from "../../api/taxonomy";
import { PastPaperQuestionsList } from "./PastPaperQuestionsList";
import { PastPaperTopicsSummary } from "./PastPaperTopicsSummary";
import { AddPastPaperQuestionModal } from "./AddPastPaperQuestionModal";
import { AttachFromBankModal } from "./AttachFromBankModal";

type Props = {
  paper: PastPaper;
  onClose: () => void;
  token: string;
  specKey: string;
  taxonomy: TaxonomyResponse | null;
};

export function PastPaperDetailPanel({ paper, onClose, token, specKey, taxonomy }: Props) {
  const [questions, setQuestions] = useState<PastPaperQuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await fetchPastPaperQuestions(paper._id, token);
      setQuestions(data.items);
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [paper._id, token]);

  const title = paper.title || `${paper.examBoard} ${paper.level} ${paper.year} ${paper.paperCode}`;
  const meta = [paper.year, paper.series, paper.tier, paper.paperCode].filter(Boolean).join(" · ") || "—";
  const totalMarks = questions.reduce((sum, q) => sum + (q.marks ?? 0), 0);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "stretch", justifyContent: "flex-end", background: "rgba(0,0,0,0.3)" }} onClick={onClose} />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "100%",
          maxWidth: 480,
          height: "100%",
          zIndex: 41,
          background: "#fff",
          boxShadow: "-4px 0 14px rgba(0,0,0,0.1)",
          overflow: "auto",
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Past paper detail</h2>
          <button type="button" onClick={onClose} style={{ padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer" }}>
            Close
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
          <span style={{ marginLeft: 8, padding: "2px 6px", borderRadius: 4, fontSize: 11, background: "#f3f4f6", color: "#4b5563", fontWeight: 600 }}>
            Teacher-uploaded
          </span>
          <div style={{ marginTop: 6, fontSize: 13, color: "#6b7280" }}>{meta}</div>
        </div>

        {paper.pdf?.url ? (
          <a
            href={paper.pdf.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-block", marginBottom: 16, padding: "8px 14px", borderRadius: 8, background: "#2563eb", color: "#fff", fontWeight: 600, fontSize: 13, textDecoration: "none" }}
          >
            View uploaded PDF
          </a>
        ) : (
          <span style={{ display: "block", marginBottom: 16, fontSize: 13, color: "#6b7280" }}>No PDF attached</span>
        )}

        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Linked questions</div>
        {loading ? (
          <p style={{ fontSize: 13, color: "#6b7280" }}>Loading…</p>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
              {questions.length} question{questions.length !== 1 ? "s" : ""}
              {totalMarks > 0 ? ` · ${totalMarks} marks total` : ""}
            </div>
            <PastPaperQuestionsList items={questions} taxonomy={taxonomy} />
            <PastPaperTopicsSummary items={questions} taxonomy={taxonomy} />
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              style={{ marginTop: 16, padding: "8px 14px", borderRadius: 8, border: "1px solid #059669", background: "#fff", color: "#059669", fontWeight: 600, cursor: "pointer" }}
            >
              Add question
            </button>
          </>
        )}

        <AddPastPaperQuestionModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          taxonomy={taxonomy}
          onSubmit={async (payload) => {
            await createPastPaperQuestion({
              token,
              pastPaperId: paper._id,
              topicKey: payload.topicKey,
              questionNumber: payload.questionNumber,
              marks: payload.marks ?? null,
              question: payload.question,
              markScheme: payload.markScheme,
            });
            await loadQuestions();
          }}
        />
        <AttachFromBankModal
          isOpen={attachOpen}
          onClose={() => setAttachOpen(false)}
          token={token}
          specKey={paper.specKey ?? specKey}
          pastPaperId={paper._id}
          taxonomy={taxonomy}
          onAttached={loadQuestions}
        />
      </div>
    </>
  );
}
