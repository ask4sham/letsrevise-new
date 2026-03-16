/**
 * Tests for Autopilot Prompt Metadata helper.
 */
const {
  getAvailableAutopilotPromptPacks,
  getCurrentAutopilotPromptPack,
  getAutopilotPromptPackById,
  buildAutopilotPromptMetadata,
} = require("../services/autopilotPromptMetadata");

describe("autopilotPromptMetadata", () => {
  it("getAvailableAutopilotPromptPacks returns active packs", () => {
    const packs = getAvailableAutopilotPromptPacks();
    expect(Array.isArray(packs)).toBe(true);
    expect(packs.length).toBeGreaterThanOrEqual(1);
    expect(packs.every((p) => p.isActive)).toBe(true);
    expect(packs.some((p) => p.promptPackId === "autopilot-core" && p.promptPackVersion === "v1")).toBe(true);
  });

  it("getCurrentAutopilotPromptPack returns default pack", () => {
    const pack = getCurrentAutopilotPromptPack();
    expect(pack.promptPackId).toBe("autopilot-core");
    expect(pack.promptPackVersion).toBe("v1");
    expect(pack.label).toBeDefined();
    expect(pack.generatorMode).toBe("starter_pack");
  });

  it("getAutopilotPromptPackById resolves valid pack", () => {
    const { pack, error } = getAutopilotPromptPackById("autopilot-core", "v1");
    expect(error).toBeNull();
    expect(pack).not.toBeNull();
    expect(pack.promptPackId).toBe("autopilot-core");
    expect(pack.promptPackVersion).toBe("v1");
  });

  it("getAutopilotPromptPackById resolves v2", () => {
    const { pack, error } = getAutopilotPromptPackById("autopilot-core", "v2");
    expect(error).toBeNull();
    expect(pack).not.toBeNull();
    expect(pack.promptPackVersion).toBe("v2");
  });

  it("getAutopilotPromptPackById fails for unknown pack", () => {
    const { pack, error } = getAutopilotPromptPackById("unknown-pack");
    expect(pack).toBeNull();
    expect(error).toContain("Unknown prompt pack");
  });

  it("getAutopilotPromptPackById fails for unknown version", () => {
    const { pack, error } = getAutopilotPromptPackById("autopilot-core", "v99");
    expect(pack).toBeNull();
    expect(error).toContain("Unknown prompt pack version");
  });

  it("getAutopilotPromptPackById requires promptPackId", () => {
    const { pack, error } = getAutopilotPromptPackById("");
    expect(pack).toBeNull();
    expect(error).toBe("promptPackId required");
  });

  it("buildAutopilotPromptMetadata returns full shape", () => {
    const meta = buildAutopilotPromptMetadata({
      contentType: "flashcard",
      specKey: "aqa-gcse-biology",
      topicKey: "aqa-gcse-biology:cell-structure",
      generatorMode: "starter_pack",
    });
    expect(meta.promptPackId).toBe("autopilot-core");
    expect(meta.promptPackVersion).toBe("v1");
    expect(meta.contentType).toBe("flashcard");
    expect(meta.generatorMode).toBe("starter_pack");
    expect(meta.generatedBy).toBe("autopilot");
    expect(meta.specKey).toBe("aqa-gcse-biology");
    expect(meta.topicKey).toBe("aqa-gcse-biology:cell-structure");
    expect(meta.generatedAt).toBeInstanceOf(Date);
  });

  it("buildAutopilotPromptMetadata uses passed promptPack", () => {
    const meta = buildAutopilotPromptMetadata({
      contentType: "flashcard",
      specKey: "x",
      topicKey: "y",
      promptPack: { promptPackId: "autopilot-core", promptPackVersion: "v2", generatorMode: "starter_pack" },
    });
    expect(meta.promptPackId).toBe("autopilot-core");
    expect(meta.promptPackVersion).toBe("v2");
  });

  it("buildAutopilotPromptMetadata defaults generatorMode to starter_pack", () => {
    const meta = buildAutopilotPromptMetadata({
      contentType: "quizQuestion",
      specKey: "x",
      topicKey: "y",
    });
    expect(meta.generatorMode).toBe("starter_pack");
  });
});
