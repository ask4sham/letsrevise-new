import { mapAccessErrorToStatus } from "../mapAccessErrorToStatus";

describe("mapAccessErrorToStatus", () => {
  test("maps NOT_AUTHENTICATED to 401", () => {
    expect(mapAccessErrorToStatus("NOT_AUTHENTICATED")).toBe(401);
  });

  test("maps NOT_PUBLISHED to 404", () => {
    expect(mapAccessErrorToStatus("NOT_PUBLISHED")).toBe(404);
  });

  test("maps NOT_ENTITLED to 403", () => {
    expect(mapAccessErrorToStatus("NOT_ENTITLED")).toBe(403);
  });
});
