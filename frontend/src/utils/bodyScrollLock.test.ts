import {
  __getBodyScrollLockCountForTests,
  __resetBodyScrollLockForTests,
  lockBodyScroll,
} from "./bodyScrollLock";

function resetBody(): void {
  __resetBodyScrollLockForTests();
  document.body.style.removeProperty("overflow");
}

describe("bodyScrollLock", () => {
  beforeEach(() => {
    resetBody();
  });

  afterEach(() => {
    resetBody();
  });

  it("release A before B: hidden until B releases", () => {
    const releaseA = lockBodyScroll();
    const releaseB = lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");
    expect(__getBodyScrollLockCountForTests()).toBe(2);

    releaseA();
    expect(document.body.style.overflow).toBe("hidden");
    expect(__getBodyScrollLockCountForTests()).toBe(1);

    releaseB();
    expect(document.body.style.overflow).toBe("");
    expect(__getBodyScrollLockCountForTests()).toBe(0);
  });

  it("release B before A: hidden until A releases", () => {
    const releaseA = lockBodyScroll();
    const releaseB = lockBodyScroll();

    releaseB();
    expect(document.body.style.overflow).toBe("hidden");
    expect(__getBodyScrollLockCountForTests()).toBe(1);

    releaseA();
    expect(document.body.style.overflow).toBe("");
    expect(__getBodyScrollLockCountForTests()).toBe(0);
  });

  it("double cleanup on one acquire cannot underflow or unlock early", () => {
    const releaseA = lockBodyScroll();
    const releaseB = lockBodyScroll();

    releaseA();
    releaseA();
    expect(document.body.style.overflow).toBe("hidden");
    expect(__getBodyScrollLockCountForTests()).toBe(1);

    releaseB();
    expect(document.body.style.overflow).toBe("");
    expect(__getBodyScrollLockCountForTests()).toBe(0);
  });

  it("restores a pre-existing non-empty body overflow value", () => {
    document.body.style.overflow = "auto";
    const release = lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");

    release();
    expect(document.body.style.overflow).toBe("auto");
    expect(__getBodyScrollLockCountForTests()).toBe(0);
  });
});
