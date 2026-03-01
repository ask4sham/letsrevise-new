/**
 * Fetches /api/taxonomy/create-lesson-options for Subject → Spec → Main topic → Sub-topic dropdowns.
 * Shared by CreateLessonPage and TeacherDashboard "Generate with AI" modal.
 */
import { useEffect, useState } from "react";
import { fetchCreateLessonOptions, type CreateLessonOptionsResponse } from "../api/taxonomy";

export type CreateLessonTaxonomyOptionsResult = {
  options: CreateLessonOptionsResponse | null;
  loading: boolean;
  error: string | null;
};

export function useCreateLessonTaxonomyOptions(): CreateLessonTaxonomyOptionsResult {
  const [options, setOptions] = useState<CreateLessonOptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCreateLessonOptions()
      .then((data) => {
        if (!cancelled) setOptions(data);
      })
      .catch((err: any) => {
        if (cancelled) return;
        const status = err?.response?.status ?? err?.status;
        const message =
          status === 404
            ? "API route not found — check backend is running and /api/taxonomy/create-lesson-options is mounted."
            : err?.message || "Failed to load topic options. You can still enter Topic below.";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { options, loading, error };
}
