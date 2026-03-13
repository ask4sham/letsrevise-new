/**
 * PR-BETA-OPS-1: Teacher/admin page to link students to self via POST /api/admin/student-teacher-links.
 */
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { createStudentTeacherLink } from "../api/studentTeacherLinks";
import { getUserDisplayName } from "../utils/userDisplayName";

function isTeacherOrAdmin(user: any) {
  const t = user?.userType;
  return t === "teacher" || t === "admin";
}

export default function TeacherLinkStudentsPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser({ watchLocation: true });

  const displayName = useMemo(() => getUserDisplayName(user), [user]);
  const isAllowed = isTeacherOrAdmin(user);

  const [studentId, setStudentId] = useState("");
  const [status, setStatus] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "success"; message: string }
    | { state: "error"; message: string }
  >({ state: "idle" });

  async function onLink() {
    const trimmed = studentId.trim();
    if (!trimmed) {
      setStatus({ state: "error", message: "Please enter a student ID." });
      return;
    }
    if (!user?._id) {
      setStatus({
        state: "error",
        message: "You must be logged in to link students.",
      });
      return;
    }

    setStatus({ state: "loading" });

    try {
      await createStudentTeacherLink({ studentId: trimmed, teacherId: user._id });

      setStatus({
        state: "success",
        message: "Linked ✓ The student can now practise with you.",
      });
      setStudentId("");
    } catch (err: any) {
      const statusCode = err?.response?.status;
      const apiMsg =
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        err?.message ||
        "Something went wrong.";

      let friendly = apiMsg;

      if (statusCode === 400) friendly = apiMsg || "Invalid request.";
      if (statusCode === 401) friendly = "Please log in again.";
      if (statusCode === 403) friendly = "You don't have permission to link this student.";
      if (statusCode === 404) friendly = "Student not found (check the student ID).";

      setStatus({ state: "error", message: friendly });
    }
  }

  if (!isAllowed) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Link students</h2>
        <p>You must be a teacher or admin to access this page.</p>
        <button onClick={() => navigate("/")} style={{ marginTop: 12 }}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <button onClick={() => navigate("/teacher-dashboard")} style={{ marginBottom: 16 }}>
        ← Back to teacher dashboard
      </button>

      <h1 style={{ marginBottom: 6 }}>Link students (beta)</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Signed in as {displayName || "teacher"}.
      </p>

      <div
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.1)",
          borderRadius: 12,
        }}
      >
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
          Student ID
        </label>
        <input
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="Paste student _id here"
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.2)",
          }}
        />

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button
            onClick={onLink}
            disabled={status.state === "loading"}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              cursor: status.state === "loading" ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {status.state === "loading" ? "Linking..." : "Link student"}
          </button>

          <button
            onClick={() => setStatus({ state: "idle" })}
            style={{ padding: "10px 14px", borderRadius: 10 }}
          >
            Clear
          </button>
        </div>

        <div style={{ marginTop: 12, minHeight: 22 }}>
          {status.state === "success" && (
            <div style={{ color: "green", fontWeight: 600 }}>{status.message}</div>
          )}
          {status.state === "error" && (
            <div style={{ color: "crimson", fontWeight: 600 }}>{status.message}</div>
          )}
        </div>

        <div style={{ marginTop: 16, opacity: 0.8, fontSize: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Where do I find the student ID?</div>
          <ul style={{ marginTop: 6 }}>
            <li>Open the student's profile page (if available) and copy their <code>_id</code>.</li>
            <li>Or ask the student to send their ID from their profile/account page.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
