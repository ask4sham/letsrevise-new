/**
 * @jest-environment node
 */
const provenance = require("../contracts/autopilotProposalProvenance.v1");
const { VERSION: A09_VERSION } = require("../services/autopilot0/executionContractIntelligenceService");

function validEvidence(overrides = {}) {
  return {
    provenanceVersion: provenance.PROVENANCE_VERSION,
    sourceSystem: provenance.SOURCE_SYSTEM,
    sourceObserver: provenance.SOURCE_OBSERVER,
    sourceObserverVersion: provenance.SUPPORTED_SOURCE_OBSERVER_VERSIONS[0],
    sourcePolicyVersion: provenance.SUPPORTED_SOURCE_POLICY_VERSIONS[0],
    sourceGeneratedAt: "2026-08-01T12:00:00.000Z",
    sourceSpecKey: "aqa-gcse-biology",
    sourceTopicKey: "aqa-gcse-biology:cell-structure",
    sourceAdvisoryAction: "CONSIDER_FLASHCARD_REVISION",
    readinessClassification: "REQUIRES_L2_PREPARATION",
    minimumPermissionLevel: "L2",
    blockingRequirements: [
      "NO_STUDENT_SCOPE",
      "NO_AUTOPILOT_ACTION_AUDIT",
      "NO_IDEMPOTENCY",
      "NO_AUTOMATED_ROLLBACK",
      "STUDENT_IMPACTING",
    ],
    sourceObservedOutcome: "WEAK_AND_STABLE",
    missingCapabilities: [
      "ACTION_IDEMPOTENCY_CONTRACT",
      "AUTOMATED_ROLLBACK_CONTRACT",
      "AUTOPILOT_ACTION_AUDIT",
      "TARGET_SCOPE_RESOLVER",
    ],
    executionContract: {
      auditReadiness: "MISSING",
      idempotencyReadiness: "MISSING",
      rollbackReadiness: "MISSING",
      targetingReadiness: "MISSING",
      approvalReadiness: "MISSING",
      futurePilotEligible: false,
      executionRisks: ["STUDENT_IMPACTING", "REQUIRES_OWNED_FROZEN_TARGET_SCOPE"],
    },
    ...overrides,
  };
}

describe("autopilotProposalProvenance.v1", () => {
  test("provenance version exact", () => {
    expect(provenance.PROVENANCE_VERSION).toBe("autopilot-proposal-provenance-v1");
  });

  test("source system exact", () => {
    expect(provenance.SOURCE_SYSTEM).toBe("autopilot0");
  });

  test("source observer exact", () => {
    expect(provenance.SOURCE_OBSERVER).toBe("execution-contract-intelligence");
  });

  test("supported observer version matches A0.9 VERSION", () => {
    expect(provenance.SUPPORTED_SOURCE_OBSERVER_VERSIONS).toEqual([
      "autopilot0-execution-contract-intelligence-v1",
    ]);
    expect(A09_VERSION).toBe("autopilot0-execution-contract-intelligence-v1");
    expect(provenance.SUPPORTED_SOURCE_OBSERVER_VERSIONS[0]).toBe(A09_VERSION);
  });

  test("supported policy version remains autopilot-safety-policy-v1", () => {
    expect(provenance.SUPPORTED_SOURCE_POLICY_VERSIONS).toEqual(["autopilot-safety-policy-v1"]);
  });

  test("canonical evidence contains only allowed fields", () => {
    const canonical = provenance.canonicaliseEvidenceSnapshot(validEvidence());
    expect(Object.keys(canonical).sort()).toEqual(
      [
        "blockingRequirements",
        "executionContract",
        "minimumPermissionLevel",
        "missingCapabilities",
        "provenanceVersion",
        "readinessClassification",
        "sourceAdvisoryAction",
        "sourceGeneratedAt",
        "sourceObservedOutcome",
        "sourceObserver",
        "sourceObserverVersion",
        "sourcePolicyVersion",
        "sourceSpecKey",
        "sourceSystem",
        "sourceTopicKey",
      ].sort()
    );
  });

  test("unknown top-level object field is rejected", () => {
    expect(() =>
      provenance.validateSourceEvidence(
        validEvidence({ unexpectedObserverPayload: { anything: true } })
      )
    ).toThrow(/Unsupported field: unexpectedObserverPayload/);
    try {
      provenance.validateSourceEvidence(
        validEvidence({ unexpectedObserverPayload: { anything: true } })
      );
    } catch (err) {
      expect(err.code).toBe("UNSUPPORTED_FIELD");
    }
  });

  test("unknown top-level scalar field is rejected", () => {
    expect(() =>
      provenance.validateSourceEvidence(validEvidence({ gitSha: "abc123" }))
    ).toThrow(/Unsupported field: gitSha/);
    try {
      provenance.validateSourceEvidence(validEvidence({ gitSha: "abc123" }));
    } catch (err) {
      expect(err.code).toBe("UNSUPPORTED_FIELD");
    }
  });

  test("unknown executionContract key is rejected", () => {
    expect(() =>
      provenance.validateSourceEvidence(
        validEvidence({
          executionContract: {
            ...validEvidence().executionContract,
            unexpectedContractKey: true,
          },
        })
      )
    ).toThrow(/Unsupported field: executionContract.unexpectedContractKey/);
    try {
      provenance.validateSourceEvidence(
        validEvidence({
          executionContract: {
            ...validEvidence().executionContract,
            unexpectedContractKey: true,
          },
        })
      );
    } catch (err) {
      expect(err.code).toBe("UNSUPPORTED_FIELD");
    }
  });

  test("valid optional-field absence still passes", () => {
    const minimal = validEvidence();
    delete minimal.sourceObservedOutcome;
    delete minimal.missingCapabilities;
    delete minimal.executionContract;
    const canonical = provenance.canonicaliseEvidenceSnapshot(minimal);
    expect(canonical).not.toHaveProperty("sourceObservedOutcome");
    expect(canonical).not.toHaveProperty("missingCapabilities");
    expect(canonical).not.toHaveProperty("executionContract");
    expect(provenance.validateSourceEvidence(minimal).evidenceSnapshotHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test("valid evidence hash remains stable for canonical fixture", () => {
    // Every persisted/authenticated provenance field must be part of the versioned
    // provenance contract. Unsupported fields are rejected rather than stored or
    // silently excluded from integrity hashing.
    const first = provenance.deriveEvidenceSnapshotHash(validEvidence());
    const second = provenance.deriveEvidenceSnapshotHash(validEvidence());
    expect(first).toBe(second);
  });

  test("canonicalisation does not mutate input", () => {
    const input = validEvidence({
      blockingRequirements: ["STUDENT_IMPACTING", "NO_IDEMPOTENCY"],
      missingCapabilities: ["TARGET_SCOPE_RESOLVER", "AUTOPILOT_ACTION_AUDIT"],
    });
    const beforeBlockers = [...input.blockingRequirements];
    const beforeCapabilities = [...input.missingCapabilities];
    provenance.canonicaliseEvidenceSnapshot(input);
    expect(input.blockingRequirements).toEqual(beforeBlockers);
    expect(input.missingCapabilities).toEqual(beforeCapabilities);
  });

  test("object key insertion order does not alter evidence hash", () => {
    const a = validEvidence();
    const b = {
      blockingRequirements: a.blockingRequirements,
      sourceTopicKey: a.sourceTopicKey,
      sourceSpecKey: a.sourceSpecKey,
      sourceGeneratedAt: a.sourceGeneratedAt,
      sourcePolicyVersion: a.sourcePolicyVersion,
      sourceObserverVersion: a.sourceObserverVersion,
      sourceObserver: a.sourceObserver,
      sourceSystem: a.sourceSystem,
      provenanceVersion: a.provenanceVersion,
      readinessClassification: a.readinessClassification,
      minimumPermissionLevel: a.minimumPermissionLevel,
      sourceAdvisoryAction: a.sourceAdvisoryAction,
      sourceObservedOutcome: a.sourceObservedOutcome,
      missingCapabilities: a.missingCapabilities,
      executionContract: a.executionContract,
    };
    expect(provenance.deriveEvidenceSnapshotHash(a)).toBe(provenance.deriveEvidenceSnapshotHash(b));
  });

  test("blocker array ordering does not alter hash", () => {
    const forward = validEvidence({
      blockingRequirements: [
        "NO_STUDENT_SCOPE",
        "NO_AUTOPILOT_ACTION_AUDIT",
        "NO_IDEMPOTENCY",
        "NO_AUTOMATED_ROLLBACK",
        "STUDENT_IMPACTING",
      ],
    });
    const reverse = validEvidence({
      blockingRequirements: [
        "STUDENT_IMPACTING",
        "NO_AUTOMATED_ROLLBACK",
        "NO_IDEMPOTENCY",
        "NO_AUTOPILOT_ACTION_AUDIT",
        "NO_STUDENT_SCOPE",
      ],
    });
    expect(provenance.deriveEvidenceSnapshotHash(forward)).toBe(
      provenance.deriveEvidenceSnapshotHash(reverse)
    );
  });

  test("missingCapabilities ordering does not alter hash", () => {
    const forward = validEvidence({
      missingCapabilities: [
        "ACTION_IDEMPOTENCY_CONTRACT",
        "AUTOMATED_ROLLBACK_CONTRACT",
        "AUTOPILOT_ACTION_AUDIT",
        "TARGET_SCOPE_RESOLVER",
      ],
    });
    const reverse = validEvidence({
      missingCapabilities: [
        "TARGET_SCOPE_RESOLVER",
        "AUTOPILOT_ACTION_AUDIT",
        "AUTOMATED_ROLLBACK_CONTRACT",
        "ACTION_IDEMPOTENCY_CONTRACT",
      ],
    });
    expect(provenance.deriveEvidenceSnapshotHash(forward)).toBe(
      provenance.deriveEvidenceSnapshotHash(reverse)
    );
  });

  test("evidence hash is deterministic", () => {
    const input = validEvidence();
    const first = provenance.deriveEvidenceSnapshotHash(input);
    const second = provenance.deriveEvidenceSnapshotHash(input);
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  test("changing sourceGeneratedAt changes hash", () => {
    const base = validEvidence();
    const changed = validEvidence({ sourceGeneratedAt: "2026-08-02T12:00:00.000Z" });
    expect(provenance.deriveEvidenceSnapshotHash(base)).not.toBe(
      provenance.deriveEvidenceSnapshotHash(changed)
    );
  });

  test("changing sourceSpecKey changes hash", () => {
    const base = validEvidence();
    const changed = validEvidence({ sourceSpecKey: "aqa-gcse-physics" });
    expect(provenance.deriveEvidenceSnapshotHash(base)).not.toBe(
      provenance.deriveEvidenceSnapshotHash(changed)
    );
  });

  test("changing sourceTopicKey changes hash", () => {
    const base = validEvidence();
    const changed = validEvidence({ sourceTopicKey: "aqa-gcse-biology:osmosis" });
    expect(provenance.deriveEvidenceSnapshotHash(base)).not.toBe(
      provenance.deriveEvidenceSnapshotHash(changed)
    );
  });

  test("changing sourceAdvisoryAction changes hash", () => {
    const base = validEvidence();
    const changed = validEvidence({ sourceAdvisoryAction: "CONSIDER_MORE_PRACTICE" });
    expect(provenance.deriveEvidenceSnapshotHash(base)).not.toBe(
      provenance.deriveEvidenceSnapshotHash(changed)
    );
  });

  test("changing readinessClassification changes hash", () => {
    const base = validEvidence();
    const changed = validEvidence({ readinessClassification: "REQUIRES_HUMAN_APPROVAL" });
    expect(provenance.deriveEvidenceSnapshotHash(base)).not.toBe(
      provenance.deriveEvidenceSnapshotHash(changed)
    );
  });

  test("unsupported policy version is rejected", () => {
    expect(() =>
      provenance.canonicaliseEvidenceSnapshot(
        validEvidence({ sourcePolicyVersion: "autopilot-safety-policy-v2" })
      )
    ).toThrow(/Unsupported source policy version/);
    try {
      provenance.canonicaliseEvidenceSnapshot(
        validEvidence({ sourcePolicyVersion: "autopilot-safety-policy-v2" })
      );
    } catch (err) {
      expect(err.code).toBe("UNSUPPORTED_POLICY_VERSION");
    }
  });

  test("unknown observer rejected", () => {
    expect(() =>
      provenance.canonicaliseEvidenceSnapshot(
        validEvidence({ sourceObserver: "action-readiness-intelligence" })
      )
    ).toThrow(/Unknown source observer/);
    try {
      provenance.canonicaliseEvidenceSnapshot(
        validEvidence({ sourceObserver: "action-readiness-intelligence" })
      );
    } catch (err) {
      expect(err.code).toBe("UNKNOWN_OBSERVER");
    }
  });

  test("unknown observer version rejected", () => {
    expect(() =>
      provenance.canonicaliseEvidenceSnapshot(
        validEvidence({ sourceObserverVersion: "autopilot0-action-readiness-intelligence-v1" })
      )
    ).toThrow(/Unsupported source observer version/);
    try {
      provenance.canonicaliseEvidenceSnapshot(
        validEvidence({ sourceObserverVersion: "autopilot0-action-readiness-intelligence-v1" })
      );
    } catch (err) {
      expect(err.code).toBe("UNSUPPORTED_OBSERVER_VERSION");
    }
  });

  test("forbidden top-level student field rejected", () => {
    expect(() =>
      provenance.canonicaliseEvidenceSnapshot(validEvidence({ studentId: "s1" }))
    ).toThrow(/Forbidden field: studentId/);
    try {
      provenance.canonicaliseEvidenceSnapshot(validEvidence({ studentId: "s1" }));
    } catch (err) {
      expect(err.code).toBe("FORBIDDEN_FIELD");
    }
  });

  test("forbidden deeply nested student field rejected", () => {
    expect(() =>
      provenance.canonicaliseEvidenceSnapshot(
        validEvidence({
          executionContract: {
            auditReadiness: "MISSING",
            nested: { ownerTeacherId: "teacher-1" },
          },
        })
      )
    ).toThrow(/Forbidden field: executionContract.nested.ownerTeacherId/);
    try {
      provenance.canonicaliseEvidenceSnapshot(
        validEvidence({
          executionContract: {
            auditReadiness: "MISSING",
            nested: { ownerTeacherId: "teacher-1" },
          },
        })
      );
    } catch (err) {
      expect(err.code).toBe("FORBIDDEN_FIELD");
    }
  });

  test("raw arbitrary observer JSON is rejected", () => {
    expect(() =>
      provenance.canonicaliseEvidenceSnapshot(
        validEvidence({
          topicExecutionReadiness: [{ topicKey: "x", advisoryAction: "CONSIDER_RETEACH" }],
        })
      )
    ).toThrow(/Unsupported field: topicExecutionReadiness/);
    expect(() =>
      provenance.canonicaliseEvidenceSnapshot(
        validEvidence({
          policy: { executionEnabled: false },
        })
      )
    ).toThrow(/Unsupported field: policy/);
  });

  test("client-supplied evidenceSnapshotHash is not accepted as trusted evidence", () => {
    expect(() =>
      provenance.canonicaliseEvidenceSnapshot(
        validEvidence({ evidenceSnapshotHash: "deadbeef".repeat(8) })
      )
    ).toThrow(/Client-supplied trusted digest not permitted/);
    try {
      provenance.canonicaliseEvidenceSnapshot(
        validEvidence({ evidenceSnapshotHash: "deadbeef".repeat(8) })
      );
    } catch (err) {
      expect(err.code).toBe("CLIENT_SUPPLIED_HASH_NOT_PERMITTED");
    }
  });

  test("no targetSnapshotHash, evidenceSnapshotHash, or idempotency conflation", () => {
    const evidence = validEvidence();
    const evidenceHash = provenance.deriveEvidenceSnapshotHash(evidence);

    expect(() =>
      provenance.canonicaliseEvidenceSnapshot(validEvidence({ targetSnapshotHash: evidenceHash }))
    ).toThrow(/Client-supplied trusted digest not permitted: targetSnapshotHash/);

    expect(() =>
      provenance.canonicaliseEvidenceSnapshot(validEvidence({ idempotencyKey: evidenceHash }))
    ).toThrow(/Client-supplied trusted digest not permitted: idempotencyKey/);

    const validated = provenance.validateSourceEvidence(evidence);
    expect(validated.evidenceSnapshotHash).toBe(evidenceHash);
    expect(validated).not.toHaveProperty("targetSnapshotHash");
    expect(validated).not.toHaveProperty("idempotencyKey");
    const { evidenceSnapshotHash, ...canonicalOnly } = validated;
    expect(provenance.deriveEvidenceSnapshotHash(canonicalOnly)).toBe(evidenceHash);
    expect(evidenceSnapshotHash).toBe(provenance.deriveEvidenceSnapshotHash(canonicalOnly));
  });
});
