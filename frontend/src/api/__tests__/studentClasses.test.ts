/**
 * API client contract tests for teacher class management.
 */
import api from "../../services/api";
import {
  acceptClassInvitation,
  archiveClass,
  cancelInvitation,
  createClass,
  createInvitations,
  declineClassInvitation,
  getClass,
  getClassStudents,
  getIncomingClassInvitations,
  getInvitations,
  getMyClassMemberships,
  getMyClasses,
  getStudentInvitationErrorMessage,
  leaveClass,
  previewCsv,
  previewEmailInput,
  removeClassStudent,
  resendInvitation,
  updateClass,
} from "../studentClasses";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
});

test("createClass posts to /student-classes without teacherId", async () => {
  mockedApi.post.mockResolvedValue({
    data: { ok: true, class: { publicId: "c1", name: "Year 11", status: "active" } },
  } as any);
  await createClass({ name: "Year 11", subject: "Biology" });
  expect(mockedApi.post).toHaveBeenCalledWith("/student-classes", {
    name: "Year 11",
    subject: "Biology",
  });
  const body = mockedApi.post.mock.calls[0][1] as Record<string, unknown>;
  expect(body).not.toHaveProperty("teacherId");
  expect(body).not.toHaveProperty("_id");
});

test("getMyClasses and getClass use publicId routes", async () => {
  mockedApi.get
    .mockResolvedValueOnce({ data: { ok: true, classes: [] } } as any)
    .mockResolvedValueOnce({
      data: { ok: true, class: { publicId: "abc", name: "Bio", status: "active" } },
    } as any);
  await getMyClasses();
  await getClass("abc");
  expect(mockedApi.get).toHaveBeenNthCalledWith(1, "/student-classes/mine");
  expect(mockedApi.get).toHaveBeenNthCalledWith(2, "/student-classes/abc");
});

test("updateClass and archiveClass use publicId", async () => {
  mockedApi.patch.mockResolvedValue({
    data: { ok: true, class: { publicId: "c1", name: "Updated", status: "active" } },
  } as any);
  mockedApi.post.mockResolvedValue({
    data: { ok: true, class: { publicId: "c1", name: "Updated", status: "archived" } },
  } as any);
  await updateClass("c1", { name: "Updated" });
  await archiveClass("c1");
  expect(mockedApi.patch).toHaveBeenCalledWith("/student-classes/c1", { name: "Updated" });
  expect(mockedApi.post).toHaveBeenCalledWith("/student-classes/c1/archive");
});

test("previewEmailInput and createInvitations use canonical endpoints", async () => {
  mockedApi.post
    .mockResolvedValueOnce({
      data: {
        ok: true,
        summary: { totalSubmitted: 2, validCount: 1, duplicateCount: 0, invalidCount: 1 },
        validEmails: ["a@ex.com"],
        duplicateEntries: [],
        invalidEntries: ["bad"],
      },
    } as any)
    .mockResolvedValueOnce({
      data: { ok: true, message: "Invitations processed.", summary: { submitted: 1, invalid: 0, duplicates: 0 } },
    } as any);
  await previewEmailInput("c1", "a@ex.com\nbad");
  await createInvitations("c1", ["a@ex.com"]);
  expect(mockedApi.post).toHaveBeenNthCalledWith(
    1,
    "/student-classes/c1/invitations/preview",
    { input: "a@ex.com\nbad" }
  );
  expect(mockedApi.post).toHaveBeenNthCalledWith(2, "/student-classes/c1/invitations", {
    emails: ["a@ex.com"],
  });
});

test("previewCsv posts multipart file field named file", async () => {
  mockedApi.post.mockResolvedValue({
    data: {
      ok: true,
      summary: { totalRows: 1, validCount: 1, duplicateCount: 0, invalidCount: 0 },
      validEmails: ["a@ex.com"],
      duplicateEntries: [],
      invalidEntries: [],
    },
  } as any);
  const file = new File(["email\na@ex.com\n"], "students.csv", { type: "text/csv" });
  await previewCsv("c1", file);
  const [url, body] = mockedApi.post.mock.calls[0];
  expect(url).toBe("/student-classes/c1/invitations/csv/preview");
  expect(body).toBeInstanceOf(FormData);
  expect((body as FormData).get("file")).toBe(file);
});

test("invitation lifecycle and roster routes use publicIds", async () => {
  mockedApi.get
    .mockResolvedValueOnce({ data: { ok: true, invitations: [] } } as any)
    .mockResolvedValueOnce({ data: { ok: true, students: [] } } as any);
  mockedApi.post
    .mockResolvedValueOnce({
      data: { ok: true, invitation: { publicId: "i1", targetEmail: "a@ex.com", status: "cancelled" } },
    } as any)
    .mockResolvedValueOnce({
      data: { ok: true, invitation: { publicId: "i1", targetEmail: "a@ex.com", status: "pending" } },
    } as any);
  mockedApi.delete.mockResolvedValue({
    data: { ok: true, membership: { publicId: "m1", status: "removed" } },
  } as any);

  await getInvitations("c1");
  await getClassStudents("c1");
  await cancelInvitation("c1", "i1");
  await resendInvitation("c1", "i1");
  await removeClassStudent("c1", "m1");

  expect(mockedApi.get).toHaveBeenCalledWith("/student-classes/c1/invitations");
  expect(mockedApi.get).toHaveBeenCalledWith("/student-classes/c1/students");
  expect(mockedApi.post).toHaveBeenCalledWith("/student-classes/c1/invitations/i1/cancel");
  expect(mockedApi.post).toHaveBeenCalledWith("/student-classes/c1/invitations/i1/resend");
  expect(mockedApi.delete).toHaveBeenCalledWith("/student-classes/c1/students/m1");
});

test("student inbox accept decline memberships leave use publicIds only", async () => {
  mockedApi.get
    .mockResolvedValueOnce({ data: { ok: true, invitations: [] } } as any)
    .mockResolvedValueOnce({ data: { ok: true, classes: [] } } as any);
  mockedApi.post
    .mockResolvedValueOnce({
      data: {
        ok: true,
        invitation: { publicId: "inv-1", status: "accepted" },
        membership: { publicId: "mem-1", status: "active" },
        class: { publicId: "c1", name: "Bio" },
        teacher: { displayName: "Tina" },
      },
    } as any)
    .mockResolvedValueOnce({
      data: { ok: true, invitation: { publicId: "inv-2", status: "declined" } },
    } as any);
  mockedApi.delete.mockResolvedValue({
    data: { ok: true, membership: { publicId: "mem-1", status: "removed" } },
  } as any);

  await getIncomingClassInvitations();
  await getMyClassMemberships();
  await acceptClassInvitation("inv-1");
  await declineClassInvitation("inv-2");
  await leaveClass("mem-1");

  expect(mockedApi.get).toHaveBeenCalledWith("/student-class-invitations/incoming");
  expect(mockedApi.get).toHaveBeenCalledWith("/student-class-memberships/mine");
  expect(mockedApi.post).toHaveBeenCalledWith("/student-class-invitations/inv-1/accept");
  expect(mockedApi.post).toHaveBeenCalledWith("/student-class-invitations/inv-2/decline");
  expect(mockedApi.delete).toHaveBeenCalledWith("/student-class-memberships/mem-1");

  for (const call of mockedApi.post.mock.calls) {
    expect(call[1]).toBeUndefined();
  }
});

test("getStudentInvitationErrorMessage maps controlled codes", () => {
  expect(
    getStudentInvitationErrorMessage({
      response: { status: 410, data: { code: "INVITATION_EXPIRED", error: "Invitation has expired" } },
    })
  ).toMatch(/expired/i);
  expect(
    getStudentInvitationErrorMessage({
      response: { status: 400, data: { code: "CLASS_ARCHIVED", error: "Class is archived" } },
    })
  ).toMatch(/no longer active/i);
  expect(
    getStudentInvitationErrorMessage({
      response: { status: 404, data: { error: "Invitation not found" } },
    })
  ).toMatch(/no longer available/i);
});
