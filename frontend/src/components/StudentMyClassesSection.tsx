/**
 * Compact Student Dashboard "My classes" section.
 * Full Leave + full lists live on /student/classes; Accept/Decline work here too.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Toast from "./Toast";
import {
  acceptClassInvitation,
  declineClassInvitation,
  getIncomingClassInvitations,
  getMyClassMemberships,
  getStudentInvitationErrorMessage,
  type StudentClassMembershipSummary,
  type StudentIncomingClassInvitation,
} from "../api/studentClasses";
import "../pages/StudentClassPages.css";

const DASH_INVITE_LIMIT = 2;
const DASH_JOINED_LIMIT = 2;

function formatMeta(cls: { subject?: string | null; board?: string | null; tier?: string | null }) {
  return [cls.subject, cls.board, cls.tier].filter(Boolean).join(" · ");
}

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

/** Contextual CTA to /student/classes based on pending vs joined state. */
export function getStudentClassesNavLabel(pendingCount: number, joinedCount: number): string {
  if (pendingCount > 0) return "View all class invitations";
  if (joinedCount > 0) return "Manage my classes";
  return "View my classes";
}

type ConfirmState =
  | { kind: "accept"; invitation: StudentIncomingClassInvitation }
  | { kind: "decline"; invitation: StudentIncomingClassInvitation }
  | null;

const StudentMyClassesSection: React.FC = () => {
  const [invitations, setInvitations] = useState<StudentIncomingClassInvitation[]>([]);
  const [memberships, setMemberships] = useState<StudentClassMembershipSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

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
  }, []);

  async function onConfirm() {
    if (!confirm || busyId) return;
    const inv = confirm.invitation;
    setBusyId(inv.publicId);
    try {
      if (confirm.kind === "accept") {
        const result = await acceptClassInvitation(inv.publicId);
        setInvitations((prev) => prev.filter((i) => i.publicId !== inv.publicId));
        setMemberships((prev) => {
          const exists = prev.some(
            (m) => m.membershipPublicId === result.membership.publicId
          );
          if (exists) return prev;
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
  }

  const visibleInvites = invitations.slice(0, DASH_INVITE_LIMIT);
  const visibleJoined = memberships.slice(0, DASH_JOINED_LIMIT);
  const classesNavLabel = getStudentClassesNavLabel(invitations.length, memberships.length);
  const classesNavHref =
    invitations.length > 0 ? "/student/classes?tab=invitations" : "/student/classes";

  return (
    <section className="student-classes-dash" aria-labelledby="my-classes-heading">
      {toast && (
        <div className="student-classes__toast">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}

      <h2 id="my-classes-heading" className="student-classes-dash__title">
        My classes
      </h2>
      <p className="student-classes-dash__subtitle">
        Respond to teacher invitations and view the classes you have joined.
      </p>

      {loading && (
        <p className="student-classes__meta" aria-live="polite">
          Loading your classes…
        </p>
      )}

      {!loading && error && (
        <div className="student-classes__error" role="alert">
          <p style={{ margin: "0 0 10px" }}>{error}</p>
          <button type="button" className="student-classes__btn student-classes__btn--secondary" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="student-classes-dash__grid" aria-label="Class summary">
            <div className="student-classes-dash__chip student-classes-dash__chip--invite">
              <span>Invitations</span>
              <strong>{invitations.length}</strong>
            </div>
            <div className="student-classes-dash__chip student-classes-dash__chip--joined">
              <span>Joined</span>
              <strong>{memberships.length}</strong>
            </div>
          </div>

          <div className="student-classes__list" style={{ marginBottom: 14 }}>
            {visibleInvites.length === 0 ? (
              <p className="student-classes__meta" style={{ margin: 0 }}>
                No new class invitations.
              </p>
            ) : (
              visibleInvites.map((inv) => {
                const className = inv.class.name;
                const teacherName = inv.teacher.displayName;
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
                        {teacherName} has invited you to join:
                      </p>
                      <strong>{className}</strong>
                      {meta ? <span className="student-classes__meta">{meta}</span> : null}
                      {inv.requestedAt ? (
                        <span className="student-classes__meta">
                          Requested {formatDate(inv.requestedAt)}
                        </span>
                      ) : null}
                    </div>
                    <div className="student-classes__actions student-classes-dash__actions">
                      <button
                        type="button"
                        className="student-classes__btn student-classes__btn--primary"
                        disabled={busyId === inv.publicId}
                        aria-label={`Accept invitation to ${className}`}
                        onClick={() => setConfirm({ kind: "accept", invitation: inv })}
                      >
                        {busyId === inv.publicId ? "Working…" : "Accept invitation"}
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
              })
            )}
          </div>

          <h3 style={{ margin: "8px 0 10px", fontSize: "1.05rem" }}>Joined classes</h3>
          {visibleJoined.length === 0 ? (
            <div className="student-classes__empty" style={{ padding: "16px 8px" }}>
              <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#0f172a" }}>
                You have not joined a class yet.
              </p>
              <p style={{ margin: 0 }}>When a teacher invites you, the request will appear here.</p>
            </div>
          ) : (
            <div className="student-classes__list" style={{ marginBottom: 12 }}>
              {visibleJoined.map((m) => {
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
                      {meta ? <span className="student-classes__meta">{meta}</span> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <p className="student-classes-dash__nav">
            <Link to={classesNavHref} className="student-classes-dash__nav-link">
              {classesNavLabel}
            </Link>
          </p>
        </>
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
            aria-labelledby="dash-class-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            {confirm.kind === "accept" ? (
              <>
                <h2 id="dash-class-confirm-title">Join {confirm.invitation.class.name}?</h2>
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
                    onClick={onConfirm}
                  >
                    {busyId ? "Joining…" : "Join class"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="dash-class-confirm-title">Decline this invitation?</h2>
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
                    onClick={onConfirm}
                  >
                    {busyId ? "Declining…" : "Decline"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default StudentMyClassesSection;
