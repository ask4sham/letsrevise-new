// frontend/src/pages/AssessmentPapersList.tsx
// PR-AUTH-UI-2: use useCurrentUser for token and user (no direct localStorage auth reads).
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  FileText,
  ArrowRight,
  Search,
  Filter,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import SubscriptionRequired from "../components/SubscriptionRequired";
import { useCurrentUser } from "../hooks/useCurrentUser";

interface AssessmentPaper {
  _id: string;
  title: string;
  subject?: string;
  timeSeconds: number;
  kind: "mock_exam" | "past_paper" | "practice_set";
  questionCount: number;
}

function getTypeStyle(type: string): { bg: string; fg: string } {
  const t = (type || "").toLowerCase();
  if (t.includes("practice_set") || t.includes("quiz")) return { bg: "#ede9fe", fg: "#5b21b6" };
  if (t.includes("mock_exam") || t.includes("exam")) return { bg: "#dbeafe", fg: "#1d4ed8" };
  return { bg: "#dcfce7", fg: "#166534" }; // past_paper / Practice
}

function getTypeLabel(kind: string): string {
  switch (kind) {
    case "mock_exam": return "Exam";
    case "past_paper": return "Practice";
    case "practice_set": return "Quiz";
    default: return kind;
  }
}

const AssessmentPapersList: React.FC = () => {
  const [papers, setPapers] = useState<AssessmentPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMode, setSelectedMode] = useState<string>("practice_set");
  const [userType, setUserType] = useState<string>("");
  const { user, token } = useCurrentUser({ watchLocation: true });

  useEffect(() => {
    setUserType(user?.userType || "");

    const fetchPapers = async () => {
      try {
        setLoading(true);
        const url = `http://localhost:5000/api/assessment-papers?kind=${encodeURIComponent(selectedMode)}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token ?? ""}`,
          },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          if (response.status === 403 && (data.message || data.msg) === "Subscription required") {
            setSubscriptionBlocked(true);
          } else {
            throw new Error(`Failed to fetch: ${response.status}`);
          }
        } else {
          const data = await response.json();
          setPapers(data.papers || []);
          setError(null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load assessment papers");
        console.error("Error fetching papers:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPapers();
  }, [selectedMode, token, user?.userType]);

  const isTeacher = userType === "teacher";

  const filteredPapers = papers.filter((paper) => {
    const matchesSearch = paper.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesMode = paper.kind === selectedMode;
    return matchesSearch && matchesMode;
  });

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="h-8 bg-gray-300 rounded w-1/4 mb-2 animate-pulse" />
          <div className="h-5 bg-gray-200 rounded w-2/5 mb-8 animate-pulse" />
          <div
            className="grid gap-4"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "16px",
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-gray-200 bg-white p-4"
                style={{ minHeight: "200px" }}
              >
                <div className="mb-3 h-6 w-20 rounded-full bg-gray-200" />
                <div className="mb-2 h-5 w-3/4 rounded bg-gray-200" />
                <div className="mb-4 h-4 w-1/2 rounded bg-gray-100" />
                <div className="h-10 w-full rounded-lg bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (subscriptionBlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto">
          <SubscriptionRequired />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Failed to Load Papers
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Assessment Papers
          </h1>
          <p className="text-gray-600">
            Browse and attempt practice papers, exams, and quizzes
            {isTeacher && " (Preview mode - Teachers cannot start attempts)"}
          </p>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Search Papers
                </div>
              </label>
              <input
                type="text"
                placeholder="Search by title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filter by Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filter by Type
                </div>
              </label>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="mock_exam">Exam Papers</option>
                <option value="past_paper">Practice Papers</option>
                <option value="practice_set">Quizzes</option>
              </select>
            </div>
          </div>
        </div>

        {/* Papers Grid — cards with type badge + subject + meta chips */}
        {filteredPapers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              No assessment papers yet
            </h3>
            <p className="text-gray-500 mb-6">
              Create a quiz paper to assign or practice.
            </p>
            {isTeacher && (
              <Link
                to="/assessments/papers/builder"
                className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
              >
                Create paper
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            {!isTeacher && (searchTerm || selectedMode !== "") && (
              <p className="text-sm text-gray-500">Try adjusting your search or filter</p>
            )}
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "16px",
            }}
          >
            {filteredPapers.map((paper) => {
              const typeStyle = getTypeStyle(paper.kind);
              return (
                <div
                  key={paper._id}
                  className="bg-white rounded-xl border border-gray-200 p-4 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Top row: type badge + meta chips */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: typeStyle.bg, color: typeStyle.fg }}
                    >
                      {getTypeLabel(paper.kind)}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-600 bg-gray-100"
                    >
                      {paper.questionCount} questions
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-600 bg-gray-100"
                    >
                      <Clock className="w-3 h-3" />
                      {formatDuration(paper.timeSeconds)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
                    {paper.title}
                  </h3>

                  {/* Subject chip */}
                  <div className="mb-4">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs text-gray-500 bg-gray-100"
                    >
                      {paper.subject?.trim() || "—"}
                    </span>
                  </div>

                  {/* CTA */}
                  {isTeacher ? (
                    <Link
                      to={`/assessments/papers/${paper._id}/edit`}
                      className="block w-full"
                    >
                      <button
                        type="button"
                        title="Add or remove questions from this paper"
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
                      >
                        Manage questions
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </Link>
                  ) : (
                    <Link
                      to={`/assessments/papers/${paper._id}/start`}
                      className="block w-full"
                    >
                      <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-semibold">
                        Start Attempt
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Papers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {papers.length}
                </p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Filtered</p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredPapers.length}
                </p>
              </div>
              <Filter className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Average Questions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {papers.length > 0
                    ? Math.round(
                        papers.reduce((acc, p) => acc + p.questionCount, 0) /
                          papers.length
                      )
                    : 0}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentPapersList;