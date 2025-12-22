import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type LessonRow = {
  id: string;
  title: string;
  subject: string;
  level: string;
  stage: string | null;
  years: string | null;
  is_published: boolean;
  exam_board: { name: string }[] | null; // <- Supabase join comes back as array
};

export default function TestLessons() {
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchLessons = async () => {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('lessons')
        .select(
          `
          id,
          title,
          subject,
          level,
          stage,
          years,
          is_published,
          exam_board:exam_boards(name)
        `
        )
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Supabase error:', error);
        setError(`${error.message} (${error.code ?? 'no-code'})`);
        setLessons([]);
      } else {
        setLessons((data ?? []) as LessonRow[]);
      }

      setLoading(false);
    };

    fetchLessons();
  }, []);

  const normalized = lessons.map((l) => ({
    ...l,
    exam_board_name: l.exam_board?.[0]?.name ?? null,
  }));

  return (
    <div style={{ padding: 16 }}>
      <h2>Published Lessons (Test)</h2>

      {loading && <p>Loading…</p>}

      {error && (
        <div style={{ padding: 12, border: '1px solid #f00', marginTop: 12 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && normalized.length === 0 && <p>No published lessons found.</p>}

      {!loading && !error && normalized.length > 0 && (
        <pre style={{ marginTop: 12, background: '#111', color: '#0f0', padding: 12, overflow: 'auto' }}>
          {JSON.stringify(normalized, null, 2)}
        </pre>
      )}
    </div>
  );
}
