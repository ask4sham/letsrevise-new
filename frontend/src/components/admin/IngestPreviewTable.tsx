import React from "react";
import type { IngestReport } from "../../api/adminIngest";

interface IngestPreviewTableProps {
  report: IngestReport | null;
  items: Record<string, unknown>[];
  type: string;
}

function actionBadge(action: string): { label: string; className: string } {
  switch (action) {
    case "insert":
    case "would_insert":
      return { label: "Insert", className: "bg-green-100 text-green-800" };
    case "skip_duplicate":
    case "skippedDuplicate":
      return { label: "Skip (dup)", className: "bg-amber-100 text-amber-800" };
    case "invalid":
    case "error":
      return { label: "Invalid", className: "bg-red-100 text-red-800" };
    case "update":
      return { label: "Update", className: "bg-blue-100 text-blue-800" };
    default:
      return { label: action, className: "bg-gray-100 text-gray-800" };
  }
}

export function IngestPreviewTable({ report, items, type }: IngestPreviewTableProps) {
  if (!report || items.length === 0) return null;

  const errorByIndex = new Map(report.errors.map((e) => [e.index, e]));
  const previewByIndex = new Map(
    report.preview.map((p) => [p.index ?? report.preview.indexOf(p), p])
  );

  const keyFields = (idx: number): string => {
    const item = items[idx] || {};
    switch (type) {
      case "flashcards":
        return [item.topicKey, (item.question ?? item.front ?? "").toString().slice(0, 40)].filter(Boolean).join(" · ");
      case "exam-questions":
        return [item.topicKey, (item.question ?? "").toString().slice(0, 40)].filter(Boolean).join(" · ");
      case "past-papers":
        return [item.examBoard, item.level, item.year, item.paperCode].filter(Boolean).join(" · ");
      case "past-paper-questions":
        return [item.topicKey, (item.question ?? "").toString().slice(0, 40)].filter(Boolean).join(" · ");
      default:
        return JSON.stringify(item).slice(0, 60);
    }
  };

  return (
    <div className="overflow-x-auto border rounded mt-2">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">#</th>
            <th className="px-3 py-2 text-left font-medium">Key fields</th>
            <th className="px-3 py-2 text-left font-medium">Action</th>
            <th className="px-3 py-2 text-left font-medium">Error</th>
          </tr>
        </thead>
        <tbody>
          {items.map((_, idx) => {
            const err = errorByIndex.get(idx);
            const prev = previewByIndex.get(idx);
            const action = prev?.action ?? (err ? "invalid" : "would_insert");
            const badge = actionBadge(action);
            return (
              <tr key={idx} className="border-t border-gray-100">
                <td className="px-3 py-1.5">{idx + 1}</td>
                <td className="px-3 py-1.5 max-w-md truncate" title={keyFields(idx)}>
                  {keyFields(idx) || "—"}
                </td>
                <td className="px-3 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${badge.className}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-red-600 text-xs">
                  {err?.message ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
