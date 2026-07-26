/**
 * Teacher class detail — roster, invitations, add students (single/paste/CSV).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import Toast from "../components/Toast";
import {
  archiveClass,
  cancelInvitation,
  createInvitations,
  getClass,
  getClassStudents,
  getInvitations,
  getStudentClassErrorMessage,
  previewCsv,
  previewEmailInput,
  removeClassStudent,
  resendInvitation,
  updateClass,
  type InvitationPreview,
  type StudentClassDetail,
  type StudentClassInvitation,
  type StudentClassMember,
} from "../api/studentClasses";
import "./TeacherClassPages.css";

function isTeacherOrAdmin(user: any) {
  const t = user?.userType;
  return t === "teacher" || t === "admin";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

function invitationLabel(status: string) {
  if (status === "accepted") return "Linked";
  if (status === "pending") return "Pending";
  if (status === "declined") return "Declined";
  if (status === "cancelled") return "Cancelled";
  if (status === "expired") return "Expired";
  return status;
}

function badgeClass(status: string) {
  if (status === "accepted") return "teacher-classes__badge--linked";
  if (status === "pending") return "teacher-classes__badge--pending";
  if (status === "declined") return "teacher-classes__badge--declined";
  return "teacher-classes__badge--muted";
}

function invalidEntryText(entry: InvitationPreview["invalidEntries"][number]) {
  if (typeof entry === "string") return entry;
  const bits = [entry.value];
  if (entry.row != null) bits.unshift(`Row ${entry.row}`);
  if (entry.reason) bits.push(entry.reason);
  return bits.join(" — ");
}

type MainTab = "students" | "invitations" | "settings";
type AddMode = "paste" | "single" | "csv";

export default function TeacherClassDetailPage() {
  const { classPublicId = "" } = useParams<{ classPublicId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useCurrentUser({ watchLocation: true });
  const isAllowed = isTeacherOrAdmin(user);

  const [cls, setCls] = useState<StudentClassDetail | null>(null);
  const [invitations, setInvitations] = useState<StudentClassInvitation[]>([]);
  const [students, setStudents] = useState<StudentClassMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(
    null
  );

  const [mainTab, setMainTab] = useState<MainTab>(
    searchParams.get("add") === "1" ? "invitations" : "students"
  );
  const [addMode, setAddMode] = useState<AddMode>("paste");
  const [showAddPanel, setShowAddPanel] = useState(searchParams.get("add") === "1");

  const [singleEmail, setSingleEmail] = useState("");
  const [pasteInput, setPasteInput] = useState("");
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const [cancelTarget, setCancelTarget] = useState<StudentClassInvitation | null>(null);
  const [removeTarget, setRemoveTarget] = useState<StudentClassMember | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const [settingsForm, setSettingsForm] = useState({
    name: "",
    description: "",
    subject: "",
    board: "",
    tier: "",
    academicYear: "",
  });
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const archived = cls?.status === "archived";

  const counts = useMemo(() => {
    const pending = invitations.filter((i) => i.status === "pending").length;
    const linked = invitations.filter((i) => i.status === "accepted").length;
    const declined = invitations.filter((i) => i.status === "declined").length;
    const other = invitations.filter((i) =>
      ["cancelled", "expired"].includes(i.status)
    ).length;
    return { pending, linked, declined, other, roster: students.length };
  }, [invitations, students]);

  const load = useCallback(async () => {
    if (!classPublicId) return;
    setLoading(true);
    setError(null);
    try {
      const [classDoc, invs, roster] = await Promise.all([
        getClass(classPublicId),
        getInvitations(classPublicId),
        getClassStudents(classPublicId),
      ]);
      setCls(classDoc);
      setInvitations(invs);
      setStudents(roster);
      setSettingsForm({
        name: classDoc.name || "",
        description: classDoc.description || "",
        subject: classDoc.subject || "",
        board: classDoc.board || "",
        tier: classDoc.tier || "",
        academicYear: classDoc.academicYear || "",
      });
    } catch (err) {
      setError(getStudentClassErrorMessage(err, "Failed to load class."));
    } finally {
      setLoading(false);
    }
  }, [classPublicId]);

  useEffect(() => {
    if (isAllowed) load();
  }, [isAllowed, load]);

  useEffect(() => {
    if (searchParams.get("add") === "1") {
      setShowAddPanel(true);
      setMainTab("invitations");
      const next = new URLSearchParams(searchParams);
      next.delete("add");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  async function runPreviewFromPaste() {
    setPreviewing(true);
    setAddError(null);
    setPreview(null);
    try {
      const result = await previewEmailInput(classPublicId, pasteInput);
      setPreview(result);
    } catch (err) {
      setAddError(getStudentClassErrorMessage(err, "Could not preview emails."));
    } finally {
      setPreviewing(false);
    }
  }

  async function runPreviewFromSingle() {
    setPreviewing(true);
    setAddError(null);
    setPreview(null);
    try {
      const result = await previewEmailInput(classPublicId, singleEmail.trim());
      setPreview(result);
    } catch (err) {
      setAddError(getStudentClassErrorMessage(err, "Could not preview email."));
    } finally {
      setPreviewing(false);
    }
  }

  async function runPreviewFromCsv() {
    if (!csvFile) {
      setAddError("Choose a CSV file first.");
      return;
    }
    const name = csvFile.name.toLowerCase();
    if (!name.endsWith(".csv")) {
      setAddError("Only .csv files are allowed.");
      return;
    }
    setPreviewing(true);
    setAddError(null);
    setPreview(null);
    try {
      const result = await previewCsv(classPublicId, csvFile);
      setPreview(result);
    } catch (err) {
      setAddError(getStudentClassErrorMessage(err, "Could not preview CSV."));
    } finally {
      setPreviewing(false);
    }
  }

  async function sendValidInvitations() {
    if (!preview?.validEmails?.length) return;
    setSending(true);
    setAddError(null);
    try {
      await createInvitations(classPublicId, preview.validEmails);
      setToast({
        message: "Invitations sent. Students will see the request when they sign in.",
        type: "success",
      });
      setPreview(null);
      setPasteInput("");
      setSingleEmail("");
      setCsvFile(null);
      setShowAddPanel(false);
      await load();
      setMainTab("invitations");
    } catch (err) {
      setAddError(getStudentClassErrorMessage(err, "Could not send invitations."));
    } finally {
      setSending(false);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setBusyAction(true);
    try {
      const updated = await cancelInvitation(classPublicId, cancelTarget.publicId);
      setInvitations((prev) =>
        prev.map((i) => (i.publicId === updated.publicId ? { ...i, ...updated } : i))
      );
      setCancelTarget(null);
      setToast({ message: "Invitation cancelled.", type: "success" });
    } catch (err) {
      setToast({
        message: getStudentClassErrorMessage(err, "Could not cancel invitation."),
        type: "error",
      });
    } finally {
      setBusyAction(false);
    }
  }

  async function onResend(inv: StudentClassInvitation) {
    setBusyAction(true);
    try {
      const updated = await resendInvitation(classPublicId, inv.publicId);
      setInvitations((prev) =>
        prev.map((i) => (i.publicId === updated.publicId ? { ...i, ...updated } : i))
      );
      setToast({ message: "Invitation resent.", type: "success" });
    } catch (err) {
      setToast({
        message: getStudentClassErrorMessage(err, "Could not resend invitation."),
        type: "error",
      });
    } finally {
      setBusyAction(false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setBusyAction(true);
    try {
      await removeClassStudent(classPublicId, removeTarget.membershipPublicId);
      setStudents((prev) =>
        prev.filter((s) => s.membershipPublicId !== removeTarget.membershipPublicId)
      );
      setRemoveTarget(null);
      setToast({ message: "Student removed from this class.", type: "success" });
      // Refresh invitations so accepted row stays historically accurate
      const invs = await getInvitations(classPublicId);
      setInvitations(invs);
    } catch (err) {
      setToast({
        message: getStudentClassErrorMessage(err, "Could not remove student."),
        type: "error",
      });
    } finally {
      setBusyAction(false);
    }
  }

  async function confirmArchive() {
    setBusyAction(true);
    try {
      const archivedClass = await archiveClass(classPublicId);
      setCls((prev) =>
        prev
          ? {
              ...prev,
              status: "archived",
              archivedAt: archivedClass.archivedAt || new Date().toISOString(),
            }
          : prev
      );
      setArchiveOpen(false);
      setShowAddPanel(false);
      setToast({ message: "Class archived.", type: "success" });
    } catch (err) {
      setToast({
        message: getStudentClassErrorMessage(err, "Could not archive class."),
        type: "error",
      });
    } finally {
      setBusyAction(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const name = settingsForm.name.trim();
    if (!name) {
      setSettingsError("Class name is required.");
      return;
    }
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const updated = await updateClass(classPublicId, {
        name,
        description: settingsForm.description.trim(),
        subject: settingsForm.subject.trim() || null,
        board: settingsForm.board.trim() || null,
        tier: settingsForm.tier.trim() || null,
        academicYear: settingsForm.academicYear.trim() || null,
      });
      setCls(updated);
      setToast({ message: "Class settings saved.", type: "success" });
    } catch (err) {
      setSettingsError(getStudentClassErrorMessage(err, "Could not save settings."));
    } finally {
      setSettingsSaving(false);
    }
  }

  if (!isAllowed) {
    return (
      <div className="teacher-classes">
        <h1 className="teacher-classes__title">Class</h1>
        <p>You must be a teacher or admin to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="teacher-classes">
        <div className="teacher-classes__panel" aria-live="polite">
          Loading class…
        </div>
      </div>
    );
  }

  if (error || !cls) {
    return (
      <div className="teacher-classes">
        <Link to="/teacher/ops/link-students" className="teacher-classes__back">
          ← Back to classes
        </Link>
        <div className="teacher-classes__panel" role="alert">
          <p className="teacher-classes__error">{error || "Class not found."}</p>
          <button
            type="button"
            className="teacher-classes__btn teacher-classes__btn--secondary"
            onClick={load}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const meta = [cls.subject, cls.board, cls.tier, cls.academicYear].filter(Boolean).join(" · ");

  return (
    <div className="teacher-classes">
      {toast && (
        <div className="teacher-classes__toast">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}

      <Link to="/teacher/ops/link-students" className="teacher-classes__back">
        ← Back to classes
      </Link>

      <header className="teacher-classes__header">
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <h1 className="teacher-classes__title">{cls.name}</h1>
            <span
              className={`teacher-classes__badge ${
                archived
                  ? "teacher-classes__badge--archived"
                  : "teacher-classes__badge--active"
              }`}
            >
              {archived ? "Archived" : "Active"}
            </span>
          </div>
          <p className="teacher-classes__subtitle">
            {meta || "No course details yet"}
            {cls.description ? ` — ${cls.description}` : ""}
          </p>
        </div>
        <div className="teacher-classes__actions">
          {!archived && (
            <button
              type="button"
              className="teacher-classes__btn teacher-classes__btn--primary"
              onClick={() => {
                setShowAddPanel(true);
                setMainTab("invitations");
              }}
            >
              Add students
            </button>
          )}
          <button
            type="button"
            className="teacher-classes__btn teacher-classes__btn--secondary"
            onClick={() => setMainTab("settings")}
          >
            Edit class
          </button>
          {!archived && (
            <button
              type="button"
              className="teacher-classes__btn teacher-classes__btn--danger"
              onClick={() => setArchiveOpen(true)}
            >
              Archive class
            </button>
          )}
        </div>
      </header>

      <div className="teacher-classes__summary" aria-label="Class summary">
        <div className="teacher-classes__summary-card">
          <span>Linked</span>
          <strong>{counts.roster}</strong>
        </div>
        <div className="teacher-classes__summary-card">
          <span>Pending</span>
          <strong>{counts.pending}</strong>
        </div>
        <div className="teacher-classes__summary-card">
          <span>Declined</span>
          <strong>{counts.declined}</strong>
        </div>
        <div className="teacher-classes__summary-card">
          <span>Cancelled / Expired</span>
          <strong>{counts.other}</strong>
        </div>
      </div>

      <div className="teacher-classes__tabs" role="tablist" aria-label="Class sections">
        {(
          [
            ["students", "Students"],
            ["invitations", "Invitations"],
            ["settings", "Class settings"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className="teacher-classes__tab"
            aria-selected={mainTab === id}
            onClick={() => setMainTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {mainTab === "students" && (
        <section className="teacher-classes__panel" aria-label="Linked students">
          {students.length === 0 ? (
            <div className="teacher-classes__empty">
              <h2>No students have accepted this class invitation yet.</h2>
              <p>Invite students by email to get started.</p>
              {!archived && (
                <button
                  type="button"
                  className="teacher-classes__btn teacher-classes__btn--primary"
                  onClick={() => {
                    setShowAddPanel(true);
                    setMainTab("invitations");
                  }}
                >
                  Add students
                </button>
              )}
            </div>
          ) : (
            <div className="teacher-classes__list">
              {students.map((row) => (
                <div
                  key={row.membershipPublicId}
                  className="teacher-classes__row"
                  aria-label={`Linked student ${row.student.displayName}`}
                >
                  <div className="teacher-classes__row-main">
                    <strong>{row.student.displayName}</strong>
                    <span className="teacher-classes__meta">
                      Joined {formatDate(row.joinedAt) || "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="teacher-classes__badge teacher-classes__badge--linked">
                      Linked
                    </span>
                    {!archived && (
                      <button
                        type="button"
                        className="teacher-classes__btn teacher-classes__btn--danger"
                        onClick={() => setRemoveTarget(row)}
                      >
                        Remove from class
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {mainTab === "invitations" && (
        <section aria-label="Invitations">
          {showAddPanel && !archived && (
            <div className="teacher-classes__panel" style={{ marginBottom: 16 }}>
              <h2 style={{ marginTop: 0 }}>Add students</h2>
              <div className="teacher-classes__tabs" role="tablist" aria-label="Add students method">
                {(
                  [
                    ["paste", "Paste email list"],
                    ["single", "Add one student"],
                    ["csv", "Upload CSV"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    className="teacher-classes__tab"
                    aria-selected={addMode === id}
                    onClick={() => {
                      setAddMode(id);
                      setPreview(null);
                      setAddError(null);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {addMode === "paste" && (
                <div className="teacher-classes__form">
                  <div className="teacher-classes__field">
                    <label htmlFor="paste-emails">Email addresses</label>
                    <textarea
                      id="paste-emails"
                      value={pasteInput}
                      onChange={(e) => setPasteInput(e.target.value)}
                      placeholder={"student1@school.org\nstudent2@school.org"}
                    />
                    <p className="teacher-classes__help">
                      Paste email addresses separated by new lines, commas or semicolons.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="teacher-classes__btn teacher-classes__btn--secondary"
                    disabled={previewing || !pasteInput.trim()}
                    onClick={runPreviewFromPaste}
                  >
                    {previewing ? "Reviewing…" : "Review invitations"}
                  </button>
                </div>
              )}

              {addMode === "single" && (
                <div className="teacher-classes__form">
                  <div className="teacher-classes__field">
                    <label htmlFor="single-email">Student email address</label>
                    <input
                      id="single-email"
                      type="email"
                      value={singleEmail}
                      onChange={(e) => setSingleEmail(e.target.value)}
                      placeholder="student@school.org"
                    />
                  </div>
                  <button
                    type="button"
                    className="teacher-classes__btn teacher-classes__btn--secondary"
                    disabled={previewing || !singleEmail.trim()}
                    onClick={runPreviewFromSingle}
                  >
                    {previewing ? "Reviewing…" : "Review invitation"}
                  </button>
                </div>
              )}

              {addMode === "csv" && (
                <div className="teacher-classes__form">
                  <div className="teacher-classes__field">
                    <label htmlFor="csv-file">CSV file</label>
                    <input
                      id="csv-file"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => {
                        setCsvFile(e.target.files?.[0] || null);
                        setPreview(null);
                        setAddError(null);
                      }}
                    />
                    <p className="teacher-classes__help">
                      Upload a CSV containing an <code>email</code> column. Maximum 5 MB.
                    </p>
                    <p className="teacher-classes__help">
                      Example:
                      <br />
                      email
                      <br />
                      student1@school.org
                      <br />
                      student2@school.org
                    </p>
                  </div>
                  <button
                    type="button"
                    className="teacher-classes__btn teacher-classes__btn--secondary"
                    disabled={previewing || !csvFile}
                    onClick={runPreviewFromCsv}
                  >
                    {previewing ? "Reviewing…" : "Review CSV"}
                  </button>
                </div>
              )}

              {addError && (
                <p className="teacher-classes__error" role="alert">
                  {addError}
                </p>
              )}

              {preview && (
                <div className="teacher-classes__preview-lists" aria-live="polite">
                  <p>
                    <strong>
                      {(preview.summary.totalSubmitted ?? preview.summary.totalRows ?? 0)} addresses
                      found
                    </strong>
                  </p>
                  <p className="teacher-classes__meta">
                    {preview.summary.validCount} valid · {preview.summary.duplicateCount} duplicate ·{" "}
                    {preview.summary.invalidCount} invalid
                  </p>
                  {preview.validEmails.length > 0 && (
                    <div>
                      <strong>Valid emails</strong>
                      <ul>
                        {preview.validEmails.map((email) => (
                          <li key={email}>{email}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {preview.duplicateEntries.length > 0 && (
                    <div>
                      <strong>Duplicates</strong>
                      <ul>
                        {preview.duplicateEntries.map((email, idx) => (
                          <li key={`${email}-${idx}`}>{email}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {preview.invalidEntries.length > 0 && (
                    <div>
                      <strong>Invalid entries</strong>
                      <ul>
                        {preview.invalidEntries.map((entry, idx) => (
                          <li key={idx}>{invalidEntryText(entry)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    type="button"
                    className="teacher-classes__btn teacher-classes__btn--primary"
                    disabled={sending || preview.validEmails.length === 0}
                    onClick={sendValidInvitations}
                  >
                    {sending
                      ? "Sending…"
                      : preview.validEmails.length === 1
                        ? "Send invitation"
                        : `Send ${preview.validEmails.length} invitations`}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="teacher-classes__panel">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <h2 style={{ margin: 0 }}>Invitation status</h2>
              {!archived && !showAddPanel && (
                <button
                  type="button"
                  className="teacher-classes__btn teacher-classes__btn--primary"
                  onClick={() => setShowAddPanel(true)}
                >
                  Add students
                </button>
              )}
            </div>

            {invitations.length === 0 ? (
              <p className="teacher-classes__meta">No invitations yet.</p>
            ) : (
              <div className="teacher-classes__list">
                {invitations.map((inv) => (
                  <div
                    key={inv.publicId}
                    className="teacher-classes__row"
                    aria-label={`Invitation for ${inv.targetEmail}`}
                  >
                    <div className="teacher-classes__row-main">
                      <strong>{inv.targetEmail}</strong>
                      <span className="teacher-classes__meta">
                        Requested {formatDate(inv.requestedAt) || "—"}
                        {inv.expiresAt ? ` · Expires ${formatDate(inv.expiresAt)}` : ""}
                        {inv.status === "accepted" && inv.student?.displayName
                          ? ` · ${inv.student.displayName}`
                          : ""}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className={`teacher-classes__badge ${badgeClass(inv.status)}`}>
                        {invitationLabel(inv.status)}
                      </span>
                      {!archived && inv.status === "pending" && (
                        <button
                          type="button"
                          className="teacher-classes__btn teacher-classes__btn--ghost"
                          disabled={busyAction}
                          onClick={() => setCancelTarget(inv)}
                        >
                          Cancel request
                        </button>
                      )}
                      {!archived &&
                        ["declined", "cancelled", "expired"].includes(inv.status) && (
                          <button
                            type="button"
                            className="teacher-classes__btn teacher-classes__btn--secondary"
                            disabled={busyAction}
                            onClick={() => onResend(inv)}
                          >
                            Resend invitation
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {mainTab === "settings" && (
        <section className="teacher-classes__panel" aria-label="Class settings">
          <form className="teacher-classes__form" onSubmit={saveSettings}>
            <div className="teacher-classes__field">
              <label htmlFor="settings-name">Class name</label>
              <input
                id="settings-name"
                value={settingsForm.name}
                onChange={(e) => setSettingsForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={100}
                required
                disabled={archived}
              />
            </div>
            <div className="teacher-classes__field">
              <label htmlFor="settings-description">Description</label>
              <textarea
                id="settings-description"
                value={settingsForm.description}
                onChange={(e) => setSettingsForm((f) => ({ ...f, description: e.target.value }))}
                maxLength={500}
                disabled={archived}
              />
            </div>
            <div className="teacher-classes__field">
              <label htmlFor="settings-subject">Subject</label>
              <input
                id="settings-subject"
                value={settingsForm.subject}
                onChange={(e) => setSettingsForm((f) => ({ ...f, subject: e.target.value }))}
                disabled={archived}
              />
            </div>
            <div className="teacher-classes__field">
              <label htmlFor="settings-board">Exam board / course</label>
              <input
                id="settings-board"
                value={settingsForm.board}
                onChange={(e) => setSettingsForm((f) => ({ ...f, board: e.target.value }))}
                disabled={archived}
              />
            </div>
            <div className="teacher-classes__field">
              <label htmlFor="settings-tier">Tier</label>
              <input
                id="settings-tier"
                value={settingsForm.tier}
                onChange={(e) => setSettingsForm((f) => ({ ...f, tier: e.target.value }))}
                disabled={archived}
              />
            </div>
            <div className="teacher-classes__field">
              <label htmlFor="settings-year">Academic year</label>
              <input
                id="settings-year"
                value={settingsForm.academicYear}
                onChange={(e) => setSettingsForm((f) => ({ ...f, academicYear: e.target.value }))}
                disabled={archived}
              />
            </div>
            {settingsError && (
              <p className="teacher-classes__error" role="alert">
                {settingsError}
              </p>
            )}
            {!archived && (
              <button
                type="submit"
                className="teacher-classes__btn teacher-classes__btn--primary"
                disabled={settingsSaving}
              >
                {settingsSaving ? "Saving…" : "Save settings"}
              </button>
            )}
            {archived && (
              <p className="teacher-classes__meta">
                This class is archived and can no longer be edited or invite students.
              </p>
            )}
          </form>
        </section>
      )}

      {cancelTarget && (
        <div
          className="teacher-classes__modal-backdrop"
          role="presentation"
          onClick={() => !busyAction && setCancelTarget(null)}
        >
          <div
            className="teacher-classes__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-inv-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cancel-inv-title">Cancel this invitation?</h2>
            <p>The student will no longer be able to accept it.</p>
            <div className="teacher-classes__modal-actions">
              <button
                type="button"
                className="teacher-classes__btn teacher-classes__btn--ghost"
                disabled={busyAction}
                onClick={() => setCancelTarget(null)}
              >
                Keep invitation
              </button>
              <button
                type="button"
                className="teacher-classes__btn teacher-classes__btn--danger"
                disabled={busyAction}
                onClick={confirmCancel}
              >
                Cancel invitation
              </button>
            </div>
          </div>
        </div>
      )}

      {removeTarget && (
        <div
          className="teacher-classes__modal-backdrop"
          role="presentation"
          onClick={() => !busyAction && setRemoveTarget(null)}
        >
          <div
            className="teacher-classes__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="remove-title">Remove this student from {cls.name}?</h2>
            <p>
              They will lose access through this class. Their previous work will not be deleted.
            </p>
            <div className="teacher-classes__modal-actions">
              <button
                type="button"
                className="teacher-classes__btn teacher-classes__btn--ghost"
                disabled={busyAction}
                onClick={() => setRemoveTarget(null)}
              >
                Keep student
              </button>
              <button
                type="button"
                className="teacher-classes__btn teacher-classes__btn--danger"
                disabled={busyAction}
                onClick={confirmRemove}
              >
                Remove student
              </button>
            </div>
          </div>
        </div>
      )}

      {archiveOpen && (
        <div
          className="teacher-classes__modal-backdrop"
          role="presentation"
          onClick={() => !busyAction && setArchiveOpen(false)}
        >
          <div
            className="teacher-classes__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="archive-detail-title">Archive {cls.name}?</h2>
            <p>
              Students will no longer receive invitations or gain Practice access through this class.
              Existing records and previous work will be preserved.
            </p>
            <div className="teacher-classes__modal-actions">
              <button
                type="button"
                className="teacher-classes__btn teacher-classes__btn--ghost"
                disabled={busyAction}
                onClick={() => setArchiveOpen(false)}
              >
                Keep class active
              </button>
              <button
                type="button"
                className="teacher-classes__btn teacher-classes__btn--danger"
                disabled={busyAction}
                onClick={confirmArchive}
              >
                Archive class
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
