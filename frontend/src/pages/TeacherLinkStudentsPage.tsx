/**
 * Teacher class hub — replace raw Student ID linking with class management.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import Toast from "../components/Toast";
import {
  archiveClass,
  createClass,
  getMyClasses,
  getStudentClassErrorMessage,
  updateClass,
  type StudentClassSummary,
} from "../api/studentClasses";
import { getUserDisplayName } from "../utils/userDisplayName";
import "./TeacherClassPages.css";

function isTeacherOrAdmin(user: any) {
  const t = user?.userType;
  return t === "teacher" || t === "admin";
}

function formatMeta(cls: StudentClassSummary) {
  return [cls.subject, cls.board, cls.tier, cls.academicYear].filter(Boolean).join(" · ");
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

type ClassFormState = {
  name: string;
  description: string;
  subject: string;
  board: string;
  tier: string;
  academicYear: string;
};

const EMPTY_FORM: ClassFormState = {
  name: "",
  description: "",
  subject: "",
  board: "",
  tier: "",
  academicYear: "",
};

export default function TeacherLinkStudentsPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser({ watchLocation: true });
  const displayName = useMemo(() => getUserDisplayName(user), [user]);
  const isAllowed = isTeacherOrAdmin(user);

  const [classes, setClasses] = useState<StudentClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(
    null
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [editClass, setEditClass] = useState<StudentClassSummary | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<StudentClassSummary | null>(null);
  const [form, setForm] = useState<ClassFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getMyClasses();
      setClasses(rows);
    } catch (err) {
      setError(getStudentClassErrorMessage(err, "Failed to load classes."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAllowed) load();
  }, [isAllowed, load]);

  const activeClasses = classes.filter((c) => c.status === "active");
  const archivedClasses = classes.filter((c) => c.status === "archived");

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setCreateOpen(true);
  }

  function openEdit(cls: StudentClassSummary) {
    setForm({
      name: cls.name || "",
      description: cls.description || "",
      subject: cls.subject || "",
      board: cls.board || "",
      tier: cls.tier || "",
      academicYear: cls.academicYear || "",
    });
    setFormError(null);
    setEditClass(cls);
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setFormError("Class name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await createClass({
        name,
        description: form.description.trim() || undefined,
        subject: form.subject.trim() || undefined,
        board: form.board.trim() || undefined,
        tier: form.tier.trim() || undefined,
        academicYear: form.academicYear.trim() || undefined,
      });
      setCreateOpen(false);
      setToast({ message: "Class created.", type: "success" });
      navigate(`/teacher/classes/${created.publicId}`);
    } catch (err) {
      setFormError(getStudentClassErrorMessage(err, "Could not create class."));
    } finally {
      setSaving(false);
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editClass) return;
    const name = form.name.trim();
    if (!name) {
      setFormError("Class name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const updated = await updateClass(editClass.publicId, {
        name,
        description: form.description.trim(),
        subject: form.subject.trim() || null,
        board: form.board.trim() || null,
        tier: form.tier.trim() || null,
        academicYear: form.academicYear.trim() || null,
      });
      setClasses((prev) => prev.map((c) => (c.publicId === updated.publicId ? updated : c)));
      setEditClass(null);
      setToast({ message: "Class updated.", type: "success" });
    } catch (err) {
      setFormError(getStudentClassErrorMessage(err, "Could not update class."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      const archived = await archiveClass(archiveTarget.publicId);
      setClasses((prev) =>
        prev.map((c) =>
          c.publicId === archived.publicId
            ? { ...c, status: "archived", archivedAt: archived.archivedAt || new Date().toISOString() }
            : c
        )
      );
      setArchiveTarget(null);
      setToast({ message: "Class archived.", type: "success" });
    } catch (err) {
      setToast({
        message: getStudentClassErrorMessage(err, "Could not archive class."),
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!isAllowed) {
    return (
      <div className="teacher-classes">
        <h1 className="teacher-classes__title">Link students</h1>
        <p>You must be a teacher or admin to access this page.</p>
        <button className="teacher-classes__btn teacher-classes__btn--secondary" onClick={() => navigate("/")}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="teacher-classes">
      {toast && (
        <div className="teacher-classes__toast">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}

      <button
        type="button"
        className="teacher-classes__back"
        onClick={() => navigate("/teacher-dashboard")}
      >
        ← Back to teacher dashboard
      </button>

      <header className="teacher-classes__header">
        <div>
          <h1 className="teacher-classes__title">Link students</h1>
          <p className="teacher-classes__subtitle">
            Create a class, invite students by email and manage who has joined.
            {displayName ? ` Signed in as ${displayName}.` : ""}
          </p>
        </div>
        <div className="teacher-classes__actions">
          <button
            type="button"
            className="teacher-classes__btn teacher-classes__btn--primary"
            onClick={openCreate}
          >
            Create class
          </button>
        </div>
      </header>

      {loading && (
        <div className="teacher-classes__panel" aria-live="polite">
          Loading classes…
        </div>
      )}

      {!loading && error && (
        <div className="teacher-classes__panel" role="alert">
          <p className="teacher-classes__error">{error}</p>
          <button
            type="button"
            className="teacher-classes__btn teacher-classes__btn--secondary"
            onClick={load}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && activeClasses.length === 0 && (
        <div className="teacher-classes__panel teacher-classes__empty">
          <h2>You have not created a class yet.</h2>
          <p>Invite students by email once your first class is ready.</p>
          <button
            type="button"
            className="teacher-classes__btn teacher-classes__btn--primary"
            onClick={openCreate}
          >
            Create your first class
          </button>
        </div>
      )}

      {!loading && !error && activeClasses.length > 0 && (
        <section aria-label="Active classes">
          <div className="teacher-classes__grid">
            {activeClasses.map((cls) => (
              <article key={cls.publicId} className="teacher-classes__card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <h3>{cls.name}</h3>
                  <span className="teacher-classes__badge teacher-classes__badge--active">Active</span>
                </div>
                <p className="teacher-classes__meta">
                  {formatMeta(cls) || "No course details yet"}
                  {cls.createdAt ? ` · Created ${formatDate(cls.createdAt)}` : ""}
                </p>
                <div className="teacher-classes__card-actions">
                  <Link
                    to={`/teacher/classes/${cls.publicId}`}
                    className="teacher-classes__btn teacher-classes__btn--primary"
                    style={{ textDecoration: "none", textAlign: "center" }}
                  >
                    Open class
                  </Link>
                  <Link
                    to={`/teacher/classes/${cls.publicId}?add=1`}
                    className="teacher-classes__btn teacher-classes__btn--secondary"
                    style={{ textDecoration: "none", textAlign: "center" }}
                  >
                    Add students
                  </Link>
                  <button
                    type="button"
                    className="teacher-classes__btn teacher-classes__btn--ghost"
                    onClick={() => openEdit(cls)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="teacher-classes__btn teacher-classes__btn--danger"
                    onClick={() => setArchiveTarget(cls)}
                  >
                    Archive
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!loading && !error && archivedClasses.length > 0 && (
        <section aria-label="Archived classes">
          <h2 className="teacher-classes__section-title">Archived classes</h2>
          <div className="teacher-classes__grid">
            {archivedClasses.map((cls) => (
              <article key={cls.publicId} className="teacher-classes__card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <h3>{cls.name}</h3>
                  <span className="teacher-classes__badge teacher-classes__badge--archived">
                    Archived
                  </span>
                </div>
                <p className="teacher-classes__meta">{formatMeta(cls) || "No course details"}</p>
                <div className="teacher-classes__card-actions">
                  <Link
                    to={`/teacher/classes/${cls.publicId}`}
                    className="teacher-classes__btn teacher-classes__btn--secondary"
                    style={{ textDecoration: "none", textAlign: "center" }}
                  >
                    View class
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {(createOpen || editClass) && (
        <div
          className="teacher-classes__modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!saving) {
              setCreateOpen(false);
              setEditClass(null);
            }
          }}
        >
          <div
            className="teacher-classes__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="class-form-title">{editClass ? "Edit class" : "Create class"}</h2>
            <form className="teacher-classes__form" onSubmit={editClass ? submitEdit : submitCreate}>
              <div className="teacher-classes__field">
                <label htmlFor="class-name">Class name</label>
                <input
                  id="class-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Year 11 Biology"
                  maxLength={100}
                  required
                  autoFocus
                />
              </div>
              <div className="teacher-classes__field">
                <label htmlFor="class-description">Description (optional)</label>
                <textarea
                  id="class-description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  maxLength={500}
                />
              </div>
              <div className="teacher-classes__field">
                <label htmlFor="class-subject">Subject (optional)</label>
                <input
                  id="class-subject"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="Biology"
                />
              </div>
              <div className="teacher-classes__field">
                <label htmlFor="class-board">Exam board / course (optional)</label>
                <input
                  id="class-board"
                  value={form.board}
                  onChange={(e) => setForm((f) => ({ ...f, board: e.target.value }))}
                  placeholder="AQA"
                />
              </div>
              <div className="teacher-classes__field">
                <label htmlFor="class-tier">Tier (optional)</label>
                <input
                  id="class-tier"
                  value={form.tier}
                  onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}
                  placeholder="Higher"
                />
              </div>
              <div className="teacher-classes__field">
                <label htmlFor="class-year">Academic year (optional)</label>
                <input
                  id="class-year"
                  value={form.academicYear}
                  onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))}
                  placeholder="2025/26"
                />
              </div>
              {formError && (
                <p className="teacher-classes__error" role="alert">
                  {formError}
                </p>
              )}
              <div className="teacher-classes__modal-actions">
                <button
                  type="button"
                  className="teacher-classes__btn teacher-classes__btn--ghost"
                  disabled={saving}
                  onClick={() => {
                    setCreateOpen(false);
                    setEditClass(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="teacher-classes__btn teacher-classes__btn--primary"
                  disabled={saving}
                >
                  {saving ? "Saving…" : editClass ? "Save changes" : "Create class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {archiveTarget && (
        <div
          className="teacher-classes__modal-backdrop"
          role="presentation"
          onClick={() => !saving && setArchiveTarget(null)}
        >
          <div
            className="teacher-classes__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="archive-title">Archive {archiveTarget.name}?</h2>
            <p>
              Students will no longer receive invitations or gain Practice access through this class.
              Existing records and previous work will be preserved.
            </p>
            <div className="teacher-classes__modal-actions">
              <button
                type="button"
                className="teacher-classes__btn teacher-classes__btn--ghost"
                disabled={saving}
                onClick={() => setArchiveTarget(null)}
              >
                Keep class active
              </button>
              <button
                type="button"
                className="teacher-classes__btn teacher-classes__btn--danger"
                disabled={saving}
                onClick={confirmArchive}
              >
                {saving ? "Archiving…" : "Archive class"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
