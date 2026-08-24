/**
 * Student Classes page — invitations + joined memberships.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Toast from "../components/Toast";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  acceptClassInvitation,
  declineClassInvitation,
  getIncomingClassInvitations,
  getMyClassMemberships,
  getStudentInvitationErrorMessage,
  leaveClass,
  type StudentClassMembershipSummary,
  type StudentIncomingClassInvitation,
} from "../api/studentClasses";
import "./StudentClassPages.css";

type Tab = "invitations" | "joined";

type ConfirmState =
  | { kind: "accept"; invitation: StudentIncomingClassInvitation }
  | { kind: "decline"; invitation: StudentIncomingClassInvitation }
  | { kind: "leave"; membership: StudentClassMembershipSummary }
  | null;

function formatMeta(cls: {
  subject?: string | null;
  board?: string | null;
  tier?: string | null;
  academicYear?: string | null;
}) {
  return [cls.subject, cls.board, cls.tier, cls.academicYear].filter(Boolean).join(" · ");
}

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

function isStudent(user: { userType?: string } | null | undefined) {
  return (user?.userType || "").toLowerCase() === "student";
}

const StudentClassesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = tabParam === "joined" ? "joined" : "invitations";

  const [invitations, setInvitations] = useState<StudentIncomingClassInvitation[]>([]);
  const [memberships, setMemberships] = useState<StudentClassMembershipSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const allowed = useMemo(() => isStudent(user), [user]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [incoming, classes] = await Promise.all([
        getIncomingClassInvitations(),
        getMyClassMemberships(),
      ]);
      setInvitations(incoming);
      setMemberships(classes);
    } catch (err) {
      setError(getStudentInvitationErrorMessage(err, "We could not load your classes."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [incoming, classes] = await Promise.all([
          getIncomingClassInvitations(),
          getMyClassMemberships(),
        ]);
        if (!active) return;
        setInvitations(incoming);
        setMemberships(classes);
      } catch (err) {
        if (!active) return;
        setError(getStudentInvitationErrorMessage(err, "We could not load your classes."));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [allowed]);

  function setTab(next: Tab) {
    setSearchParams(next === "invitations" ? {} : { tab: next });
  }

  async function runConfirm() {
    if (!confirm) return;
    if (confirm.kind === "accept" || confirm.kind === "decline") {
      const inv = confirm.invitation;
      setBusyId(inv.publicId);
      try {
        if (confirm.kind === "accept") {
          const result = await acceptClassInvitation(inv.publicId);
          setInvitations((prev) => prev.filter((i) => i.publicId !== inv.publicId));
          setMemberships((prev) => {
            if (prev.some((m) => m.membershipPublicId === result.membership.publicId)) return prev;
            return [
              {
                membershipPublicId: result.membership.publicId,
                joinedAt: result.membership.joinedAt,
                class: result.class,
                teacher: result.teacher,
              },
              ...prev,
            ];
          });
          setToast({ message: `You joined ${result.class.name}.`, type: "success" });
          setTab("joined");
        } else {
          await declineClassInvitation(inv.publicId);
          setInvitations((prev) => prev.filter((i) => i.publicId !== inv.publicId));
          setToast({ message: "Invitation declined.", type: "success" });
        }
        setConfirm(null);
      } catch (err) {
        setToast({
          message: getStudentInvitationErrorMessage(err, "Could not update invitation."),
          type: "error",
        });
        setConfirm(null);
        await load();
      } finally {
        setBusyId(null);
      }
      return;
    }

    const membership = confirm.membership;
    setBusyId(membership.membershipPublicId);
    try {
      await leaveClass(membership.membershipPublicId);
      setMemberships((prev) =>
        prev.filter((m) => m.membershipPublicId !== membership.membershipPublicId)
      );
      setToast({ message: `You left ${membership.class.name}.`, type: "success" });
      setConfirm(null);
    } catch (err) {
      setToast({
        message: getStudentInvitationErrorMessage(err, "Could not leave this class."),
        type: "error",
      });
      setConfirm(null);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) {
    return (
      <div className="student-classes">
        <h1 className="student-classes__title">My classes</h1>
        <p>You must be signed in as a student to view this page.</p>
        <button
          type="button"
          className="student-classes__btn student-classes__btn--secondary"
          onClick={() => navigate("/")}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="student-classes">
      {toast && (
        <div className="student-classes__toast">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}

      <Link to="/student-dashboard" className="student-classes__back">
        ← Back to dashboard
      </Link>

      <header className="student-classes__header">
        <div>
          <h1 className="student-classes__title">My classes</h1>
          <p className="student-classes__subtitle">
            Manage your teacher invitations and the classes you have joined.
          </p>
        </div>
      </header>

      <div className="student-classes__summary" aria-label="Class summary">
        <div className="student-classes__summary-card student-classes__summary-card--invite">
          <span>Invitations</span>
          <strong>{loading ? "—" : invitations.length}</strong>
        </div>
        <div className="student-classes__summary-card student-classes__summary-card--joined">
          <span>Joined</span>
          <strong>{loading ? "—" : memberships.length}</strong>
        </div>
      </div>

      <div className="student-classes__tabs" role="tablist" aria-label="Class sections">
        <button
          type="button"
          role="tab"
          className="student-classes__tab"
          aria-selected={tab === "invitations"}
          onClick={() => setTab("invitations")}
        >
          Invitations
        </button>
        <button
          type="button"
          role="tab"
          className="student-classes__tab"
          aria-selected={tab === "joined"}
          onClick={() => setTab("joined")}
        >
          Joined classes
        </button>
      </div>

      {loading && (
        <div className="student-classes__panel" aria-live="polite">
          {tab === "invitations" ? "Loading your invitations…" : "Loading your classes…"}
        </div>
      )}

      {!loading && error && (
        <div className="student-classes__panel">
          <p className="student-classes__error" role="alert">
            {error}
          </p>
          <button type="button" className="student-classes__btn student-classes__btn--secondary" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && tab === "invitations" && (
        <section className="student-classes__panel" aria-label="Invitations">
          {invitations.length === 0 ? (
            <div className="student-classes__empty">
              <h2>You have no class invitations.</h2>
              <p>When a teacher invites you, the request will appear here.</p>
            </div>
          ) : (
            <div className="student-classes__list">
              {invitations.map((inv) => {
                const className = inv.class.name;
                const meta = formatMeta(inv.class);
                return (
                  <article
                    key={inv.publicId}
                    className="student-classes__card"
                    aria-label={`Invitation to join ${className}`}
                  >
                    <div className="student-classes__card-main">
                      <span className="student-classes__badge student-classes__badge--invite">
                        Invitation
                      </span>
                      <h3>Teacher and class request</h3>
                      <p className="student-classes__meta" style={{ margin: 0 }}>
                        {inv.teacher.displayName} has invited you to join:
                      </p>
                      <strong>{className}</strong>
                      {meta ? <span className="student-classes__meta">{meta}</span> : null}
                      {inv.requestedAt ? (
                        <span className="student-classes__meta">
                          Requested {formatDate(inv.requestedAt)}
                        </span>
                      ) : null}
                    </div>
                    <div className="student-classes__actions">
                      <button
                        type="button"
                        className="student-classes__btn student-classes__btn--primary"
                        disabled={busyId === inv.publicId}
                        aria-label={`Accept invitation to ${className}`}
                        onClick={() => setConfirm({ kind: "accept", invitation: inv })}
                      >
                        {busyId === inv.publicId ? "Working…" : "Accept"}
                      </button>
                      <button
                        type="button"
                        className="student-classes__btn student-classes__btn--secondary"
                        disabled={busyId === inv.publicId}
                        aria-label={`Decline invitation to ${className}`}
                        onClick={() => setConfirm({ kind: "decline", invitation: inv })}
                      >
                        Decline
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!loading && !error && tab === "joined" && (
        <section className="student-classes__panel" aria-label="Joined classes">
          {memberships.length === 0 ? (
            <div className="student-classes__empty">
              <h2>You have not joined a class yet.</h2>
              <p>When a teacher invites you, the request will appear under Invitations.</p>
            </div>
          ) : (
            <div className="student-classes__list">
              {memberships.map((m) => {
                const meta = formatMeta(m.class);
                return (
                  <article
                    key={m.membershipPublicId}
                    className="student-classes__card"
                    aria-label={`Joined class ${m.class.name}`}
                  >
                    <div className="student-classes__card-main">
                      <span className="student-classes__badge student-classes__badge--joined">
                        Joined
                      </span>
                      <strong>{m.class.name}</strong>
                      <span className="student-classes__meta">{m.teacher.displayName}</span>
                      {m.class.description ? (
                        <span className="student-classes__meta">{m.class.description}</span>
                      ) : null}
                      {meta ? <span className="student-classes__meta">{meta}</span> : null}
                      {m.joinedAt ? (
                        <span className="student-classes__meta">Joined {formatDate(m.joinedAt)}</span>
                      ) : null}
                    </div>
                    <div className="student-classes__actions">
                      <button
                        type="button"
                        className="student-classes__btn student-classes__btn--danger"
                        disabled={busyId === m.membershipPublicId}
                        aria-label={`Leave ${m.class.name}`}
                        onClick={() => setConfirm({ kind: "leave", membership: m })}
                      >
                        Leave class
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {confirm && (
        <div
          className="student-classes__modal-backdrop"
          role="presentation"
          onClick={() => !busyId && setConfirm(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busyId) setConfirm(null);
          }}
        >
          <div
            className="student-classes__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-class-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            {confirm.kind === "accept" && (
              <>
                <h2 id="student-class-confirm-title">Join {confirm.invitation.class.name}?</h2>
                <p>
                  Your teacher will be able to include you in class activities and linked Practice.
                </p>
                <div className="student-classes__modal-actions">
                  <button
                    type="button"
                    className="student-classes__btn student-classes__btn--secondary"
                    disabled={!!busyId}
                    onClick={() => setConfirm(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="student-classes__btn student-classes__btn--primary"
                    disabled={!!busyId}
                    onClick={runConfirm}
                  >
                    {busyId ? "Joining…" : "Join class"}
                  </button>
                </div>
              </>
            )}
            {confirm.kind === "decline" && (
              <>
                <h2 id="student-class-confirm-title">Decline this invitation?</h2>
                <p>
                  You will not join {confirm.invitation.class.name}. Your teacher may send another
                  invitation later.
                </p>
                <div className="student-classes__modal-actions">
                  <button
                    type="button"
                    className="student-classes__btn student-classes__btn--secondary"
                    disabled={!!busyId}
                    onClick={() => setConfirm(null)}
                  >
                    Keep invitation
                  </button>
                  <button
                    type="button"
                    className="student-classes__btn student-classes__btn--danger"
                    disabled={!!busyId}
                    onClick={runConfirm}
                  >
                    {busyId ? "Declining…" : "Decline"}
                  </button>
                </div>
              </>
            )}
            {confirm.kind === "leave" && (
              <>
                <h2 id="student-class-confirm-title">Leave {confirm.membership.class.name}?</h2>
                <p>
                  You will lose access provided through this class. Your previous answers and work
                  will not be deleted.
                </p>
                <div className="student-classes__modal-actions">
                  <button
                    type="button"
                    className="student-classes__btn student-classes__btn--secondary"
                    disabled={!!busyId}
                    onClick={() => setConfirm(null)}
                  >
                    Stay in class
                  </button>
                  <button
                    type="button"
                    className="student-classes__btn student-classes__btn--danger"
                    disabled={!!busyId}
                    onClick={runConfirm}
                  >
                    {busyId ? "Leaving…" : "Leave class"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentClassesPage;
