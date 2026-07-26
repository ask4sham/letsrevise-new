/**
 * Unit: safe display name — no email/ID leakage.
 */
const { getSafeUserDisplayName } = require("../utils/userDisplayName");

describe("getSafeUserDisplayName", () => {
  test("safe teacher/student name from first+last", () => {
    expect(getSafeUserDisplayName({ firstName: "Ada", lastName: "Lovelace" })).toBe(
      "Ada Lovelace"
    );
  });

  test("fallback when empty — never email", () => {
    expect(getSafeUserDisplayName({ email: "secret@ex.com" })).toBe("User");
    expect(getSafeUserDisplayName(null, "Teacher")).toBe("Teacher");
  });

  test("does not echo Mongo-looking ids", () => {
    const name = getSafeUserDisplayName({ firstName: "Sam" });
    expect(name).toBe("Sam");
    expect(name).not.toMatch(/^[a-f0-9]{24}$/i);
  });
});
