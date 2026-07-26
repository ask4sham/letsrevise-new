/**
 * Unit: email normalisation + bulk-paste parser (no DB).
 */
const {
  normaliseEmail,
  parseStudentEmailInput,
  MAX_UNIQUE_VALID_EMAILS,
} = require("../utils/studentEmail");

describe("normaliseEmail", () => {
  test("trims and lowercases", () => {
    expect(normaliseEmail("  Student@School.Example.COM  ")).toEqual({
      ok: true,
      email: "student@school.example.com",
    });
  });

  test("rejects non-string", () => {
    expect(normaliseEmail(null).ok).toBe(false);
    expect(normaliseEmail(123).ok).toBe(false);
    expect(normaliseEmail({}).ok).toBe(false);
  });

  test("rejects empty / whitespace", () => {
    expect(normaliseEmail("").ok).toBe(false);
    expect(normaliseEmail("   ").ok).toBe(false);
  });

  test("rejects malformed email", () => {
    expect(normaliseEmail("not-an-email").ok).toBe(false);
    expect(normaliseEmail("a@").ok).toBe(false);
    expect(normaliseEmail("@b.com").ok).toBe(false);
  });

  test("handles valid school-domain email", () => {
    expect(normaliseEmail("year10.student@school.edu.uk")).toEqual({
      ok: true,
      email: "year10.student@school.edu.uk",
    });
  });
});

describe("parseStudentEmailInput", () => {
  test("newline-separated", () => {
    const r = parseStudentEmailInput("a@ex.com\nb@ex.com");
    expect(r.ok).toBe(true);
    expect(r.validEmails).toEqual(["a@ex.com", "b@ex.com"]);
    expect(r.totalSubmitted).toBe(2);
  });

  test("comma-separated", () => {
    const r = parseStudentEmailInput("a@ex.com, b@ex.com");
    expect(r.validEmails).toEqual(["a@ex.com", "b@ex.com"]);
  });

  test("semicolon-separated", () => {
    const r = parseStudentEmailInput("a@ex.com;b@ex.com");
    expect(r.validEmails).toEqual(["a@ex.com", "b@ex.com"]);
  });

  test("mixed delimiters", () => {
    const r = parseStudentEmailInput("a@ex.com\nb@ex.com, c@ex.com;d@ex.com");
    expect(r.validEmails).toEqual(["a@ex.com", "b@ex.com", "c@ex.com", "d@ex.com"]);
  });

  test("blank values ignored", () => {
    const r = parseStudentEmailInput("a@ex.com\n\n  \n,;b@ex.com");
    expect(r.validEmails).toEqual(["a@ex.com", "b@ex.com"]);
    expect(r.totalSubmitted).toBe(2);
  });

  test("normalised duplicates preserve first occurrence order", () => {
    const r = parseStudentEmailInput("First@Ex.COM\nsecond@ex.com\nfirst@ex.com");
    expect(r.validEmails).toEqual(["first@ex.com", "second@ex.com"]);
    expect(r.duplicateEntries).toEqual(["first@ex.com"]);
  });

  test("invalid entries collected", () => {
    const r = parseStudentEmailInput("good@ex.com\nbad\nalso-bad@");
    expect(r.validEmails).toEqual(["good@ex.com"]);
    expect(r.invalidEntries).toEqual(["bad", "also-bad@"]);
  });

  test("maximum 200 unique valid emails allowed", () => {
    const emails = Array.from({ length: 200 }, (_, i) => `u${i}@ex.com`).join("\n");
    const r = parseStudentEmailInput(emails);
    expect(r.ok).toBe(true);
    expect(r.validEmails).toHaveLength(200);
  });

  test("limit exceeded returns controlled error", () => {
    const emails = Array.from({ length: 201 }, (_, i) => `u${i}@ex.com`).join("\n");
    const r = parseStudentEmailInput(emails);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("EMAIL_LIMIT_EXCEEDED");
    expect(r.maxUnique).toBe(MAX_UNIQUE_VALID_EMAILS);
    expect(r.validEmails).toHaveLength(200);
  });

  test("array input supported", () => {
    const r = parseStudentEmailInput([" A@Ex.COM ", "b@ex.com", "a@ex.com"]);
    expect(r.validEmails).toEqual(["a@ex.com", "b@ex.com"]);
    expect(r.duplicateEntries).toEqual(["a@ex.com"]);
  });
});
