import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

interface AuditLogEntry {
  _id: string;
  action: string;
  actorId: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

const AdminAuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const params: Record<string, string> = { limit: "100" };
        if (actionFilter) params.action = actionFilter;
        const res = await api.get("/admin/audit-log", { params });
        const data = res?.data ?? {};
        setLogs(data.logs || []);
        setError("");
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { msg?: string } } };
        setError(ax?.response?.data?.msg || "Failed to load audit log");
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [actionFilter]);

  const formatDate = (s: string) => {
    if (!s) return "—";
    const d = new Date(s);
    return d.toLocaleString();
  };

  return (
    <div style={{ padding: "1rem", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Admin audit log</h1>
        <Link to="/admin" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>
          ← Back to Admin
        </Link>
      </div>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <label style={{ fontSize: 14 }}>Filter by action:</label>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
        >
          <option value="">All</option>
          <option value="role_change">role_change</option>
          <option value="staff_role_change">staff_role_change</option>
          <option value="teacher_verify">teacher_verify</option>
          <option value="lesson_status">lesson_status</option>
          <option value="lesson_delete">lesson_delete</option>
          <option value="user_delete">user_delete</option>
          <option value="subscription_grant">subscription_grant</option>
          <option value="subscription_expire">subscription_expire</option>
        </select>
      </div>

      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: "#fee2e2", color: "#991b1b", borderRadius: 8 }}>
          {error}
        </div>
      )}

      {loading && <p style={{ color: "#6b7280" }}>Loading...</p>}

      {!loading && logs.length === 0 && !error && (
        <p style={{ color: "#6b7280" }}>No audit log entries yet.</p>
      )}

      {!loading && logs.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>Action</th>
                <th style={{ padding: "10px 12px" }}>Actor</th>
                <th style={{ padding: "10px 12px" }}>Target</th>
                <th style={{ padding: "10px 12px" }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>{log.action}</td>
                  <td style={{ padding: "10px 12px" }}>{log.actorEmail || log.actorId || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {log.targetType && log.targetId
                      ? `${log.targetType}: ${typeof log.targetId === "object" ? JSON.stringify(log.targetId) : log.targetId}`
                      : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#6b7280" }}>{formatDate(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminAuditLogPage;
