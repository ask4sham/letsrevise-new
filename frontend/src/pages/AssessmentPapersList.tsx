// frontend/src/pages/AssessmentPapersList.tsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  FileText,
  ArrowRight,
  Search,
  Filter,
  AlertCircle,
  Calendar,
  BarChart3,
} from "lucide-react";

interface AssessmentPaper {
  _id: string;
  title: string;
  timeSeconds: number;
  kind: "exam" | "practice" | "quiz";
  questionCount: number;
}

const AssessmentPapersList: React.FC = () => {
  const [papers, setPapers] = useState<AssessmentPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMode, setSelectedMode] = useState<string>("all");
  const [userType, setUserType] = useState<string>("");

  useEffect(() => {
    const fetchPapers = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          "http://localhost:5000/api/assessment-papers", // Changed to direct backend URL
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }

        const data = await response.json();
        setPapers(data.papers || []); // Changed to data.papers || []
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to load assessment papers");
        console.error("Error fetching papers:", err);
      } finally {
        setLoading(false);
      }
    };

    // Get user type from localStorage
    try {
      const userData = localStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        setUserType(user.userType || "");
      }
    } catch (err) {
      console.error("Error reading user data:", err);
    }

    fetchPapers();
  }, []);

  const isTeacher = userType === "teacher";

  const filteredPapers = papers.filter((paper) => {
    const matchesSearch = paper.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesMode =
      selectedMode === "all" || paper.kind === selectedMode;
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

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "exam":
        return "bg-red-100 text-red-800";
      case "practice":
        return "bg-blue-100 text-blue-800";
      case "quiz":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "exam":
        return <FileText className="w-4 h-4" />;
      case "practice":
        return <BarChart3 className="w-4 h-4" />;
      case "quiz":
        return <Calendar className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-8"></div>
            <div className="h-12 bg-gray-300 rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-300 rounded-lg"></div>
              ))}
            </div>
          </div>
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
                <option value="all">All Types</option>
                <option value="exam">Exams</option>
                <option value="practice">Practice Papers</option>
                <option value="quiz">Quizzes</option>
              </select>
            </div>
          </div>
        </div>

        {/* Papers Grid */}
        {filteredPapers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No papers found
            </h3>
            <p className="text-gray-500">
              {searchTerm || selectedMode !== "all"
                ? "Try adjusting your search or filter"
                : "No assessment papers are available yet"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPapers.map((paper, index) => (
              <div
                key={paper._id}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="p-6">
                  {/* Mode Badge */}
                  <div className="flex justify-between items-start mb-4">
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getModeColor(
                        paper.kind
                      )}`}
                    >
                      {getModeIcon(paper.kind)}
                      {paper.kind.charAt(0).toUpperCase() + paper.kind.slice(1)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {paper.questionCount} questions
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2">
                    {paper.title}
                  </h3>

                  {/* Duration */}
                  <div className="flex items-center gap-2 text-gray-600 mb-6">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">
                      {formatDuration(paper.timeSeconds)}
                    </span>
                  </div>

                  {/* Action Button - Disabled for teachers */}
                  {isTeacher ? (
                    <div className="w-full">
                      <button
                        disabled
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-400 text-white rounded-lg cursor-not-allowed"
                      >
                        <span className="font-semibold">Preview Only</span>
                        <FileText className="w-4 h-4" />
                      </button>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        Teachers cannot start attempts
                      </p>
                    </div>
                  ) : (
                    <Link
                      to={`/assessments/papers/${paper._id}/start`}
                      className="block w-full"
                    >
                      <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all transform hover:-translate-y-0.5">
                        <span className="font-semibold">Start Attempt</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
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