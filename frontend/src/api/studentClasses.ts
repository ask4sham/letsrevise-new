/**
 * Teacher class-linking API — opaque publicIds only.
 * Never submit teacherId / studentId / Mongo IDs.
 */
import api from "../services/api";
import type {
  CreateClassPayload,
  CreateInvitationsResult,
  InvitationPreview,
  RemovedMembership,
  StudentClassDetail,
  StudentClassInvitation,
  StudentClassMember,
  StudentClassSummary,
  UpdateClassPayload,
} from "../types/studentClasses";

export type {
  CreateClassPayload,
  CreateInvitationsResult,
  InvitationPreview,
  RemovedMembership,
  StudentClassDetail,
  StudentClassInvitation,
  StudentClassMember,
  StudentClassSummary,
  UpdateClassPayload,
} from "../types/studentClasses";

export async function createClass(payload: CreateClassPayload): Promise<StudentClassDetail> {
  const { data } = await api.post<{ ok: true; class: StudentClassDetail }>(
    "/student-classes",
    payload
  );
  return data.class;
}

export async function getMyClasses(): Promise<StudentClassSummary[]> {
  const { data } = await api.get<{ ok: true; classes: StudentClassSummary[] }>(
    "/student-classes/mine"
  );
  return data.classes || [];
}

export async function getClass(classPublicId: string): Promise<StudentClassDetail> {
  const { data } = await api.get<{ ok: true; class: StudentClassDetail }>(
    `/student-classes/${encodeURIComponent(classPublicId)}`
  );
  return data.class;
}

export async function updateClass(
  classPublicId: string,
  payload: UpdateClassPayload
): Promise<StudentClassDetail> {
  const { data } = await api.patch<{ ok: true; class: StudentClassDetail }>(
    `/student-classes/${encodeURIComponent(classPublicId)}`,
    payload
  );
  return data.class;
}

export async function archiveClass(
  classPublicId: string
): Promise<{ publicId: string; name: string; status: "archived"; archivedAt?: string | null }> {
  const { data } = await api.post<{
    ok: true;
    class: { publicId: string; name: string; status: "archived"; archivedAt?: string | null };
  }>(`/student-classes/${encodeURIComponent(classPublicId)}/archive`);
  return data.class;
}

export async function previewEmailInput(
  classPublicId: string,
  input: string
): Promise<InvitationPreview> {
  const { data } = await api.post<InvitationPreview>(
    `/student-classes/${encodeURIComponent(classPublicId)}/invitations/preview`,
    { input }
  );
  return data;
}

export async function previewCsv(
  classPublicId: string,
  file: File
): Promise<InvitationPreview> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<InvitationPreview>(
    `/student-classes/${encodeURIComponent(classPublicId)}/invitations/csv/preview`,
    form
  );
  return data;
}

export async function createInvitations(
  classPublicId: string,
  emails: string[]
): Promise<CreateInvitationsResult> {
  const { data } = await api.post<CreateInvitationsResult>(
    `/student-classes/${encodeURIComponent(classPublicId)}/invitations`,
    { emails }
  );
  return data;
}

export async function getInvitations(
  classPublicId: string
): Promise<StudentClassInvitation[]> {
  const { data } = await api.get<{ ok: true; invitations: StudentClassInvitation[] }>(
    `/student-classes/${encodeURIComponent(classPublicId)}/invitations`
  );
  return data.invitations || [];
}

export async function cancelInvitation(
  classPublicId: string,
  invitationPublicId: string
): Promise<StudentClassInvitation> {
  const { data } = await api.post<{ ok: true; invitation: StudentClassInvitation }>(
    `/student-classes/${encodeURIComponent(classPublicId)}/invitations/${encodeURIComponent(
      invitationPublicId
    )}/cancel`
  );
  return data.invitation;
}

export async function resendInvitation(
  classPublicId: string,
  invitationPublicId: string
): Promise<StudentClassInvitation> {
  const { data } = await api.post<{ ok: true; invitation: StudentClassInvitation }>(
    `/student-classes/${encodeURIComponent(classPublicId)}/invitations/${encodeURIComponent(
      invitationPublicId
    )}/resend`
  );
  return data.invitation;
}

export async function getClassStudents(
  classPublicId: string
): Promise<StudentClassMember[]> {
  const { data } = await api.get<{ ok: true; students: StudentClassMember[] }>(
    `/student-classes/${encodeURIComponent(classPublicId)}/students`
  );
  return data.students || [];
}

export async function removeClassStudent(
  classPublicId: string,
  membershipPublicId: string
): Promise<RemovedMembership> {
  const { data } = await api.delete<{ ok: true; membership: RemovedMembership }>(
    `/student-classes/${encodeURIComponent(classPublicId)}/students/${encodeURIComponent(
      membershipPublicId
    )}`
  );
  return data.membership;
}

/** Map API error to a teacher-safe message. */
export function getStudentClassErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  const e = err as {
    message?: string;
    status?: number;
    data?: { error?: string; msg?: string; code?: string };
    response?: { status?: number; data?: { error?: string; msg?: string; code?: string } };
  };
  const status = e?.status ?? e?.response?.status;
  const apiMsg =
    e?.data?.error ||
    e?.data?.msg ||
    e?.response?.data?.error ||
    e?.response?.data?.msg ||
    e?.message;
  if (status === 401) return "Please log in again.";
  if (status === 403) return "You don't have permission to manage this class.";
  if (status === 404) return "Class not found.";
  return apiMsg || fallback;
}
