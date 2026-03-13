import React, { useRef } from "react";

interface IngestCsvUploaderProps {
  onCsvText: (text: string) => void;
  disabled?: boolean;
}

export function IngestCsvUploader({ onCsvText, disabled }: IngestCsvUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please select a CSV file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      onCsvText(text);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleFile}
        disabled={disabled}
        className="text-sm file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm"
      />
      <span className="text-sm text-gray-500">CSV only</span>
    </div>
  );
}
