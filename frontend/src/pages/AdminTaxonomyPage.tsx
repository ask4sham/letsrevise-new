/**
 * Admin Taxonomy Manager — add/edit/delete main topics and sub-topics.
 * Admin only. Teachers have read-only access to taxonomy.
 */
import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  renameMainTopic,
  renameSubTopic,
  deleteMainTopic,
  deleteSubTopic,
  deleteSection,
  moveSubTopic,
} from "../api/adminTaxonomy";

interface SubTopic {
  topic: string;
  key: string;
  topicKey: string;
  _admin?: boolean;
}

interface Section {
  _id: string;
  title: string;
  slug: string;
  topics: SubTopic[];
}

interface MainTopic {
  unit: string;
  unitKey: string;
  _id?: string;
  sections?: Section[];
  directTopics?: SubTopic[];
  subTopics: SubTopic[];
  _admin?: boolean;
}

interface Spec {
  specKey: string;
  specLabel: string;
  mainTopics: MainTopic[];
}

interface Subject {
  subject: string;
  specs: Spec[];
}

function toSlug(s: string): string {
  if (!s || typeof s !== "string") return "";
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminTaxonomyPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser({ watchLocation: true });
  const [hierarchy, setHierarchy] = useState<Subject[]>([]);
  const [specs, setSpecs] = useState<Array<{ specKey: string; specLabel: string; subject: string; units: { unit: string; unitKey: string }[] }>>([]);
  const [adminItems, setAdminItems] = useState<Array<{ _id: string; type: string; specKey: string; unit: string; unitKey: string; topic?: string; key?: string; topicKey?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [addUnitModal, setAddUnitModal] = useState(false);
  const [addSubtopicModal, setAddSubtopicModal] = useState(false);
  const [addSectionModal, setAddSectionModal] = useState(false);
  const [editModal, setEditModal] = useState<{ _id: string; type: string; unit?: string; topic?: string } | null>(null);
  const [moveModal, setMoveModal] = useState<{ item: { _id: string; topic?: string; unitKey: string; specKey: string }; currentUnit: string } | null>(null);
  const [moveToSectionModal, setMoveToSectionModal] = useState<{
    topic: SubTopic;
    specKey: string;
    unitKey: string;
    unitLabel: string;
    /** Destination: "direct:unitKey" or "section:sectionId" */
    destination: string;
    adminItemId?: string;
  } | null>(null);
  const [moveTargetId, setMoveTargetId] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string; type: "unit" | "subTopic" | "section" } | null>(null);

  const [formSpecKey, setFormSpecKey] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formUnitKey, setFormUnitKey] = useState("");
  const [formSubTopicTitle, setFormSubTopicTitle] = useState("");
  /** Pattern B: optional mapping to canonical topic for bank / analytics */
  const [formMapCanonical, setFormMapCanonical] = useState("");
  const [formInheritBank, setFormInheritBank] = useState("");
  const [formInheritAnalytics, setFormInheritAnalytics] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hRes, sRes, iRes] = await Promise.all([
        api.get("/admin/taxonomy"),
        api.get("/admin/taxonomy/specs"),
        api.get("/admin/taxonomy/items"),
      ]);
      setHierarchy(hRes.data?.hierarchy ?? []);
      setSpecs(sRes.data?.specs ?? []);
      setAdminItems(iRes.data?.items ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Failed to load");
      setHierarchy([]);
      setSpecs([]);
      setAdminItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.userType !== "admin") {
      navigate("/dashboard");
      return;
    }
    fetchData();
  }, [user?.userType, navigate, fetchData]);

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const unitName = formUnit.trim();
    if (!unitName || !formSpecKey) return;
    setFormSaving(true);
    setMessage(null);
    try {
      await api.post("/admin/taxonomy/unit", { specKey: formSpecKey, unit: unitName });
      setMessage({ type: "success", text: `Main topic "${unitName}" added.` });
      setAddUnitModal(false);
      setFormUnit("");
      setFormSpecKey("");
      fetchData();
    } catch (e: any) {
      setMessage({ type: "error", text: e?.response?.data?.error || e?.message || "Failed" });
    } finally {
      setFormSaving(false);
    }
  };

  const handleAddSubtopic = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = formSubTopicTitle.trim();
    if (!title || !formSpecKey || !formUnitKey) return;
    const slug = toSlug(title);
    const topicKey = `${formSpecKey}:${slug}`;
    setFormSaving(true);
    setMessage(null);
    try {
      await api.post("/admin/taxonomy/subtopic", {
        specKey: formSpecKey,
        unitKey: formUnitKey,
        unit: formUnit,
        subTopicTitle: title,
        mapsToCanonicalKey: formMapCanonical.trim() || undefined,
        inheritQuestionBankFrom: formInheritBank.trim() || undefined,
        inheritAnalyticsFrom: formInheritAnalytics.trim() || undefined,
      });
      setMessage({ type: "success", text: `Sub-topic "${title}" added (${topicKey}).` });
      setAddSubtopicModal(false);
      setFormSubTopicTitle("");
      setFormMapCanonical("");
      setFormInheritBank("");
      setFormInheritAnalytics("");
      setFormUnit("");
      setFormUnitKey("");
      setFormSpecKey("");
      fetchData();
    } catch (e: any) {
      setMessage({ type: "error", text: e?.response?.data?.error || e?.message || "Failed" });
    } finally {
      setFormSaving(false);
    }
  };

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = formSubTopicTitle.trim();
    if (!title || !formSpecKey || !formUnitKey) return;
    setFormSaving(true);
    setMessage(null);
    try {
      await api.post("/admin/taxonomy/section", {
        specKey: formSpecKey,
        parentUnitKey: formUnitKey,
        title,
      });
      setMessage({ type: "success", text: `Section "${title}" added.` });
      setAddSectionModal(false);
      setFormSubTopicTitle("");
      setFormUnit("");
      setFormUnitKey("");
      setFormSpecKey("");
      fetchData();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.response?.data?.error || err?.message || "Failed" });
    } finally {
      setFormSaving(false);
    }
  };

  const handleMoveToSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveToSectionModal) return;
    setFormSaving(true);
    setMessage(null);
    try {
      const dest = moveToSectionModal.destination || "";
      const isDirect = dest.startsWith("direct:");
      const targetUnitKey = isDirect ? dest.slice(7) : "";
      const sectionId = dest.startsWith("section:") ? dest.slice(8) : null;

      if (moveToSectionModal.adminItemId) {
        if (sectionId) {
          await api.post(`/admin/taxonomy/sub-topic/${moveToSectionModal.adminItemId}/move`, {
            targetSectionId: sectionId,
          });
        } else {
          await api.post(`/admin/taxonomy/sub-topic/${moveToSectionModal.adminItemId}/move`, {
            targetUnitKey: targetUnitKey || undefined,
          });
        }
      } else {
        if (sectionId) {
          await api.post("/admin/taxonomy/topic-placement", {
            specKey: moveToSectionModal.specKey,
            topicSlug: moveToSectionModal.topic.key?.toLowerCase(),
            sectionId,
          });
        } else {
          await api.post("/admin/taxonomy/topic-placement", {
            specKey: moveToSectionModal.specKey,
            topicSlug: moveToSectionModal.topic.key?.toLowerCase(),
            sectionId: null,
          });
        }
      }
      setMessage({ type: "success", text: "Topic moved." });
      setMoveToSectionModal(null);
      fetchData();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.response?.data?.error || err?.message || "Failed" });
    } finally {
      setFormSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    setFormSaving(true);
    setMessage(null);
    try {
      if (editModal.type === "unit") {
        await renameMainTopic(editModal._id, { title: formUnit.trim() });
      } else {
        await renameSubTopic(editModal._id, { title: formSubTopicTitle.trim() });
      }
      setMessage({ type: "success", text: "Updated." });
      setEditModal(null);
      fetchData();
    } catch (e: any) {
      setMessage({ type: "error", text: e?.response?.data?.error || e?.message || "Failed" });
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (id: string, label: string, type: "unit" | "subTopic" | "section") => {
    if (!window.confirm(`Delete "${label}"?${type === "section" ? " Topics under it will revert to direct under main topic." : " This cannot be undone."}`)) return;
    try {
      if (type === "unit") await deleteMainTopic(id);
      else if (type === "section") await deleteSection(id);
      else await deleteSubTopic(id);
      setMessage({ type: "success", text: "Deleted." });
      fetchData();
    } catch (e: any) {
      const data = e?.response?.data;
      const msg = data?.error || e?.message || "Failed";
      const counts = data?.linkedCounts as { lessons?: number; flashcards?: number; quizzes?: number; examQuestions?: number } | undefined;
      const extra = counts ? ` (${[counts.lessons && `${counts.lessons} lessons`, counts.flashcards && `${counts.flashcards} flashcards`, counts.quizzes && `${counts.quizzes} quizzes`, counts.examQuestions && `${counts.examQuestions} exam questions`].filter(Boolean).join(", ")})` : "";
      setMessage({ type: "error", text: msg + extra });
    }
  };

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveModal || !moveTargetId.trim()) return;
    setFormSaving(true);
    setMessage(null);
    try {
      await moveSubTopic(moveModal.item._id, moveTargetId.trim());
      setMessage({ type: "success", text: "Sub-topic moved." });
      setMoveModal(null);
      setMoveTargetId("");
      fetchData();
    } catch (e: any) {
      setMessage({ type: "error", text: e?.response?.data?.error || e?.message || "Failed" });
    } finally {
      setFormSaving(false);
    }
  };

  const openAddSubtopic = (specKey: string, unit: string, unitKey: string) => {
    setFormSpecKey(specKey);
    setFormUnit(unit);
    setFormUnitKey(unitKey);
    setFormSubTopicTitle("");
    setAddSubtopicModal(true);
  };

  const openAddSection = (specKey: string, unit: string, unitKey: string) => {
    setFormSpecKey(specKey);
    setFormUnit(unit);
    setFormUnitKey(unitKey);
    setFormSubTopicTitle("");
    setAddSectionModal(true);
  };

  const openMoveToSection = (topic: SubTopic, specKey: string, unitKey: string, unitLabel: string, adminItemId?: string) => {
    const currentUk = (unitKey || "").trim().toLowerCase();
    setMoveToSectionModal({ topic, specKey, unitKey, unitLabel, destination: `direct:${currentUk}`, adminItemId });
  };

  const openEdit = (item: { _id: string; type: string; unit?: string; topic?: string }) => {
    setEditModal(item);
    setFormUnit(item.unit || "");
    setFormSubTopicTitle(item.topic || "");
  };

  const openMove = (item: { _id: string; topic?: string; unitKey: string; specKey: string }, currentUnit: string) => {
    setMoveModal({ item, currentUnit });
    setMoveTargetId("");
  };

  const moveTargetOptions = moveModal
    ? adminItems.filter((i) => i.type === "unit" && i.specKey === moveModal.item.specKey && i.unitKey !== moveModal.item.unitKey)
    : [];

  if (user?.userType !== "admin") return null;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem" }}>
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 0 }}>Curriculum / Taxonomy</h1>
          <p style={{ color: "#6b7280", marginTop: "0.25rem" }}>Manage subjects, main topics, and sub-topics for lessons and question banks</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => { setFormSpecKey(specs[0]?.specKey || ""); setFormUnit(""); setAddUnitModal(true); }}
            style={{ padding: "0.5rem 1rem", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
          >
            + Add Main Topic
          </button>
          <button
            type="button"
            onClick={() => { const s = specs[0]; if (s?.units?.[0]) openAddSubtopic(s.specKey, s.units[0].unit, s.units[0].unitKey); else setAddSubtopicModal(true); }}
            style={{ padding: "0.5rem 1rem", background: "#059669", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
          >
            + Add Sub-topic
          </button>
          <Link
            to="/admin"
            style={{ padding: "0.5rem 1rem", background: "#f3f4f6", color: "#374151", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}
          >
            ← Admin
          </Link>
        </div>
      </div>

      {message && (
        <div style={{ padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: 8, background: message.type === "success" ? "#d1fae5" : "#fee2e2", color: message.type === "success" ? "#065f46" : "#991b1b" }}>
          {message.text}
        </div>
      )}

      {error && (
        <div style={{ padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: 8, background: "#fee2e2", color: "#991b1b" }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading…</p>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          {hierarchy.map((subj) => (
            <div key={subj.subject} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ padding: "1rem 1.25rem", background: "#f9fafb", fontWeight: 700, fontSize: "1.1rem" }}>
                {subj.subject}
              </div>
              {subj.specs.map((spec) => (
                <div key={spec.specKey} style={{ paddingLeft: "1.5rem", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ padding: "0.75rem 0", fontWeight: 600, color: "#4b5563" }}>
                    {spec.specLabel}
                  </div>
                  {spec.mainTopics.map((mt) => (
                    <div key={mt.unitKey} style={{ paddingLeft: "1.5rem", marginBottom: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.5rem 0" }}>
                        <span style={{ fontWeight: 600 }}>{mt.unit}</span>
                        {mt._admin && <span style={{ fontSize: 11, padding: "2px 6px", background: "#ede9fe", color: "#5b21b6", borderRadius: 4 }}>admin</span>}
                        <button
                          type="button"
                          onClick={() => { setFormSpecKey(spec.specKey); setFormUnitKey(mt.unitKey); setFormUnit(mt.unit); setFormSubTopicTitle(""); setAddSectionModal(true); }}
                          style={{ fontSize: 12, padding: "2px 8px", color: "#0369a1", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                        >
                          + Section
                        </button>
                        <button
                          type="button"
                          onClick={() => openAddSubtopic(spec.specKey, mt.unit, mt.unitKey)}
                          style={{ fontSize: 12, padding: "2px 8px", color: "#059669", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                        >
                          + Sub-topic
                        </button>
                        {mt._admin && (() => {
                          const item = adminItems.find((i) => i.type === "unit" && i.unitKey === mt.unitKey && i.specKey === spec.specKey);
                          return item ? (
                            <>
                              <button type="button" onClick={() => openEdit(item)} style={{ fontSize: 12, padding: "2px 8px", color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
                              <button type="button" onClick={() => handleDelete(item._id, mt.unit, "unit")} style={{ fontSize: 12, padding: "2px 8px", color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                            </>
                          ) : null;
                        })()}
                      </div>
                      {(mt.sections || []).map((sec) => (
                        <div key={sec._id} style={{ paddingLeft: "1rem", marginBottom: "0.25rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13, color: "#0369a1", marginBottom: 2 }}>
                            <span>§ {sec.title}</span>
                            <button type="button" onClick={() => handleDelete(sec._id, sec.title, "section")} style={{ fontSize: 11, padding: "2px 6px", color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                          </div>
                          <ul style={{ margin: 0, paddingLeft: "1rem", listStyle: "disc" }}>
                            {sec.topics.map((st) => (
                              <li key={st.key} style={{ padding: "2px 0", display: "flex", alignItems: "center", gap: 8 }}>
                                <span>{st.topic}</span>
                                <span style={{ fontSize: 12, color: "#9ca3af" }}>({st.topicKey})</span>
                                {!st._admin && <span style={{ fontSize: 10, color: "#9ca3af" }} title="Static topic: Move only">static</span>}
                                <button type="button" onClick={() => openMoveToSection(st, spec.specKey, mt.unitKey, mt.unit, adminItems.find((i) => i.type === "subTopic" && (i.key || "").toLowerCase() === (st.key || "").toLowerCase() && i.specKey === spec.specKey && (i.unitKey || "").toLowerCase() === (mt.unitKey || "").toLowerCase())?._id)} style={{ fontSize: 11, color: "#059669", background: "none", border: "none", cursor: "pointer" }}>Move</button>
                                {st._admin && (() => {
                                  const item = adminItems.find((i) => i.type === "subTopic" && (i.key || "").toLowerCase() === (st.key || "").toLowerCase() && i.specKey === spec.specKey && (i.unitKey || "").toLowerCase() === (mt.unitKey || "").toLowerCase());
                                  return item ? (
                                    <>
                                      <button type="button" onClick={() => openEdit(item)} style={{ fontSize: 11, color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
                                      <button type="button" onClick={() => handleDelete(item._id, st.topic, "subTopic")} style={{ fontSize: 11, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                                    </>
                                  ) : null;
                                })()}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <ul style={{ margin: 0, paddingLeft: "1.25rem", listStyle: "disc" }}>
                        {(mt.directTopics || mt.subTopics || []).map((st) => (
                          <li key={st.key} style={{ padding: "2px 0", display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{st.topic}</span>
                            <span style={{ fontSize: 12, color: "#9ca3af" }}>({st.topicKey})</span>
                            {!st._admin && <span style={{ fontSize: 10, color: "#9ca3af" }} title="Static topic: Move only">static</span>}
                            <button type="button" onClick={() => openMoveToSection(st, spec.specKey, mt.unitKey, mt.unit, adminItems.find((i) => i.type === "subTopic" && (i.key || "").toLowerCase() === (st.key || "").toLowerCase() && i.specKey === spec.specKey && (i.unitKey || "").toLowerCase() === (mt.unitKey || "").toLowerCase())?._id)} style={{ fontSize: 11, color: "#059669", background: "none", border: "none", cursor: "pointer" }}>Move</button>
                            {st._admin && (() => {
                              const item = adminItems.find((i) => i.type === "subTopic" && (i.key || "").toLowerCase() === (st.key || "").toLowerCase() && i.specKey === spec.specKey && (i.unitKey || "").toLowerCase() === (mt.unitKey || "").toLowerCase());
                              return item ? (
                                <>
                                  <button type="button" onClick={() => openEdit(item)} style={{ fontSize: 11, color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
                                  <button type="button" onClick={() => handleDelete(item._id, st.topic, "subTopic")} style={{ fontSize: 11, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                                </>
                              ) : null;
                            })()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Add Main Topic modal */}
      {addUnitModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#fff", padding: "1.5rem 2rem", borderRadius: 12, maxWidth: 400, boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 1rem" }}>Add Main Topic</h3>
            <form onSubmit={handleAddUnit}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Spec</label>
                <select value={formSpecKey} onChange={(e) => setFormSpecKey(e.target.value)} required style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}>
                  <option value="">— Select spec —</option>
                  {specs.map((s) => (
                    <option key={s.specKey} value={s.specKey}>{s.specLabel}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Main topic</label>
                <input type="text" value={formUnit} onChange={(e) => { setFormUnit(e.target.value); setFormUnitKey(toSlug(e.target.value)); }} placeholder="e.g. Cell Biology" required style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db" }} />
                {formUnit && <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>slug: {toSlug(formUnit)}</p>}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setAddUnitModal(false)} style={{ padding: "0.5rem 1rem", background: "#f3f4f6", border: "none", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={formSaving} style={{ padding: "0.5rem 1rem", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: formSaving ? "not-allowed" : "pointer" }}>{formSaving ? "Adding…" : "Add"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Section modal */}
      {addSectionModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#fff", padding: "1.5rem 2rem", borderRadius: 12, maxWidth: 400, boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 1rem" }}>Add Section</h3>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: "1rem" }}>Under: {formUnit}</p>
            <form onSubmit={handleAddSection}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Section title</label>
                <input type="text" value={formSubTopicTitle} onChange={(e) => setFormSubTopicTitle(e.target.value)} placeholder="e.g. Cell Division" required style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db" }} />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setAddSectionModal(false)} style={{ padding: "0.5rem 1rem", background: "#f3f4f6", border: "none", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={formSaving} style={{ padding: "0.5rem 1rem", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: formSaving ? "not-allowed" : "pointer" }}>{formSaving ? "Adding…" : "Add"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Sub-topic modal */}
      {addSubtopicModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#fff", padding: "1.5rem 2rem", borderRadius: 12, maxWidth: 400, boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 1rem" }}>Add Sub-topic</h3>
            <form onSubmit={handleAddSubtopic}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Spec</label>
                <select value={formSpecKey} onChange={(e) => { setFormSpecKey(e.target.value); const s = specs.find(x => x.specKey === e.target.value); if (s?.units?.[0]) { setFormUnit(s.units[0].unit); setFormUnitKey(s.units[0].unitKey); } }} required style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}>
                  <option value="">— Select spec —</option>
                  {specs.map((s) => (
                    <option key={s.specKey} value={s.specKey}>{s.specLabel}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Main topic</label>
                <select value={formUnitKey} onChange={(e) => { const u = specs.find(s => s.specKey === formSpecKey)?.units.find(x => x.unitKey === e.target.value); if (u) { setFormUnit(u.unit); setFormUnitKey(u.unitKey); } }} required style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}>
                  <option value="">— Select main topic —</option>
                  {specs.find(s => s.specKey === formSpecKey)?.units.map((u) => (
                    <option key={u.unitKey} value={u.unitKey}>{u.unit}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Sub-topic title</label>
                <input type="text" value={formSubTopicTitle} onChange={(e) => setFormSubTopicTitle(e.target.value)} placeholder="e.g. Scale and size of cells" required style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db" }} />
                {formSubTopicTitle && (
                  <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    slug: {toSlug(formSubTopicTitle)} → topicKey: {formSpecKey}:{toSlug(formSubTopicTitle)}
                  </p>
                )}
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Map to canonical topic (optional)</label>
                <input
                  type="text"
                  value={formMapCanonical}
                  onChange={(e) => setFormMapCanonical(e.target.value)}
                  placeholder="e.g. aqa-gcse-biology:digestive-system"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Question bank topicKey (optional)</label>
                <input
                  type="text"
                  value={formInheritBank}
                  onChange={(e) => setFormInheritBank(e.target.value)}
                  placeholder="defaults to map above if set"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Analytics rollup topicKey (optional)</label>
                <input
                  type="text"
                  value={formInheritAnalytics}
                  onChange={(e) => setFormInheritAnalytics(e.target.value)}
                  placeholder="defaults to map above if set"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setAddSubtopicModal(false)} style={{ padding: "0.5rem 1rem", background: "#f3f4f6", border: "none", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={formSaving} style={{ padding: "0.5rem 1rem", background: "#059669", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: formSaving ? "not-allowed" : "pointer" }}>{formSaving ? "Adding…" : "Add"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Topic modal — destinations grouped by main topic */}
      {moveToSectionModal && (() => {
        const spec = hierarchy.flatMap((s) => s.specs || []).find((sp) => sp.specKey === moveToSectionModal.specKey);
        const currentUk = (moveToSectionModal.unitKey || "").trim().toLowerCase();
        const isStaticTopic = !moveToSectionModal.adminItemId;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
            <div style={{ background: "#fff", padding: "1.5rem 2rem", borderRadius: 12, maxWidth: 420, boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
              <h3 style={{ margin: "0 0 1rem" }}>Move Topic</h3>
              <p style={{ fontSize: 14, color: "#6b7280", marginBottom: "1rem" }}>Move &quot;{moveToSectionModal.topic.topic}&quot; to:</p>
              <form onSubmit={handleMoveToSection}>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Destination</label>
                  <select
                    value={moveToSectionModal.destination}
                    onChange={(e) => setMoveToSectionModal((p) => (p ? { ...p, destination: e.target.value } : null))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
                  >
                    {(spec?.mainTopics || []).map((mt) => {
                      const uk = (mt.unitKey || toSlug(mt.unit || "")).toLowerCase();
                      const showDirect = isStaticTopic ? uk === currentUk : true;
                      return (
                        <optgroup key={mt.unitKey} label={mt.unit}>
                          {showDirect && (
                            <option value={`direct:${uk}`}>Direct under main topic</option>
                          )}
                          {(mt.sections || []).map((sec) => (
                            <option key={sec._id} value={`section:${sec._id}`}>{sec.title || sec.slug}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setMoveToSectionModal(null)} style={{ padding: "0.5rem 1rem", background: "#f3f4f6", border: "none", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={formSaving} style={{ padding: "0.5rem 1rem", background: "#059669", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: formSaving ? "not-allowed" : "pointer" }}>{formSaving ? "Moving…" : "Move"}</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Edit modal */}
      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#fff", padding: "1.5rem 2rem", borderRadius: 12, maxWidth: 400, boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 1rem" }}>Edit {editModal.type === "unit" ? "Main Topic" : "Sub-topic"}</h3>
            <form onSubmit={handleEdit}>
              {editModal.type === "unit" && (
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Main topic</label>
                  <input type="text" value={formUnit} onChange={(e) => setFormUnit(e.target.value)} required style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db" }} />
                </div>
              )}
              {editModal.type === "subTopic" && (
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Sub-topic title</label>
                  <input type="text" value={formSubTopicTitle} onChange={(e) => setFormSubTopicTitle(e.target.value)} required style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db" }} />
                </div>
              )}
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setEditModal(null)} style={{ padding: "0.5rem 1rem", background: "#f3f4f6", border: "none", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={formSaving} style={{ padding: "0.5rem 1rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: formSaving ? "not-allowed" : "pointer" }}>{formSaving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
