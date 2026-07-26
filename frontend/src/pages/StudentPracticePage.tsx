/**
 * Student Practice — class-linked generation (no Teacher ID in the UI).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PracticeSetBuilder } from "../components/practice/PracticeSetBuilder";
import { PracticeRunner } from "../components/practice/PracticeRunner";
import {
  generatePracticeSet,
  getPracticeGenerationErrorMessage,
  type PracticeSetItem,
} from "../api/practiceSets";
import {
  getMyClassMemberships,
  getStudentInvitationErrorMessage,
  type StudentClassMembershipSummary,
} from "../api/studentClasses";
import { SPEC_DISPLAY_LABELS, type SpecKey } from "../api/taxonomy";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";
import "../components/practice/practiceSetup.css";

const EMPTY_ITEMS_MSG = "No questions found for selected topics/filters.";
const VALID_SPEC_KEYS = Object.keys(SPEC_DISPLAY_LABELS) as SpecKey[];

function isSpecKey(value: string | null | undefined): value is SpecKey {
  return !!value && VALID_SPEC_KEYS.includes(value as SpecKey);
}

function matchSpecFromClass(cls: StudentClassMembershipSummary["class"]): SpecKey | null {
  if (isSpecKey(cls.specKey || "")) return cls.specKey as SpecKey;
  return null;
}

export default function StudentPracticePage() {
  const [searchParams] = useSearchParams();
  const initialSpec = useMemo(() => {
    const fromQuery = searchParams.get("specKey");
    if (isSpecKey(fromQuery)) return fromQuery;
    return getStoredSpecKey();
  }, [searchParams]);

  const [specKey, setSpecKeyState] = useState<SpecKey>(initialSpec);
  const [memberships, setMemberships] = useState<StudentClassMembershipSummary[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [membershipsError, setMembershipsError] = useState<string | null>(null);
  const [selectedMembershipPublicId, setSelectedMembershipPublicId] = useState("");
  const [topicKeys, setTopicKeys] = useState<string[]>(() => {
    const topic = searchParams.get("topicKey") || searchParams.get("topic");
    if (topic && topic.includes(":")) return [topic];
    if (topic && isSpecKey(initialSpec)) return [`${initialSpec}:${topic}`];
    return [];
  });
  const [practiceSetId, setPracticeSetId] = useState<string | null>(null);
  const [items, setItems] = useState<PracticeSetItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const loadMemberships = useCallback(async () => {
    setMembershipsLoading(true);
    setMembershipsError(null);
    try {
      const list = await getMyClassMemberships();
      setMemberships(list);
      setSelectedMembershipPublicId((prev) => {
        if (prev && list.some((m) => m.membershipPublicId === prev)) return prev;
        if (list.length === 1) return list[0].membershipPublicId;
        return "";
      });
    } catch (err) {
      setMembershipsError(
        getStudentInvitationErrorMessage(err, "We could not load your classes.")
      );
      setMemberships([]);
      setSelectedMembershipPublicId("");
    } finally {
      setMembershipsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setMembershipsLoading(true);
      setMembershipsError(null);
      try {
        const list = await getMyClassMemberships();
        if (!active) return;
        setMemberships(list);
        if (list.length === 1) {
          setSelectedMembershipPublicId(list[0].membershipPublicId);
        }
      } catch (err) {
        if (!active) return;
        setMembershipsError(
          getStudentInvitationErrorMessage(err, "We could not load your classes.")
        );
      } finally {
        if (active) setMembershipsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Safe course prefill when the selected class has a canonical specKey.
  useEffect(() => {
    if (!selectedMembershipPublicId) return;
    const membership = memberships.find(
      (m) => m.membershipPublicId === selectedMembershipPublicId
    );
    if (!membership) return;
    const matched = matchSpecFromClass(membership.class);
    if (matched && matched !== specKey) {
      setStoredSpecKey(matched);
      setSpecKeyState(matched);
      setTopicKeys((prev) => prev.filter((tk) => tk.startsWith(`${matched}:`)));
    }
  }, [selectedMembershipPublicId, memberships]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSpecKey = useCallback((v: SpecKey) => {
    setStoredSpecKey(v);
    setSpecKeyState(v);
    setTopicKeys((prev) => prev.filter((tk) => tk.startsWith(`${v}:`)));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedMembershipPublicId || topicKeys.length === 0 || generating) return;
    setError(null);
    setLinkError(null);
    setGenerating(true);
    try {
      const res = await generatePracticeSet({
        membershipPublicId: selectedMembershipPublicId,
        specKey,
        topicKeys,
        limit: 10,
      });
      setPracticeSetId(res.practiceSetId);
      setItems(res.items || []);
      if (!res.items || res.items.length === 0) {
        setError(EMPTY_ITEMS_MSG);
      }
    } catch (e: unknown) {
      const msg = getPracticeGenerationErrorMessage(e);
      setError(msg);
      setLinkError(null);
      setItems([]);
      const code = (e as { data?: { code?: string }; response?: { data?: { code?: string } } })
        ?.data?.code ||
        (e as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (
        code === "MEMBERSHIP_NOT_FOUND" ||
        code === "MEMBERSHIP_REMOVED" ||
        code === "CLASS_ARCHIVED"
      ) {
        await loadMemberships();
      }
    } finally {
      setGenerating(false);
    }
  }, [selectedMembershipPublicId, specKey, topicKeys, generating, loadMemberships]);

  const handleComplete = useCallback(() => {}, []);

  const handleLinkError = useCallback(() => {
    setLinkError("You are no longer linked to this class. Choose another class or view My classes.");
  }, []);

  const startOver = useCallback(() => {
    setPracticeSetId(null);
    setItems([]);
    setError(null);
    setLinkError(null);
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center gap-4 mb-4">
        <Link to="/student-dashboard" className="text-indigo-600 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-semibold">Practice</h1>
      </div>

      <PracticeSetBuilder
        memberships={memberships}
        membershipsLoading={membershipsLoading}
        membershipsError={membershipsError}
        onRetryMemberships={loadMemberships}
        selectedMembershipPublicId={selectedMembershipPublicId}
        onMembershipChange={setSelectedMembershipPublicId}
        specKey={specKey}
        onSpecKeyChange={setSpecKey}
        topicKeys={topicKeys}
        onTopicKeysChange={setTopicKeys}
        onGenerate={handleGenerate}
        generating={generating}
        error={error}
      />

      {linkError && (
        <div className="mt-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
          <p className="text-amber-800">{linkError}</p>
          <Link to="/student/classes" className="text-indigo-600 hover:underline text-sm font-semibold">
            View my classes
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Questions</h2>
            <button
              type="button"
              onClick={startOver}
              className="text-sm text-indigo-600 hover:underline"
            >
              Start another set
            </button>
          </div>
          <PracticeRunner
            items={items}
            teacherId=""
            practiceSetId={practiceSetId}
            onComplete={handleComplete}
            onLinkError={handleLinkError}
          />
        </div>
      )}
    </div>
  );
}
