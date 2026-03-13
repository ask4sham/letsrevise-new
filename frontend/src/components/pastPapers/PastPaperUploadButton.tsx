import React, { useRef, useState } from "react";
import { ConfirmUploadRightsModal } from "./ConfirmUploadRightsModal";
import { uploadPdfWithConfirmation } from "../../api/media";

type Props = {
  token: string;
  onUploaded: (uploaded: { mediaId: string; url: string; originalName: string }) => void;
};

export function PastPaperUploadButton({ token, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (!file) return;
          setPendingFile(file);
          setConfirmOpen(true);
        }}
      />

      <button
        type="button"
        className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? "Uploading…" : "Upload paper (PDF)"}
      </button>

      <ConfirmUploadRightsModal
        isOpen={confirmOpen}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingFile(null);
        }}
        onConfirm={async () => {
          if (!pendingFile) return;
          setConfirmOpen(false);
          setLoading(true);
          try {
            const uploaded = await uploadPdfWithConfirmation(pendingFile, token);
            onUploaded({
              mediaId: uploaded.mediaId,
              url: uploaded.url,
              originalName: uploaded.originalName,
            });
          } finally {
            setLoading(false);
            setPendingFile(null);
          }
        }}
      />
    </>
  );
}
