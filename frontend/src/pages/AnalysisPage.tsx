// pages/AnalysisPage.tsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import EarningsChart from "../components/charts/EarningsChart";

const defaultStats = {
  totalLessons: 0,
  publishedLessons: 0,
  draftLessons: 0,
  totalEarnings: 0,
  totalPurchases: 0,
  averageRating: 0,
  monthlyEarnings: [] as any[],
};

const AnalysisPage: React.FC = () => {
  const [stats, setStats] = useState<any>(defaultStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalysisData();
  }, []);

  const fetchAnalysisData = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        "http://localhost:5000/api/lessons/teacher/stats",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Safely merge API data into defaults
      const data = response?.data || {};
      setStats({
        ...defaultStats,
        ...data,
        monthlyEarnings: Array.isArray(data.monthlyEarnings)
          ? data.monthlyEarnings
          : [],
      });
    } catch (err) {
      console.error("Error fetching analysis data:", err);
      // On error, keep safe defaults
      setStats(defaultStats);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Loading Analytics...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ color: "#333", marginBottom: "1rem" }}>
        📊 Lesson Analytics Dashboard
      </h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        Track your lesson performance, earnings, and student engagement.
      </p>

      {/* Revenue Stats Cards */}
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
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            padding: "1.5rem",
            borderRadius: "12px",
            boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
          }}
        >
          <h3
            style={{
              margin: "0 0 0.5rem 0",
              fontSize: "0.9rem",
              opacity: 0.9,
            }}
          >
            TOTAL EARNINGS
          </h3>
          <div style={{ fontSize: "2rem", fontWeight: "bold" }}>
            £{stats.totalEarnings || 0}
          </div>
          <div style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
            {stats.totalPurchases || 0} purchases
          </div>
        </div>

        <div
          style={{
            background: "linear-gradient(135deg, #48bb78 0%, #38a169 100%)",
            color: "white",
            padding: "1.5rem",
            borderRadius: "12px",
            boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
          }}
        >
          <h3
            style={{
              margin: "0 0 0.5rem 0",
              fontSize: "0.9rem",
              opacity: 0.9,
            }}
          >
            LESSONS
          </h3>
          <div style={{ fontSize: "2rem", fontWeight: "bold" }}>
            {stats.totalLessons || 0}
          </div>
          <div style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
            {stats.publishedLessons || 0} published •{" "}
            {stats.draftLessons || 0} draft
          </div>
        </div>

        <div
          style={{
            background: "linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)",
            color: "white",
            padding: "1.5rem",
            borderRadius: "12px",
            boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
          }}
        >
          <h3
            style={{
              margin: "0 0 0.5rem 0",
              fontSize: "0.9rem",
              opacity: 0.9,
            }}
          >
            AVERAGE RATING
          </h3>
          <div style={{ fontSize: "2rem", fontWeight: "bold" }}>
            {stats.averageRating
              ? stats.averageRating.toFixed(1)
              : "0.0"}
            ★
          </div>
          <div style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
            Based on all lessons
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div
        style={{
          background: "white",
          padding: "2rem",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ color: "#333", marginBottom: "1.5rem" }}>
          Monthly Earnings Trend
        </h2>
        {stats.monthlyEarnings && stats.monthlyEarnings.length > 0 ? (
          <EarningsChart monthlyEarnings={stats.monthlyEarnings} />
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "3rem",
              color: "#999",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📈</div>
            <p>
              No earnings data available yet. Create and publish lessons to see
              your earnings trend!
            </p>
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
        }}
      >
        <div
          style={{
            background: "white",
            padding: "1.5rem",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ color: "#333", marginBottom: "1rem" }}>
            Performance Metrics
          </h3>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0.75rem 0",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <span style={{ color: "#666" }}>Conversion Rate</span>
            <span style={{ fontWeight: "bold", color: "#333" }}>
              {stats.totalLessons > 0
                ? (
                    (stats.totalPurchases / stats.totalLessons) *
                    100
                  ).toFixed(1)
                : "0"}
              %
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0.75rem 0",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <span style={{ color: "#666" }}>
              Avg. Earnings per Lesson
            </span>
            <span style={{ fontWeight: "bold", color: "#333" }}>
              £
              {stats.totalLessons > 0
                ? (stats.totalEarnings / stats.totalLessons).toFixed(2)
                : "0.00"}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0.75rem 0",
            }}
          >
            <span style={{ color: "#666" }}>Student Satisfaction</span>
            <span style={{ fontWeight: "bold", color: "#333" }}>
              {stats.averageRating
                ? "⭐".repeat(Math.floor(stats.averageRating))
                : "No ratings"}
            </span>
          </div>
        </div>

        <div
          style={{
            background: "white",
            padding: "1.5rem",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ color: "#333", marginBottom: "1rem" }}>
            Quick Insights
          </h3>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              color: "#666",
            }}
          >
            <li
              style={{
                padding: "0.5rem 0",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{ marginRight: "0.5rem", color: "#48bb78" }}
              >
                ✓
              </span>
              Your top-earning month is{" "}
              {stats.monthlyEarnings &&
              stats.monthlyEarnings.length > 0
                ? stats.monthlyEarnings.reduce(
                    (max: any, item: any) =>
                      item.earnings > max.earnings ? item : max,
                    stats.monthlyEarnings[0]
                  ).month
                : "N/A"}
            </li>
            <li
              style={{
                padding: "0.5rem 0",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{ marginRight: "0.5rem", color: "#4299e1" }}
              >
                📚
              </span>
              {stats.publishedLessons || 0} of your{" "}
              {stats.totalLessons || 0} lessons are published
            </li>
            <li
              style={{
                padding: "0.5rem 0",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{ marginRight: "0.5rem", color: "#ed8936" }}
              >
                💰
              </span>
              You could earn £
              {(
                (stats.totalLessons - stats.publishedLessons) *
                50
              ).toFixed(2)}{" "}
              more by publishing draft lessons
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPage;
