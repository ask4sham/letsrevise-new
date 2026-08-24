import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

interface LoginActivityEntry {
  id: string;
  userId: string;
  emailSnapshot: string;
  firstNameSnapshot: string;
  lastNameSnapshot: string;
  userTypeSnapshot: string;
  loggedInAt: string;
}

const AdminLoginActivityPage: React.FC = () => {
  const [events, setEvents] = useState<LoginActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const res = await api.get("/admin/login-activity", { params: { limit: "100" } });
        const data = res?.data ?? {};
        setEvents(data.events || []);
        setError("");
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { msg?: string } } };
        setError(ax?.response?.data?.msg || "Failed to load login activity");
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const formatDate = (s: string) => {
    if (!s) return "—";
    const d = new Date(s);
    return d.toLocaleString();
  };

  const displayName = (e: LoginActivityEntry) =>
    `${e.firstNameSnapshot}${e.lastNameSnapshot ? ` ${e.lastNameSnapshot}` : ""}`.trim() || "—";

  return (
    <div style={{ padding: "1rem", maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Recent login activity</h1>
        <Link to="/admin" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>
          ← Back to Admin
        </Link>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      {loading && <p style={{ color: "#6b7280" }}>Loading...</p>}

      {!loading && events.length === 0 && !error && (
        <p style={{ color: "#6b7280" }}>No login activity recorded yet.</p>
      )}

      {!loading && events.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>Date &amp; Time</th>
                <th style={{ padding: "10px 12px" }}>Name</th>
                <th style={{ padding: "10px 12px" }}>Email</th>
                <th style={{ padding: "10px 12px" }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "10px 12px", color: "#6b7280" }}>{formatDate(e.loggedInAt)}</td>
                  <td style={{ padding: "10px 12px" }}>{displayName(e)}</td>
                  <td style={{ padding: "10px 12px" }}>{e.emailSnapshot}</td>
                  <td style={{ padding: "10px 12px" }}>{e.userTypeSnapshot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminLoginActivityPage;
