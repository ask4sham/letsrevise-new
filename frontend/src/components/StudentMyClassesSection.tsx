/**
 * Compact Student Dashboard "My classes" summary.
 * Full lists + Leave live on /student/classes; Accept/Decline work here too.
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
const DASH_JOINED_LIMIT = 3;

function formatMeta(cls: { subject?: string | null; board?: string | null; tier?: string | null }) {
  return [cls.subject, cls.board, cls.tier].filter(Boolean).join(" · ");
}

function formatTeacherMeta(
  teacherName: string,
  cls: { subject?: string | null; board?: string | null; tier?: string | null }
) {
  const meta = formatMeta(cls);
  return meta ? `${teacherName} · ${meta}` : teacherName;
}

/** Compact header: "1 invitation · 4 joined" */
export function formatClassesSummaryCounts(pendingCount: number, joinedCount: number): string {
  const inviteLabel = pendingCount === 1 ? "1 invitation" : `${pendingCount} invitations`;
  const joinedLabel = joinedCount === 1 ? "1 joined" : `${joinedCount} joined`;
  return `${inviteLabel} · ${joinedLabel}`;
}

/**
 * Primary dashboard CTA to /student/classes.
 * Describes what the student will see next (not "Manage…").
 */
export function getStudentClassesNavLabel(pendingCount: number, joinedCount: number): string {
  if (pendingCount > 0) {
    return pendingCount === 1
      ? "View all 1 invitation"
      : `View all ${pendingCount} invitations`;
  }
  if (joinedCount > 0) {
    return `View all my classes (${joinedCount})`;
  }
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

  // API returns newest-first (joinedAt / requestedAt desc); do not re-sort client-side.
  const visibleInvites = invitations.slice(0, DASH_INVITE_LIMIT);
  const visibleJoined = memberships.slice(0, DASH_JOINED_LIMIT);
  const summaryCounts = formatClassesSummaryCounts(invitations.length, memberships.length);
  const classesNavLabel = getStudentClassesNavLabel(invitations.length, memberships.length);
  const classesNavHref =
    invitations.length > 0 ? "/student/classes?tab=invitations" : "/student/classes";
  const showInviteOverflowLink = invitations.length > DASH_INVITE_LIMIT;

  return (
    <section className="student-classes-dash" aria-labelledby="my-classes-heading">
      {toast && (
        <div className="student-classes__toast">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}

      <header className="student-classes-dash__header">
        <h2 id="my-classes-heading" className="student-classes-dash__title">
          My classes
        </h2>
        {!loading && !error ? (
          <p className="student-classes-dash__counts" aria-label="Class summary">
            {summaryCounts}
          </p>
        ) : null}
      </header>

      {loading && (
        <p className="student-classes-dash__hint" aria-live="polite">
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
          {invitations.length > 0 ? (
            <div className="student-classes-dash__block">
              <h3 className="student-classes-dash__block-title">Invitation</h3>
              <ul className="student-classes-dash__rows">
                {visibleInvites.map((inv) => {
                  const className = inv.class.name;
                  const teacherName = inv.teacher.displayName;
                  const line = formatTeacherMeta(teacherName, inv.class);
                  return (
                    <li key={inv.publicId}>
                      <article
                        className="student-classes-dash__row student-classes-dash__row--invite"
                        aria-label={`Invitation to join ${className}`}
                      >
                        <div className="student-classes-dash__row-main">
                          <strong className="student-classes-dash__row-name">{className}</strong>
                          <span className="student-classes-dash__row-meta">{line}</span>
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
                    </li>
                  );
                })}
              </ul>
              {showInviteOverflowLink ? (
                <p className="student-classes-dash__inline-nav">
                  <Link
                    to="/student/classes?tab=invitations"
                    className="student-classes-dash__nav-link student-classes-dash__nav-link--inline"
                  >
                    {invitations.length === 1
                      ? "View all 1 invitation"
                      : `View all ${invitations.length} invitations`}
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}

          {memberships.length > 0 ? (
            <div className="student-classes-dash__block">
              <h3 className="student-classes-dash__block-title">Recent classes</h3>
              <ul className="student-classes-dash__rows">
                {visibleJoined.map((m) => {
                  const meta = formatMeta(m.class);
                  return (
                    <li key={m.membershipPublicId}>
                      <article
                        className="student-classes-dash__row student-classes-dash__row--joined"
                        aria-label={`Joined class ${m.class.name}`}
                      >
                        <strong className="student-classes-dash__row-name">{m.class.name}</strong>
                        <span className="student-classes-dash__row-aside">
                          {m.teacher.displayName}
                          {meta ? (
                            <span className="student-classes-dash__row-meta"> · {meta}</span>
                          ) : null}
                        </span>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {invitations.length === 0 && memberships.length === 0 ? (
            <p className="student-classes-dash__hint">You have not joined a class yet.</p>
          ) : null}

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
