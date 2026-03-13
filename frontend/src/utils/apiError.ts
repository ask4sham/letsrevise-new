// frontend/src/utils/apiError.ts
export type ApiError = {
  status?: number;
  error?: string;
  reason?: string;
  lessonId?: string;
  published?: boolean;
};

export async function parseApiError(res: Response): Promise<ApiError> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  return {
    status: res.status,
    error: body?.error,
    reason: body?.reason,
    lessonId: body?.lessonId,
    published: body?.published,
  };
}
