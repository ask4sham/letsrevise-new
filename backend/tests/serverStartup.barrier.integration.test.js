/**
 * Startup barrier: listen only after JWT + Mongo + Attempt-2 index checks.
 * Does not connect to real MongoDB or listen on a real port.
 */
jest.mock("../services/llm/provider", () => ({
  logEnquiryTutorStartup: jest.fn(),
}));

jest.mock("../services/supabaseStorage", () => ({
  isSupabaseStorageEnabled: () => false,
}));

jest.mock("../services/r2Storage", () => ({
  isR2Enabled: () => false,
}));

jest.mock("../config/logDataPlane", () => ({
  supabaseUrlHost: () => "",
}));

describe("server startup barrier", () => {
  const originalJwt = process.env.JWT_SECRET_KEY;
  const originalJwtAlt = process.env.JWT_SECRET;

  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET_KEY = "test-jwt-secret-for-startup-barrier-32chars";
    process.env.JWT_SECRET = process.env.JWT_SECRET_KEY;
    process.env.NODE_ENV = "test";
  });

  afterAll(() => {
    if (originalJwt === undefined) delete process.env.JWT_SECRET_KEY;
    else process.env.JWT_SECRET_KEY = originalJwt;
    if (originalJwtAlt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtAlt;
  });

  function loadServer() {
    // eslint-disable-next-line global-require
    return require("../server");
  }

  test("app import path does not call listen", () => {
    const listenSpy = jest.spyOn(require("http").Server.prototype, "listen");
    // eslint-disable-next-line global-require
    require("../app");
    expect(listenSpy).not.toHaveBeenCalled();
    listenSpy.mockRestore();
  });

  test("listen is not called before Mongo connection resolves", async () => {
    const { startServer } = loadServer();
    let resolveConnect;
    const connectPromise = new Promise((resolve) => {
      resolveConnect = resolve;
    });
    const listen = jest.fn(() => ({ on: jest.fn() }));
    const ensureIndexes = jest.fn(async () => ({ indexName: "uq", created: false }));
    const refresh = jest.fn(async () => {});

    const startPromise = startServer({
      connectDB: () => connectPromise,
      ensureExamQuestionRationaleCandidateIndexes: ensureIndexes,
      refreshSpecTopicRegistryCache: refresh,
      listen,
      exit: jest.fn(),
      port: 5999,
    });

    await Promise.resolve();
    expect(listen).not.toHaveBeenCalled();
    expect(ensureIndexes).not.toHaveBeenCalled();

    resolveConnect();
    await startPromise;
    expect(ensureIndexes).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledTimes(1);
  });

  test("listen is not called before Attempt-2 index verification resolves", async () => {
    const { startServer } = loadServer();
    let resolveIndexes;
    const indexPromise = new Promise((resolve) => {
      resolveIndexes = resolve;
    });
    const listen = jest.fn(() => ({ on: jest.fn() }));

    const startPromise = startServer({
      connectDB: async () => {},
      ensureExamQuestionRationaleCandidateIndexes: () => indexPromise,
      refreshSpecTopicRegistryCache: async () => {},
      listen,
      exit: jest.fn(),
      port: 5998,
    });

    await Promise.resolve();
    expect(listen).not.toHaveBeenCalled();

    resolveIndexes({ indexName: "uq_attempt2_generation_group", created: false });
    await startPromise;
    expect(listen).toHaveBeenCalledTimes(1);
  });

  test("Mongo failure prevents listen", async () => {
    const { startServer } = loadServer();
    const listen = jest.fn(() => ({ on: jest.fn() }));
    const exit = jest.fn();

    await startServer({
      connectDB: async () => {
        throw new Error("mongo down");
      },
      ensureExamQuestionRationaleCandidateIndexes: jest.fn(),
      refreshSpecTopicRegistryCache: jest.fn(),
      listen,
      exit,
      port: 5997,
    });

    expect(listen).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });

  test("required index failure prevents listen", async () => {
    const { startServer } = loadServer();
    const listen = jest.fn(() => ({ on: jest.fn() }));
    const exit = jest.fn();

    await startServer({
      connectDB: async () => {},
      ensureExamQuestionRationaleCandidateIndexes: async () => {
        throw new Error("index missing");
      },
      refreshSpecTopicRegistryCache: jest.fn(),
      listen,
      exit,
      port: 5996,
    });

    expect(listen).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });

  test("background registry refresh runs at most once on successful start", async () => {
    const { startServer } = loadServer();
    const listen = jest.fn(() => ({ on: jest.fn() }));
    const refresh = jest.fn(async () => {});

    await startServer({
      connectDB: async () => {},
      ensureExamQuestionRationaleCandidateIndexes: async () => ({
        indexName: "uq_attempt2_generation_group",
        created: false,
      }),
      refreshSpecTopicRegistryCache: refresh,
      listen,
      exit: jest.fn(),
      port: 5995,
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledTimes(1);
  });
});
