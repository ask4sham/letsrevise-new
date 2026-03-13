/**
 * Admin Taxonomy Manager — add/edit/delete main topics and sub-topics.
 * Admin only. Teachers have read-only access to taxonomy.
 */
import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useCurrentUser } from "../hooks/useCurrentUser";

interface SubTopic {
  topic: string;
  key: string;
  topicKey: string;
  _admin?: boolean;
}

interface MainTopic {
  unit: string;
  unitKey: string;
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
  const [editModal, setEditModal] = useState<{ _id: string; type: string; unit?: string; topic?: string } | null>(null);

  const [formSpecKey, setFormSpecKey] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formUnitKey, setFormUnitKey] = useState("");
  const [formSubTopicTitle, setFormSubTopicTitle] = useState("");
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
      });
      setMessage({ type: "success", text: `Sub-topic "${title}" added (${topicKey}).` });
      setAddSubtopicModal(false);
      setFormSubTopicTitle("");
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

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    setFormSaving(true);
    setMessage(null);
    try {
      await api.put(`/admin/taxonomy/items/${editModal._id}`, {
        unit: editModal.type === "unit" ? formUnit : undefined,
        subTopicTitle: editModal.type === "subTopic" ? formSubTopicTitle : undefined,
      });
      setMessage({ type: "success", text: "Updated." });
      setEditModal(null);
      fetchData();
    } catch (e: any) {
      setMessage({ type: "error", text: e?.response?.data?.error || e?.message || "Failed" });
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/taxonomy/items/${id}`);
      setMessage({ type: "success", text: "Deleted." });
      fetchData();
    } catch (e: any) {
      setMessage({ type: "error", text: e?.response?.data?.error || e?.message || "Failed" });
    }
  };

  const openAddSubtopic = (specKey: string, unit: string, unitKey: string) => {
    setFormSpecKey(specKey);
    setFormUnit(unit);
    setFormUnitKey(unitKey);
    setFormSubTopicTitle("");
    setAddSubtopicModal(true);
  };

  const openEdit = (item: { _id: string; type: string; unit?: string; topic?: string }) => {
    setEditModal(item);
    setFormUnit(item.unit || "");
    setFormSubTopicTitle(item.topic || "");
  };

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
                              <button type="button" onClick={() => handleDelete(item._id, mt.unit)} style={{ fontSize: 12, padding: "2px 8px", color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                            </>
                          ) : null;
                        })()}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "1.25rem", listStyle: "disc" }}>
                        {mt.subTopics.map((st) => (
                          <li key={st.key} style={{ padding: "2px 0", display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{st.topic}</span>
                            <span style={{ fontSize: 12, color: "#9ca3af" }}>({st.topicKey})</span>
                            {st._admin && (
                              <>
                                <span style={{ fontSize: 10, padding: "1px 4px", background: "#ede9fe", color: "#5b21b6", borderRadius: 2 }}>admin</span>
                                {(() => {
                                  const item = adminItems.find((i) => i.type === "subTopic" && i.key === st.key && i.specKey === spec.specKey && i.unitKey === mt.unitKey);
                                  return item ? (
                                    <>
                                      <button type="button" onClick={() => openEdit(item)} style={{ fontSize: 11, color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
                                      <button type="button" onClick={() => handleDelete(item._id, st.topic)} style={{ fontSize: 11, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                                    </>
                                  ) : null;
                                })()}
                              </>
                            )}
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
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setAddSubtopicModal(false)} style={{ padding: "0.5rem 1rem", background: "#f3f4f6", border: "none", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={formSaving} style={{ padding: "0.5rem 1rem", background: "#059669", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: formSaving ? "not-allowed" : "pointer" }}>{formSaving ? "Adding…" : "Add"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
