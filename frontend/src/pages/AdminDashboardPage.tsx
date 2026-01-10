import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

interface PlatformStats {
  users: {
    total: number;
    teachers: number;
    students: number;
    growth: Array<{ _id: string; count: number }>;
  };
  lessons: {
    total: number;
    totalViews: number;
    averageRating: number;
    totalPurchases: number;
    platformEarnings: number;
  };
  revenue: {
    total: number;
    today: number;
    monthly: number;
  };
  subscriptions: {
    [key: string]: {
      count: number;
      totalShamCoins: number;
    };
  };
  platform: {
    totalShamCoins: number;
    activeUsers: number;
  };
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: string;
  verificationStatus: string;
  shamCoins: number;
  subscription: string;
  createdAt: string;
  lastActive: string | null;
  stats: any;
}

interface Lesson {
  id: string;
  title: string;
  subject: string;
  level: string;
  status: string;
  shamCoinPrice: number;
  views: number;
  purchases: number;
  averageRating: number;
  createdAt: string;
  teacher: {
    id: string;
    name: string;
    email: string;
  } | null;
  revenue: {
    total: number;
    platform: number;
    teacher: number;
  };
}

interface Transaction {
  _id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userType: string;
  type: string;
  amount: number;
  date: string;
  description: string;
  status: string;
  reference: string;
  lessonId: string | null;
}

type Msg = { type: "success" | "error"; text: string };

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "users" | "lessons" | "transactions"
  >("dashboard");

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Msg | null>(null);

  const [userFilters, setUserFilters] = useState({
    page: 1,
    limit: 20,
    userType: "",
    search: "",
  });

  const [lessonFilters, setLessonFilters] = useState({
    page: 1,
    limit: 20,
    status: "",
    subject: "",
    search: "",
  });

  const [transactionFilters, setTransactionFilters] = useState({
    page: 1,
    limit: 50,
    type: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });

  useEffect(() => {
    // Check if user is admin
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.userType !== "admin") {
      navigate("/dashboard");
      return;
    }

    fetchDashboardStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "users") fetchUsers();
    if (activeTab === "lessons") fetchLessons();
    if (activeTab === "transactions") fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userFilters, lessonFilters, transactionFilters]);

  const fetchDashboardStats = async () => {
    try {
      // Uses /src/services/api.ts (baseURL + Authorization interceptor)
      const res = await api.get("/admin/stats");
      const data = res.data;

      if (data?.success) setStats(data.stats);
      else setMessage({ type: "error", text: data?.msg || "Failed to load admin stats" });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setMessage({ type: "error", text: "Failed to load admin stats" });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const params: any = {
        page: userFilters.page,
        limit: userFilters.limit,
      };
      if (userFilters.userType) params.userType = userFilters.userType;
      if (userFilters.search) params.search = userFilters.search;

      const res = await api.get("/admin/users", { params });
      const data = res.data;

      if (data?.success) setUsers(data.users);
      else setMessage({ type: "error", text: data?.msg || "Failed to load users" });
    } catch (error) {
      console.error("Error fetching users:", error);
      setMessage({ type: "error", text: "Failed to load users" });
    }
  };

  const fetchLessons = async () => {
    try {
      const params: any = {
        page: lessonFilters.page,
        limit: lessonFilters.limit,
      };
      if (lessonFilters.status) params.status = lessonFilters.status;
      if (lessonFilters.subject) params.subject = lessonFilters.subject;
      if (lessonFilters.search) params.search = lessonFilters.search;

      const res = await api.get("/admin/lessons", { params });
      const data = res.data;

      if (data?.success) setLessons(data.lessons);
      else setMessage({ type: "error", text: data?.msg || "Failed to load lessons" });
    } catch (error) {
      console.error("Error fetching lessons:", error);
      setMessage({ type: "error", text: "Failed to load lessons" });
    }
  };

  const fetchTransactions = async () => {
    try {
      const params: any = {
        page: transactionFilters.page,
        limit: transactionFilters.limit,
      };
      if (transactionFilters.type) params.type = transactionFilters.type;
      if (transactionFilters.status) params.status = transactionFilters.status;
      if (transactionFilters.dateFrom) params.dateFrom = transactionFilters.dateFrom;
      if (transactionFilters.dateTo) params.dateTo = transactionFilters.dateTo;

      const res = await api.get("/admin/transactions", { params });
      const data = res.data;

      if (data?.success) setTransactions(data.transactions);
      else
        setMessage({
          type: "error",
          text: data?.msg || "Failed to load transactions",
        });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setMessage({ type: "error", text: "Failed to load transactions" });
    }
  };

  const handleVerifyTeacher = async (userId: string, status: "verified" | "rejected") => {
    const reason = status === "rejected" ? window.prompt("Reason for rejection:") : "";

    try {
      const res = await api.put(`/admin/users/${userId}/verify`, { status, reason });
      const data = res.data;

      if (data?.success) {
        setMessage({ type: "success", text: data.msg });
        fetchUsers();
      } else {
        setMessage({ type: "error", text: data?.msg || "Failed to update verification status" });
      }
    } catch (error) {
      console.error("Error verifying teacher:", error);
      setMessage({ type: "error", text: "Failed to update verification status" });
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    if (!window.confirm(`Change user role to ${role}?`)) return;

    try {
      const res = await api.put(`/admin/users/${userId}/role`, { role });
      const data = res.data;

      if (data?.success) {
        setMessage({ type: "success", text: data.msg });
        fetchUsers();
      } else {
        setMessage({ type: "error", text: data?.msg || "Failed to update user role" });
      }
    } catch (error) {
      console.error("Error updating role:", error);
      setMessage({ type: "error", text: "Failed to update user role" });
    }
  };

  const handleUpdateLessonStatus = async (lessonId: string, status: string) => {
    const reason = status === "flagged" ? window.prompt("Reason for flagging:") : "";

    try {
      const res = await api.put(`/admin/lessons/${lessonId}/status`, { status, reason });
      const data = res.data;

      if (data?.success) {
        setMessage({ type: "success", text: data.msg });
        fetchLessons();
      } else {
        setMessage({ type: "error", text: data?.msg || "Failed to update lesson status" });
      }
    } catch (error) {
      console.error("Error updating lesson status:", error);
      setMessage({ type: "error", text: "Failed to update lesson status" });
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();
  const formatCurrency = (amount: number) => amount.toLocaleString("en-US") + " SC";

  const safeTabButtonStyle = (tab: string): React.CSSProperties => ({
    padding: "0.75rem 1.5rem",
    backgroundColor: activeTab === tab ? "#1976d2" : "transparent",
    color: activeTab === tab ? "white" : "#666",
    border: "none",
    borderBottom: activeTab === tab ? "2px solid #1976d2" : "none",
    cursor: "pointer",
    textTransform: "capitalize",
  });

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        Loading admin dashboard...
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem", fontWeight: "bold" }}>
          Admin Dashboard
        </h1>
        <p style={{ color: "#666" }}>Platform administration and management</p>
      </div>

      {/* Message Display */}
      {message && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: message.type === "success" ? "#d4edda" : "#f8d7da",
            color: message.type === "success" ? "#155724" : "#721c24",
            border: `1px solid ${message.type === "success" ? "#c3e6cb" : "#f5c6cb"}`,
            borderRadius: "4px",
            marginBottom: "1.5rem",
          }}
        >
          {message.text}
          <button
            onClick={() => setMessage(null)}
            style={{
              float: "right",
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
            aria-label="Close message"
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs (Buttons ONLY — no <Link> anywhere) */}
      <div style={{ display: "flex", borderBottom: "1px solid #ddd", marginBottom: "1.5rem" }}>
        <button onClick={() => setActiveTab("dashboard")} style={safeTabButtonStyle("dashboard")}>
          Dashboard
        </button>
        <button onClick={() => setActiveTab("users")} style={safeTabButtonStyle("users")}>
          Users
        </button>
        <button onClick={() => setActiveTab("lessons")} style={safeTabButtonStyle("lessons")}>
          Lessons
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          style={safeTabButtonStyle("transactions")}
        >
          Transactions
        </button>
      </div>

      {/* Dashboard Tab */}
      {activeTab === "dashboard" && stats && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "1.5rem",
              marginBottom: "2rem",
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "1.5rem",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#1976d2" }}>
                {stats.users.total}
              </div>
              <div style={{ color: "#666" }}>Total Users</div>
              <div style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>
                Teachers: {stats.users.teachers} | Students: {stats.users.students}
              </div>
            </div>

            <div
              style={{
                backgroundColor: "white",
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "1.5rem",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#198754" }}>
                {stats.lessons.total}
              </div>
              <div style={{ color: "#666" }}>Total Lessons</div>
              <div style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>
                Purchases: {stats.lessons.totalPurchases} | Rating:{" "}
                {stats.lessons.averageRating.toFixed(1)}★
              </div>
            </div>

            <div
              style={{
                backgroundColor: "white",
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "1.5rem",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#dc3545" }}>
                {formatCurrency(stats.revenue.total)}
              </div>
              <div style={{ color: "#666" }}>Total Revenue</div>
              <div style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>
                Today: {formatCurrency(stats.revenue.today)} | Month:{" "}
                {formatCurrency(stats.revenue.monthly)}
              </div>
            </div>

            <div
              style={{
                backgroundColor: "white",
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "1.5rem",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#ffc107" }}>
                {stats.platform.activeUsers}
              </div>
              <div style={{ color: "#666" }}>Active Users (7 days)</div>
              <div style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>
                Total SC: {formatCurrency(stats.platform.totalShamCoins)}
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "white",
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "1.5rem",
              marginBottom: "2rem",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Subscription Breakdown</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "1rem",
              }}
            >
              {Object.entries(stats.subscriptions).map(([plan, data]) => (
                <div key={plan} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{data.count}</div>
                  <div
                    style={{
                      padding: "0.25rem 0.75rem",
                      backgroundColor:
                        plan === "free"
                          ? "#e2e3e5"
                          : plan === "basic"
                          ? "#d1ecf1"
                          : plan === "premium"
                          ? "#d4edda"
                          : "#f8d7da",
                      color:
                        plan === "free"
                          ? "#383d41"
                          : plan === "basic"
                          ? "#0c5460"
                          : plan === "premium"
                          ? "#155724"
                          : "#721c24",
                      borderRadius: "20px",
                      fontSize: "0.875rem",
                      textTransform: "capitalize",
                    }}
                  >
                    {plan}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.25rem" }}>
                    {formatCurrency(data.totalShamCoins)} SC
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              backgroundColor: "white",
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "1.5rem",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Platform Earnings</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#198754" }}>
                  {formatCurrency(stats.lessons.platformEarnings)}
                </div>
                <div style={{ color: "#666" }}>From Lesson Sales</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#198754" }}>
                  {formatCurrency(stats.revenue.total)}
                </div>
                <div style={{ color: "#666" }}>Total Revenue</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div>
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              <select
                value={userFilters.userType}
                onChange={(e) => setUserFilters({ ...userFilters, userType: e.target.value, page: 1 })}
                style={{ padding: "0.5rem", border: "1px solid #ddd", borderRadius: "4px" }}
              >
                <option value="">All Users</option>
                <option value="teacher">Teachers</option>
                <option value="student">Students</option>
                <option value="admin">Admins</option>
              </select>

              <input
                type="text"
                placeholder="Search by name or email..."
                value={userFilters.search}
                onChange={(e) => setUserFilters({ ...userFilters, search: e.target.value, page: 1 })}
                style={{
                  flex: 1,
                  minWidth: "200px",
                  padding: "0.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
            </div>

            <div style={{ border: "1px solid #ddd", borderRadius: "8px", overflow: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr",
                  backgroundColor: "#f8f9fa",
                  padding: "1rem",
                  borderBottom: "1px solid #ddd",
                  fontWeight: "bold",
                }}
              >
                <div>Name</div>
                <div>Email</div>
                <div>Type</div>
                <div>Status</div>
                <div>ShamCoins</div>
                <div>Actions</div>
              </div>

              {users.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr",
                    padding: "1rem",
                    borderBottom: "1px solid #ddd",
                    alignItems: "center",
                  }}
                >
                  <div>
                    {u.firstName} {u.lastName}
                  </div>
                  <div>{u.email}</div>
                  <div>
                    <select
                      value={u.userType}
                      onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                      style={{ padding: "0.25rem", border: "1px solid #ddd", borderRadius: "4px" }}
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    {u.userType === "teacher" ? (
                      u.verificationStatus === "pending" ? (
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            onClick={() => handleVerifyTeacher(u.id, "verified")}
                            style={{
                              padding: "0.25rem 0.5rem",
                              backgroundColor: "#198754",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              fontSize: "0.875rem",
                              cursor: "pointer",
                            }}
                          >
                            Verify
                          </button>
                          <button
                            onClick={() => handleVerifyTeacher(u.id, "rejected")}
                            style={{
                              padding: "0.25rem 0.5rem",
                              backgroundColor: "#dc3545",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              fontSize: "0.875rem",
                              cursor: "pointer",
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span
                          style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "20px",
                            fontSize: "0.875rem",
                            backgroundColor:
                              u.verificationStatus === "verified"
                                ? "#d4edda"
                                : u.verificationStatus === "rejected"
                                ? "#f8d7da"
                                : "#fff3cd",
                            color:
                              u.verificationStatus === "verified"
                                ? "#155724"
                                : u.verificationStatus === "rejected"
                                ? "#721c24"
                                : "#856404",
                          }}
                        >
                          {u.verificationStatus}
                        </span>
                      )
                    ) : (
                      <span style={{ color: "#666" }}>N/A</span>
                    )}
                  </div>

                  <div>{formatCurrency(u.shamCoins)}</div>

                  <div>
                    <button
                      onClick={() => navigate(`/profile/${u.id}`)}
                      style={{
                        padding: "0.25rem 0.5rem",
                        backgroundColor: "#6c757d",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lessons Tab */}
      {activeTab === "lessons" && (
        <div>
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              <select
                value={lessonFilters.status}
                onChange={(e) => setLessonFilters({ ...lessonFilters, status: e.target.value, page: 1 })}
                style={{ padding: "0.5rem", border: "1px solid #ddd", borderRadius: "4px" }}
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>

              <input
                type="text"
                placeholder="Search by title..."
                value={lessonFilters.search}
                onChange={(e) => setLessonFilters({ ...lessonFilters, search: e.target.value, page: 1 })}
                style={{
                  flex: 1,
                  minWidth: "200px",
                  padding: "0.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
            </div>

            <div style={{ border: "1px solid #ddd", borderRadius: "8px", overflow: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                  backgroundColor: "#f8f9fa",
                  padding: "1rem",
                  borderBottom: "1px solid #ddd",
                  fontWeight: "bold",
                }}
              >
                <div>Title</div>
                <div>Teacher</div>
                <div>Subject</div>
                <div>Price</div>
                <div>Status</div>
                <div>Revenue</div>
                <div>Actions</div>
              </div>

              {lessons.map((l) => (
                <div
                  key={l.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                    padding: "1rem",
                    borderBottom: "1px solid #ddd",
                    alignItems: "center",
                  }}
                >
                  <div>{l.title}</div>
                  <div>{l.teacher?.name || "Unknown"}</div>
                  <div>{l.subject}</div>
                  <div>{formatCurrency(l.shamCoinPrice)}</div>
                  <div>
                    <select
                      value={l.status}
                      onChange={(e) => handleUpdateLessonStatus(l.id, e.target.value)}
                      style={{ padding: "0.25rem", border: "1px solid #ddd", borderRadius: "4px" }}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                      <option value="flagged">Flagged</option>
                    </select>
                  </div>
                  <div>{formatCurrency(l.revenue?.total ?? 0)}</div>
                  <div>
                    <button
                      onClick={() => navigate(`/admin/lesson/${l.id}`, { state: { lesson: l } })}
                      style={{
                        padding: "0.25rem 0.5rem",
                        backgroundColor: "#6c757d",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === "transactions" && (
        <div>
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              <select
                value={transactionFilters.type}
                onChange={(e) => setTransactionFilters({ ...transactionFilters, type: e.target.value, page: 1 })}
                style={{ padding: "0.5rem", border: "1px solid #ddd", borderRadius: "4px" }}
              >
                <option value="">All Types</option>
                <option value="purchase">Purchase</option>
                <option value="subscription">Subscription</option>
                <option value="payout_request">Payout</option>
                <option value="deposit">Deposit</option>
              </select>

              <select
                value={transactionFilters.status}
                onChange={(e) => setTransactionFilters({ ...transactionFilters, status: e.target.value, page: 1 })}
                style={{ padding: "0.5rem", border: "1px solid #ddd", borderRadius: "4px" }}
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>

              <input
                type="date"
                value={transactionFilters.dateFrom}
                onChange={(e) => setTransactionFilters({ ...transactionFilters, dateFrom: e.target.value, page: 1 })}
                style={{ padding: "0.5rem", border: "1px solid #ddd", borderRadius: "4px" }}
              />
              <input
                type="date"
                value={transactionFilters.dateTo}
                onChange={(e) => setTransactionFilters({ ...transactionFilters, dateTo: e.target.value, page: 1 })}
                style={{ padding: "0.5rem", border: "1px solid #ddd", borderRadius: "4px" }}
              />
            </div>

            <div style={{ border: "1px solid #ddd", borderRadius: "8px", overflow: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr",
                  backgroundColor: "#f8f9fa",
                  padding: "1rem",
                  borderBottom: "1px solid #ddd",
                  fontWeight: "bold",
                }}
              >
                <div>Date</div>
                <div>User</div>
                <div>Type</div>
                <div>Amount</div>
                <div>Status</div>
                <div>Description</div>
              </div>

              {transactions.map((t) => (
                <div
                  key={t._id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr",
                    padding: "1rem",
                    borderBottom: "1px solid #ddd",
                    alignItems: "center",
                  }}
                >
                  <div>{formatDate(t.date)}</div>
                  <div>
                    <div>{t.userName}</div>
                    <div style={{ fontSize: "0.875rem", color: "#666" }}>{t.userEmail}</div>
                  </div>
                  <div>{t.type}</div>
                  <div style={{ color: t.amount > 0 ? "#198754" : "#dc3545", fontWeight: "bold" }}>
                    {formatCurrency(Math.abs(t.amount))}
                  </div>
                  <div>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        borderRadius: "20px",
                        fontSize: "0.875rem",
                        backgroundColor:
                          t.status === "completed"
                            ? "#d4edda"
                            : t.status === "pending"
                            ? "#fff3cd"
                            : t.status === "failed"
                            ? "#f8d7da"
                            : "#e2e3e5",
                        color:
                          t.status === "completed"
                            ? "#155724"
                            : t.status === "pending"
                            ? "#856404"
                            : t.status === "failed"
                            ? "#721c24"
                            : "#383d41",
                      }}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.875rem" }}>{t.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
