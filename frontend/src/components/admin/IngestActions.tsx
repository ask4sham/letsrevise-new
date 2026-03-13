import React from "react";
import type { IngestReport } from "../../api/adminIngest";

interface IngestActionsProps {
  canImport: boolean;
  confirmCopyrightChecked: boolean;
  requireConfirmCopyright: boolean;
  onConfirmCopyrightChange: (checked: boolean) => void;
  onImport: () => void;
  importing: boolean;
  result: IngestReport | null;
  onDownloadResult: () => void;
}

export function IngestActions({
  canImport,
  confirmCopyrightChecked,
  requireConfirmCopyright,
  onConfirmCopyrightChange,
  onImport,
  importing,
  result,
  onDownloadResult,
}: IngestActionsProps) {
  const allowed = canImport && (!requireConfirmCopyright || confirmCopyrightChecked);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-4">
        {requireConfirmCopyright && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={confirmCopyrightChecked}
              onChange={(e) => onConfirmCopyrightChange(e.target.checked)}
              className="rounded"
            />
            <span>I confirm I have rights to use this content (required for past papers / media)</span>
          </label>
        )}
        <button
          type="button"
          onClick={onImport}
          disabled={!allowed || importing}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {importing ? "Importing…" : "Import"}
        </button>
      </div>
      {result && !result.dryRun && (
        <div className="border rounded p-3 bg-gray-50 text-sm">
          <p className="font-medium mb-1">Import result</p>
          <p>
            Total: {result.total} · Valid: {result.valid} · Invalid: {result.invalid}
            {result.inserted != null && ` · Inserted: ${result.inserted}`}
            {" · "}Skipped (duplicates): {result.skippedDuplicates}
          </p>
          <button
            type="button"
            onClick={onDownloadResult}
            className="mt-2 text-indigo-600 hover:underline"
          >
            Download result JSON
          </button>
        </div>
      )}
    </div>
  );
}
