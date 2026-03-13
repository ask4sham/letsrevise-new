import React, { useState } from "react";

type Props = {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmUploadRightsModal({ isOpen, onCancel, onConfirm }: Props) {
  const [checked, setChecked] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
        <div className="text-lg font-semibold">Confirm usage rights</div>

        <div className="mt-3 text-sm leading-6">
          By uploading this file, you confirm that:
          <ul className="mt-2 list-disc pl-5">
            <li>You have permission to use and upload this material for educational purposes</li>
            <li>This file will only be used privately by you or your institution</li>
            <li>You understand that exam papers remain subject to exam-board copyright</li>
          </ul>
        </div>

        <label className="mt-4 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>
            <span className="font-medium">I confirm</span> I have the right to upload and use this material.
          </span>
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-xl border px-4 py-2 text-sm"
            onClick={() => {
              setChecked(false);
              onCancel();
            }}
          >
            Cancel
          </button>

          <button
            className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
            disabled={!checked}
            onClick={() => {
              setChecked(false);
              onConfirm();
            }}
          >
            Continue to upload
          </button>
        </div>
      </div>
    </div>
  );
}
