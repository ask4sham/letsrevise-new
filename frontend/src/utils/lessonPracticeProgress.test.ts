/**
 * @jest-environment jsdom
 */
import {
  computeDedicatedPracticeState,
  createFreshPracticeIdempotencyKey,
} from "./lessonPracticeProgress";
import { runSingleFlight, clearSingleFlightForTests } from "./freshPracticeSingleFlight";

describe("lessonPracticeProgress", () => {
  test("computeDedicatedPracticeState covers not_started / in_progress / completed", () => {
    expect(computeDedicatedPracticeState([], [])).toBe("empty");
    expect(computeDedicatedPracticeState(["a", "b"], [])).toBe("not_started");
    expect(computeDedicatedPracticeState(["a", "b"], ["a"])).toBe("in_progress");
    expect(computeDedicatedPracticeState(["a", "b"], ["a", "b"])).toBe("completed");
  });

  test("idempotency key includes topic lesson and client request", () => {
    const k = createFreshPracticeIdempotencyKey({
      topicKey: "spec:topic",
      lessonId: "abc",
      clientRequestId: "req-1",
    });
    expect(k).toContain("fresh-practice:");
    expect(k).toContain("req-1");
  });
});

describe("freshPracticeSingleFlight", () => {
  afterEach(() => clearSingleFlightForTests());

  test("parallel callers with same key share one promise", async () => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 30));
      return "ok";
    };
    const [a, b] = await Promise.all([runSingleFlight("k1", fn), runSingleFlight("k1", fn)]);
    expect(a).toBe("ok");
    expect(b).toBe("ok");
    expect(calls).toBe(1);
  });
});
