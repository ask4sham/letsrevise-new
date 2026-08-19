import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCatalogueAvailability, getPublicCatalogue } from "../api/catalogueAvailability";
import type { CatalogueTreeNode } from "../api/catalogueAvailability";
import { getAxiosErrorMessage } from "../utils/apiErrorMessage";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  BrowseStageKey,
  backToMyStageLessonsLabel,
  buildBrowseCourseOptions,
  buildBrowsePath,
  buildBrowseSubjectOptions,
  buildBrowseTopicOptions,
  buildExplorePath,
  courseHasTierStep,
  courseTierLabel,
  findBrowseLevelNode,
  formatCatalogueCourseDisplayLabel,
  formatComingSoonLabel,
  isCatalogueNodeComingSoon,
  parseBrowseStageParam,
  resolveEffectiveBrowseStageKey,
  resolveProfileStageKey,
  stageLabel,
} from "../utils/catalogueBrowseOptions";

type Stage = BrowseStageKey;

function StagePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        border: "1px solid #2a2a2a",
        background: active ? "#111" : "#fff",
        color: active ? "#fff" : "#111",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function Card({
  title,
  subtitle,
  onClick,
  disabled,
}: {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const isDisabled = !!disabled || !onClick;

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      style={{
        width: "100%",
        textAlign: "left",
        padding: 14,
        borderRadius: 14,
        border: "1px solid #e8e8e8",
        background: "#fff",
        cursor: isDisabled ? "not-allowed" : "pointer",
        boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
        opacity: isDisabled ? 0.55 : 1,
      }}
    >
      <div style={{ fontWeight: 850, fontSize: 16 }}>{title}</div>
      {subtitle ? (
        <div style={{ marginTop: 6, color: "#555", fontSize: 13 }}>{subtitle}</div>
      ) : null}
    </button>
  );
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlBrowseStage = parseBrowseStageParam(searchParams.get("browseStage"));
  const { user, token } = useCurrentUser({ watchLocation: true });
  const isStudent = (user?.userType || user?.type || "").toString().toLowerCase() === "student";

  const [profileStageKey, setProfileStageKey] = useState<BrowseStageKey>("");
  const [catalogueLevels, setCatalogueLevels] = useState<CatalogueTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedTier, setSelectedTier] = useState("");

  const stage = useMemo(
    () => resolveEffectiveBrowseStageKey(profileStageKey, urlBrowseStage),
    [profileStageKey, urlBrowseStage]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        if (token && isStudent) {
          const data = await getCatalogueAvailability();
          if (cancelled) return;
          setCatalogueLevels(data.publicTree?.levels || []);
          setProfileStageKey(
            resolveProfileStageKey(
              data.profileStage,
              (user as any)?.stageKey || user?.stage || user?.level
            ) as BrowseStageKey
          );
          return;
        }
        const data = await getPublicCatalogue();
        if (cancelled) return;
        setCatalogueLevels(data.publicTree?.levels || []);
      } catch (err) {
        if (!cancelled) {
          setError(getAxiosErrorMessage(err, "Could not load catalogue."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isStudent, user?.stage, user?.level, (user as any)?.stageKey]);

  useEffect(() => {
    setSelectedSubject("");
    setSelectedCourse("");
    setSelectedTier("");
  }, [stage]);

  const levelNode = useMemo(() => findBrowseLevelNode(catalogueLevels, stage), [catalogueLevels, stage]);

  const stageComingSoon = useMemo(
    () => !levelNode || isCatalogueNodeComingSoon(levelNode.publicStatus),
    [levelNode]
  );

  const subjectOptions = useMemo(() => buildBrowseSubjectOptions(levelNode), [levelNode]);

  const courseOptions = useMemo(
    () => buildBrowseCourseOptions(levelNode, selectedSubject),
    [levelNode, selectedSubject]
  );

  const selectedCourseSpecKey = useMemo(() => {
    const match = courseOptions.find((c) => c.value === selectedCourse);
    return match?.specKey || selectedCourse;
  }, [courseOptions, selectedCourse]);

  const topicOptions = useMemo(
    () => buildBrowseTopicOptions(levelNode, selectedSubject, selectedCourseSpecKey),
    [levelNode, selectedSubject, selectedCourseSpecKey]
  );

  const selectedSubjectComingSoon = useMemo(() => {
    const match = subjectOptions.find((s) => s.value === selectedSubject);
    return match ? isCatalogueNodeComingSoon(match.publicStatus) : false;
  }, [subjectOptions, selectedSubject]);

  const tierRequired = useMemo(
    () => courseHasTierStep(selectedCourseSpecKey),
    [selectedCourseSpecKey]
  );

  function handleStageChange(nextStage: Stage) {
    navigate(buildExplorePath(profileStageKey, nextStage));
  }

  function returnToProfileStage() {
    navigate(buildExplorePath(profileStageKey, profileStageKey));
  }

  function openBrowseTopic(topicLabel: string) {
    navigate(buildBrowsePath(profileStageKey, stage, { subject: selectedSubject, topic: topicLabel }));
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>Explore</div>
          <div style={{ color: "#555", marginTop: 4 }}>Browse subjects and topics by stage.</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StagePill label="KS3" active={stage === "ks3"} onClick={() => handleStageChange("ks3")} />
          <StagePill label="GCSE" active={stage === "gcse"} onClick={() => handleStageChange("gcse")} />
          <StagePill
            label="A-Level"
            active={stage === "a-level"}
            onClick={() => handleStageChange("a-level")}
          />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        {loading ? <div style={{ padding: 12 }}>Loading…</div> : null}
        {error ? (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: "#fff3f3",
              border: "1px solid #ffd0d0",
            }}
          >
            <b>Error:</b> {error}
          </div>
        ) : null}
      </div>

      {stageComingSoon ? (
        <div
          style={{
            marginTop: 24,
            padding: "20px 22px",
            borderRadius: 12,
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            color: "#92400e",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>
            {formatComingSoonLabel(stageLabel(stage) || stage, "coming_soon")}
          </div>
          {profileStageKey ? (
            <button
              type="button"
              onClick={returnToProfileStage}
              style={{
                marginTop: 14,
                padding: "10px 18px",
                borderRadius: 999,
                border: "none",
                background: "#111827",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {backToMyStageLessonsLabel(profileStageKey)}
            </button>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>1) Choose Subject</div>
            <div style={{ display: "grid", gap: 10 }}>
              {subjectOptions.map((subject) => (
                <Card
                  key={subject.value}
                  title={subject.label}
                  subtitle={
                    isCatalogueNodeComingSoon(subject.publicStatus) ? "Coming soon" : "Choose course"
                  }
                  onClick={() => {
                    setSelectedSubject(subject.value);
                    setSelectedCourse("");
                    setSelectedTier("");
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>2) Choose Course</div>
            {!selectedSubject ? (
              <div style={{ color: "#666" }}>Pick a subject first.</div>
            ) : selectedSubjectComingSoon ? (
              <div
                style={{
                  padding: "20px 18px",
                  borderRadius: 12,
                  background: "#fffbeb",
                  border: "1px solid #fcd34d",
                  color: "#92400e",
                }}
              >
                <div style={{ fontWeight: 800 }}>
                  {formatComingSoonLabel(selectedSubject, "coming_soon")}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSubject("")}
                  style={{
                    marginTop: 14,
                    padding: "10px 18px",
                    borderRadius: 999,
                    border: "none",
                    background: "#111827",
                    color: "white",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Browse other subjects
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {courseOptions.map((course) => (
                  <Card
                    key={course.value}
                    title={course.label}
                    subtitle={
                      isCatalogueNodeComingSoon(course.publicStatus)
                        ? "Coming soon"
                        : formatCatalogueCourseDisplayLabel(course.label, course.specKey)
                    }
                    disabled={isCatalogueNodeComingSoon(course.publicStatus)}
                    onClick={() => {
                      setSelectedCourse(course.value);
                      setSelectedTier(courseTierLabel(course.specKey));
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>
              3) {tierRequired ? "Choose Tier → Topics" : "Topics"}
            </div>
            {!selectedCourse ? (
              <div style={{ color: "#666" }}>Pick a course first.</div>
            ) : tierRequired ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {(["foundation", "higher"] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setSelectedTier(tier)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid #e8e8e8",
                        background: selectedTier === tier ? "#111" : "#fff",
                        color: selectedTier === tier ? "#fff" : "#111",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </button>
                  ))}
                </div>
                {!selectedTier ? (
                  <div style={{ color: "#666" }}>Select Foundation or Higher.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {topicOptions.map((topic) => (
                      <Card
                        key={topic.value}
                        title={topic.label}
                        subtitle={
                          isCatalogueNodeComingSoon(topic.publicStatus)
                            ? "Coming soon"
                            : "Browse lessons"
                        }
                        disabled={isCatalogueNodeComingSoon(topic.publicStatus)}
                        onClick={() => openBrowseTopic(topic.value)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {topicOptions.map((topic) => (
                  <Card
                    key={topic.value}
                    title={topic.label}
                    subtitle={
                      isCatalogueNodeComingSoon(topic.publicStatus)
                        ? "Coming soon"
                        : "Browse lessons"
                    }
                    disabled={isCatalogueNodeComingSoon(topic.publicStatus)}
                    onClick={() => openBrowseTopic(topic.value)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
