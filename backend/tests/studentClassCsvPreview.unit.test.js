/**
 * Unit: CSV invitation syntax preview (no DB / no User lookup).
 */
const {
  parseStudentInvitationCsv,
  CSV_MAX_BYTES,
} = require("../services/studentClassCsvPreview");

describe("parseStudentInvitationCsv", () => {
  test("accepts UTF-8 CSV with email header", () => {
    const csv = "email\na@ex.com\nb@ex.com\n";
    const r = parseStudentInvitationCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.validEmails).toEqual(["a@ex.com", "b@ex.com"]);
    expect(r.summary.totalRows).toBe(2);
  });

  test("accepts BOM and case-insensitive header", () => {
    const csv = "\uFEFFEmail\nStudent@School.EDU.UK\n";
    const r = parseStudentInvitationCsv(Buffer.from(csv, "utf8"));
    expect(r.ok).toBe(true);
    expect(r.validEmails).toEqual(["student@school.edu.uk"]);
  });

  test("trims header/value; ignores blank rows", () => {
    const csv = " email \n  a@ex.com  \n\n\nb@ex.com\n";
    const r = parseStudentInvitationCsv(csv);
    expect(r.validEmails).toEqual(["a@ex.com", "b@ex.com"]);
    expect(r.summary.totalRows).toBe(2);
  });

  test("handles quoted CSV values and commas in unrelated fields", () => {
    const csv = 'email,notes\n"a@ex.com","hello, world"\nb@ex.com,plain\n';
    const r = parseStudentInvitationCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.validEmails).toEqual(["a@ex.com", "b@ex.com"]);
  });

  test("rejects missing email column", () => {
    const r = parseStudentInvitationCsv("name\nAda\n");
    expect(r.ok).toBe(false);
    expect(r.code).toBe("EMAIL_COLUMN_MISSING");
  });

  test("rejects empty file", () => {
    expect(parseStudentInvitationCsv("").ok).toBe(false);
    expect(parseStudentInvitationCsv(Buffer.alloc(0)).code).toBe("FILE_EMPTY");
  });

  test("rejects malformed CSV", () => {
    const r = parseStudentInvitationCsv('email\n"unclosed\n');
    expect(r.ok).toBe(false);
    expect(r.code).toBe("CSV_MALFORMED");
  });

  test("rejects oversized buffer", () => {
    const big = Buffer.alloc(CSV_MAX_BYTES + 1, 97);
    const r = parseStudentInvitationCsv(big);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("FILE_TOO_LARGE");
  });

  test("reports invalid email row with row number", () => {
    const csv = "email\ngood@ex.com\nbad-email\n";
    const r = parseStudentInvitationCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.validEmails).toEqual(["good@ex.com"]);
    expect(r.invalidEntries).toEqual([
      expect.objectContaining({ row: 3, value: "bad-email" }),
    ]);
  });

  test("deduplicates normalised addresses; preserves first occurrence", () => {
    const csv = "email\nFirst@Ex.COM\nsecond@ex.com\nfirst@ex.com\n";
    const r = parseStudentInvitationCsv(csv);
    expect(r.validEmails).toEqual(["first@ex.com", "second@ex.com"]);
    expect(r.duplicateEntries).toEqual(["first@ex.com"]);
  });

  test("enforces 200 unique valid limit", () => {
    const rows = ["email", ...Array.from({ length: 201 }, (_, i) => `u${i}@ex.com`)].join("\n");
    const r = parseStudentInvitationCsv(rows);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("EMAIL_LIMIT_EXCEEDED");
  });

  test("optional columns ignored for identity", () => {
    const csv = "email,firstName,lastName\na@ex.com,Ada,Lovelace\n";
    const r = parseStudentInvitationCsv(csv);
    expect(r.validEmails).toEqual(["a@ex.com"]);
    expect(JSON.stringify(r)).not.toMatch(/Ada|Lovelace/);
  });
});
