import React, { useCallback, useEffect, useState } from "react";
import {
  fetchLessonCoverageReview,
  type LessonCoverageReview,
} from "../../api/lessonCoverageReview";
import "./teacherCoverageReviewPanel.css";

export type TeacherCoverageReviewPanelProps = {
  lessonId: string | undefined;
  /** Bump to refetch (e.g. after generate-assets). */
  refreshKey?: number;
};

function formatAppearances(
  appearances: { label: string; detail?: string }[]
): React.ReactNode {
  if (!appearances?.length) return <span className="teacher-coverage-review__muted">—</span>;
  const byLabel = new Map<string, number>();
  for (const a of appearances) {
    byLabel.set(a.label, (byLabel.get(a.label) || 0) + 1);
  }
  return (
    <ul className="teacher-coverage-review__list">
      {Array.from(byLabel.entries()).map(([label, n]) => (
        <li key={label}>
          {label}
          {n > 1 ? ` (×${n})` : ""}
        </li>
      ))}
    </ul>
  );
}

export function TeacherCoverageReviewPanel({
  lessonId,
  refreshKey = 0,
}: TeacherCoverageReviewPanelProps): React.ReactElement | null {
  const [review, setReview] = useState<LessonCoverageReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!lessonId) {
      setReview(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLessonCoverageReview(lessonId);
      setReview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load coverage review");
      setReview(null);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!lessonId) return null;

  const hidden = review?.hiddenSources;

  return (
    <div className="teacher-coverage-review">
      <h3 className="teacher-coverage-review__title">Coverage review</h3>
      <p className="teacher-coverage-review__subtitle">
        Live analysis of lesson blocks plus hidden AI drafts (flashcards, quiz, exam bank).
        Nothing is removed automatically.
        {review?.centralConceptName ? (
          <>
            {" "}
            Central objective: <strong>{review.centralConceptName}</strong>
          </>
        ) : null}
      </p>

      {loading ? (
        <p className="teacher-coverage-review__muted">Loading coverage…</p>
      ) : error ? (
        <p className="teacher-coverage-review__muted">{error}</p>
      ) : review ? (
        <>
          {hidden &&
          (hidden.bankFlashcards > 0 ||
            hidden.bankQuizQuestions > 0 ||
            hidden.bankExamQuestions > 0) ? (
            <div className="teacher-coverage-review__section">
              <h4>Hidden AI items in analysis</h4>
              <p className="teacher-coverage-review__muted">
                Flashcards: {hidden.flashcards} (bank: {hidden.bankFlashcards}) · Quiz drafts:{" "}
                {hidden.quizDrafts} (bank: {hidden.bankQuizQuestions}) · Exam drafts:{" "}
                {hidden.bankExamQuestions}
              </p>
            </div>
          ) : null}

          {review.overTested.length > 0 ? (
            <div className="teacher-coverage-review__section">
              <h4>Over-tested</h4>
              {review.overTested.map((w) => (
                <div key={w.id} className="teacher-coverage-review__warning">
                  <strong>
                    {w.name} — tested {w.count} time{w.count === 1 ? "" : "s"}
                    {w.isCentral ? " (central objective)" : ""}
                  </strong>
                  <div className="teacher-coverage-review__muted">Appears in:</div>
                  {formatAppearances(w.appearances)}
                  {w.suggestedReplacement?.length ? (
                    <>
                      <div className="teacher-coverage-review__muted" style={{ marginTop: 6 }}>
                        Suggested replacement focus:
                      </div>
                      <ul className="teacher-coverage-review__list">
                        {w.suggestedReplacement.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {review.underTested.filter((c) => c.count === 0).length > 0 ? (
            <div className="teacher-coverage-review__section">
              <h4>Under-tested</h4>
              {review.underTested
                .filter((c) => c.count === 0)
                .slice(0, 8)
                .map((c) => (
                  <div key={c.id} className="teacher-coverage-review__under">
                    {c.name} — {c.count} test{c.count === 1 ? "" : "s"}
                  </div>
                ))}
            </div>
          ) : null}

          {review.boundaryProfileKey && review.boundaryStatus !== "off" ? (
            <div className="teacher-coverage-review__section">
              <h4>Sub-topic boundary</h4>
              <p className="teacher-coverage-review__muted">
                Profile: {review.boundaryProfileKey} · mode: {review.boundaryStatus}
                {typeof review.scopeContaminationScore === "number"
                  ? ` · contamination: ${review.scopeContaminationScore}%`
                  : null}
              </p>
              {review.inScopeConcepts && review.inScopeConcepts.length > 0 ? (
                <>
                  <div className="teacher-coverage-review__muted">In-scope concepts:</div>
                  <ul className="teacher-coverage-review__list">
                    {review.inScopeConcepts.map((c) => (
                      <li key={c.id}>{c.name}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {review.outOfScopeConcepts && review.outOfScopeConcepts.length > 0 ? (
                <>
                  <div className="teacher-coverage-review__muted">Out-of-scope (primary targets):</div>
                  <ul className="teacher-coverage-review__list">
                    {review.outOfScopeConcepts.map((c) => (
                      <li key={c.id}>
                        {c.name} ({c.scope})
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {review.boundaryWarnings && review.boundaryWarnings.length > 0 ? (
                <>
                  <div className="teacher-coverage-review__muted">Boundary warnings:</div>
                  <ul className="teacher-coverage-review__list">
                    {review.boundaryWarnings.slice(0, 6).map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}

          {review.boundaryAudit?.boundaryProfileKey &&
          review.boundaryAudit.boundaryMode > 0 ? (
            <details className="teacher-coverage-review__section teacher-coverage-review__collapse">
              <summary>
                <h4 style={{ display: "inline", margin: 0 }}>Boundary audit</h4>
                {" "}
                <span className="teacher-coverage-review__muted">
                  {review.boundaryAudit.scopeContaminationScore}% contamination ·{" "}
                  {review.boundaryAudit.neighbourItems + review.boundaryAudit.forbiddenItems}{" "}
                  out-of-scope
                </span>
              </summary>
              <p className="teacher-coverage-review__muted">
                {review.boundaryAudit.summary.contaminationLevel === "good"
                  ? "Within target (0–5%)."
                  : review.boundaryAudit.summary.contaminationLevel === "warning"
                    ? "Elevated (5–10%) — review before publish."
                    : "High (>10%) — neighbouring-topic leakage detected."}
                {!review.boundaryAudit.summary.safeToPublish ? " · blockers present (enforce mode)." : null}
              </p>
              {review.objectiveBoundary?.outOfScopeObjectiveCount ? (
                <p className="teacher-coverage-review__muted" style={{ marginBottom: 8 }}>
                  Objectives: {review.objectiveBoundary.outOfScopeObjectiveCount} out-of-scope
                  {review.objectiveBoundary.replacementItems.length
                    ? ` · ${review.objectiveBoundary.replacementItems.length} suggested replacements`
                    : null}
                </p>
              ) : null}
              {review.boundaryAudit.blockFindings
                .filter(
                  (f) => f.boundaryStatus === "forbidden" || f.boundaryStatus === "neighbouring"
                )
                .slice(0, 8)
                .map((f) => (
                  <div key={f.blockId} className="teacher-coverage-review__warning">
                    <strong>
                      {f.title || f.primaryConceptName} — {f.boundaryStatus}
                    </strong>
                    <div className="teacher-coverage-review__muted">{f.location}</div>
                    {f.suggestedReplacementFocus ? (
                      <div className="teacher-coverage-review__muted" style={{ marginTop: 4 }}>
                        Suggested: {f.suggestedReplacementFocus}
                      </div>
                    ) : null}
                  </div>
                ))}
            </details>
          ) : null}

          {review.boundaryReplacementPlan?.replacementPlans?.length ? (
            <details className="teacher-coverage-review__section teacher-coverage-review__collapse">
              <summary>
                <h4 style={{ display: "inline", margin: 0 }}>Replacement plan</h4>
                {" "}
                <span className="teacher-coverage-review__muted">
                  {review.boundaryReplacementPlan.rerouteActive
                    ? "Reroute active for next generation"
                    : "Advisory for next generation"}
                </span>
              </summary>
              <ul className="teacher-coverage-review__list">
                {review.boundaryReplacementPlan.replacementPlans.slice(0, 6).map((p) => (
                  <li key={`${p.originalConceptId}-${p.suggestedReplacementConceptId}`}>
                    {p.originalConceptName} → {p.suggestedReplacementConceptName}
                    <span className="teacher-coverage-review__muted">
                      {" "}
                      ({p.violationType})
                    </span>
                  </li>
                ))}
              </ul>
              {review.boundaryReplacementPlan.interactionReplacementPlans?.length ? (
                <details className="teacher-coverage-review__collapse" style={{ marginTop: 8 }}>
                  <summary className="teacher-coverage-review__muted">
                    Interaction replacements ({review.boundaryReplacementPlan.interactionReplacementPlans.length})
                  </summary>
                  <ul className="teacher-coverage-review__list">
                    {review.boundaryReplacementPlan.interactionReplacementPlans.slice(0, 6).map((p) => (
                      <li key={`${p.originalConceptId}-${p.originalActivityKind}-${p.replacementBlockType}`}>
                        <strong>{p.originalConceptId}</strong> ({p.originalActivityKind}) →{" "}
                        <strong>{p.title}</strong>
                        <span className="teacher-coverage-review__muted">
                          {" "}
                          · {p.replacementBlockType} · {p.replacementConceptId}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </details>
          ) : null}

          {review.conceptPriorityDistribution?.enabled &&
          review.conceptPriorityDistribution.tiers?.length ? (
            <details className="teacher-coverage-review__section teacher-coverage-review__collapse">
              <summary>
                <h4 style={{ display: "inline", margin: 0 }}>Concept priority distribution</h4>
              </summary>
              {review.conceptPriorityDistribution.underrepresented.length > 0 ? (
                <ul className="teacher-coverage-review__list">
                  {review.conceptPriorityDistribution.underrepresented.slice(0, 4).map((u) => (
                    <li key={u.conceptId} className="teacher-coverage-review__warning">
                      {u.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {review.conceptPriorityDistribution.tiers.map((tier) =>
                tier.concepts.length > 0 ? (
                  <div key={tier.tier} style={{ marginTop: 8 }}>
                    <div className="teacher-coverage-review__muted">{tier.label}</div>
                    <ul className="teacher-coverage-review__list">
                      {tier.concepts.slice(0, 6).map((c) => (
                        <li key={c.id}>
                          {c.name} ({c.total})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null
              )}
            </details>
          ) : null}

          {review.teacherFirstOpeningCoverage?.enabled ? (
            <details className="teacher-coverage-review__section teacher-coverage-review__collapse">
              <summary>
                <h4 style={{ display: "inline", margin: 0 }}>Teacher-first opening</h4>
                {" "}
                <span className="teacher-coverage-review__muted">
                  {review.teacherFirstOpeningCoverage.openingScorePct}%
                </span>
              </summary>
              <ul className="teacher-coverage-review__list">
                <li>
                  {review.teacherFirstOpeningCoverage.definitionAppearsEarly ? "✓" : "✗"} Definition appears early
                </li>
                <li>
                  {review.teacherFirstOpeningCoverage.whyItMattersAppearsEarly ? "✓" : "✗"} Why it matters appears early
                </li>
                <li>
                  {review.teacherFirstOpeningCoverage.coreModelAppearsEarly ? "✓" : "✗"} Core model appears early
                </li>
                <li>
                  {review.teacherFirstOpeningCoverage.scenarioBeforeDefinition ? "✗" : "✓"} No scenario before definition
                </li>
                <li>
                  {review.teacherFirstOpeningCoverage.scenarioBeforeCoreKnowledge ? "✗" : "✓"} No scenario before core knowledge
                </li>
              </ul>
              {review.teacherFirstOpeningCoverage.flags?.length ? (
                <ul className="teacher-coverage-review__list">
                  {review.teacherFirstOpeningCoverage.flags.slice(0, 4).map((flag) => (
                    <li key={flag} className="teacher-coverage-review__warning">
                      {flag}
                    </li>
                  ))}
                </ul>
              ) : null}
            </details>
          ) : null}

          {review.conceptCompressionCoverage?.enabled ? (
            <details className="teacher-coverage-review__section teacher-coverage-review__collapse">
              <summary>
                <h4 style={{ display: "inline", margin: 0 }}>Concept compression coverage</h4>
                {" "}
                <span className="teacher-coverage-review__muted">
                  {review.conceptCompressionCoverage.compressionScorePct}%
                </span>
              </summary>
              <ul className="teacher-coverage-review__list">
                <li>{review.conceptCompressionCoverage.definitionPresent ? "✓" : "✗"} Definition (early)</li>
                <li>{review.conceptCompressionCoverage.whyItMattersPresent ? "✓" : "✗"} Why it matters (early)</li>
                <li>{review.conceptCompressionCoverage.coreModelPresent ? "✓" : "✗"} Core model (early)</li>
                <li>
                  Exam anchors: {review.conceptCompressionCoverage.examAnchorsCovered}/
                  {review.conceptCompressionCoverage.examAnchorsTotal}
                  {review.conceptCompressionCoverage.examAnchorsMatched?.length ? (
                    <span className="teacher-coverage-review__muted">
                      {" "}
                      ({review.conceptCompressionCoverage.examAnchorsMatched.join(", ")})
                    </span>
                  ) : null}
                </li>
              </ul>
              {review.conceptCompressionCoverage.gaps?.length ? (
                <ul className="teacher-coverage-review__list">
                  {review.conceptCompressionCoverage.gaps.slice(0, 4).map((g) => (
                    <li key={g} className="teacher-coverage-review__warning">
                      {g}
                    </li>
                  ))}
                </ul>
              ) : null}
            </details>
          ) : null}

          {review.pedagogyCoverage?.enabled ? (
            <details className="teacher-coverage-review__section teacher-coverage-review__collapse">
              <summary>
                <h4 style={{ display: "inline", margin: 0 }}>Pedagogy coverage</h4>
                {" "}
                <span className="teacher-coverage-review__muted">
                  {review.pedagogyCoverage.pedagogyScorePct}%
                </span>
              </summary>
              <ul className="teacher-coverage-review__list">
                <li>Structure blocks: {review.pedagogyCoverage.structureBlocks}</li>
                <li>Adaptation blocks: {review.pedagogyCoverage.adaptationBlocks}</li>
                <li>Function blocks: {review.pedagogyCoverage.functionBlocks}</li>
                <li>Exam application blocks: {review.pedagogyCoverage.examBlocks}</li>
              </ul>
              {review.pedagogyCoverage.gaps?.length ? (
                <ul className="teacher-coverage-review__list">
                  {review.pedagogyCoverage.gaps.slice(0, 4).map((g) => (
                    <li key={g} className="teacher-coverage-review__warning">
                      {g}
                    </li>
                  ))}
                </ul>
              ) : null}
            </details>
          ) : null}

          {review.reasoningCoverage?.enabled ? (
            <details className="teacher-coverage-review__section teacher-coverage-review__collapse">
              <summary>
                <h4 style={{ display: "inline", margin: 0 }}>GCSE Reasoning Coverage</h4>
                {" "}
                <span className="teacher-coverage-review__muted">
                  {review.reasoningCoverage.reasoningScorePct}%
                </span>
              </summary>
              <ul className="teacher-coverage-review__list">
                <li>Structure blocks: {review.reasoningCoverage.structureBlocks}</li>
                <li>Adaptation blocks: {review.reasoningCoverage.adaptationBlocks}</li>
                <li>Function blocks: {review.reasoningCoverage.functionBlocks}</li>
                <li>Consequence blocks: {review.reasoningCoverage.consequenceBlocks}</li>
                <li>Exam application blocks: {review.reasoningCoverage.examBlocks}</li>
              </ul>
              {review.reasoningCoverage.conceptReasoning
                ?.filter((c) => c.mentionCount > 0)
                .slice(0, 4)
                .map((c) => (
                  <div key={c.conceptId} style={{ marginTop: 8 }}>
                    <strong>{c.name}</strong>
                    <ul className="teacher-coverage-review__list teacher-coverage-review__muted">
                      {Object.entries(c.steps || {}).map(([step, ok]) => (
                        <li key={step}>
                          {ok ? "✓" : "✗"} {step.replace(/_/g, " ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              {review.reasoningCoverage.gaps?.length ? (
                <ul className="teacher-coverage-review__list">
                  {review.reasoningCoverage.gaps.slice(0, 3).map((g) => (
                    <li key={g.conceptId} className="teacher-coverage-review__warning">
                      <strong>{g.name}</strong>
                      {g.recommendations?.[0] ? ` — ${g.recommendations[0]}` : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </details>
          ) : null}

          {review.interactionAuthority?.enabled ? (
            <details className="teacher-coverage-review__section teacher-coverage-review__collapse">
              <summary>
                <h4 style={{ display: "inline", margin: 0 }}>Interaction authority</h4>
              </summary>
              {review.interactionAuthority.authorizedUsed?.length ? (
                <p className="teacher-coverage-review__muted">
                  Authorised used: {review.interactionAuthority.authorizedUsed.join(", ")}
                </p>
              ) : null}
              {review.interactionAuthority.suggestedReplacements?.length ? (
                <ul className="teacher-coverage-review__list">
                  {review.interactionAuthority.suggestedReplacements.slice(0, 4).map((s) => (
                    <li key={s.blocked} className="teacher-coverage-review__warning">
                      Blocked: {s.blocked.replace(/_/g, " ")} → Replace with: {s.replaceTitle}
                    </li>
                  ))}
                </ul>
              ) : null}
              {review.interactionAuthority.unauthorisedDetected?.length ? (
                <p className="teacher-coverage-review__muted">
                  Unauthorised detected:{" "}
                  {review.interactionAuthority.unauthorisedDetected.join(", ")}
                </p>
              ) : null}
            </details>
          ) : null}

          {review.conceptsTested.length > 0 ? (
            <div className="teacher-coverage-review__section">
              <h4>Concepts tested</h4>
              <ul className="teacher-coverage-review__list">
                {review.conceptsTested.slice(0, 10).map((c) => (
                  <li key={c.id}>
                    {c.name} ({c.testedCount})
                    {c.isCentral ? " · central" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      <button
        type="button"
        className="teacher-coverage-review__refresh"
        disabled={loading}
        onClick={() => void load()}
      >
        {loading ? "Refreshing…" : "Refresh coverage"}
      </button>
    </div>
  );
}
