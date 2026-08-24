/**
 * Unit: invitation email ownership helper.
 */
const { invitationOwnedByStudent } = require("../utils/invitationOwnership");

describe("invitationOwnedByStudent", () => {
  const invitation = { targetEmail: "student@school.edu.uk" };

  test("matching normalised email", () => {
    expect(
      invitationOwnedByStudent(invitation, {
        email: "student@school.edu.uk",
        userType: "student",
      })
    ).toBe(true);
  });

  test("uppercase/whitespace normalisation", () => {
    expect(
      invitationOwnedByStudent(invitation, {
        email: "  Student@School.EDU.UK  ",
        userType: "student",
      })
    ).toBe(true);
  });

  test("wrong email", () => {
    expect(
      invitationOwnedByStudent(invitation, {
        email: "other@school.edu.uk",
        userType: "student",
      })
    ).toBe(false);
  });

  test("missing authenticated email", () => {
    expect(invitationOwnedByStudent(invitation, { userType: "student" })).toBe(false);
  });

  test("non-student role", () => {
    expect(
      invitationOwnedByStudent(invitation, {
        email: "student@school.edu.uk",
        userType: "teacher",
      })
    ).toBe(false);
  });
});
