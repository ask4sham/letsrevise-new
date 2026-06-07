export function explanationsAreDuplicate(explanation = "", answer = ""): boolean {
  const e = String(explanation || "").trim().toLowerCase();
  const a = String(answer || "").trim().toLowerCase();
  return Boolean(a && e && e === a);
}

export function deriveCheckpointWhyExplanation(
  correctAnswer = "",
  meta: { topic?: string; title?: string } = {}
): string {
  const ans = String(correctAnswer || "").trim();
  if (!ans) return "";

  const hay = `${meta.topic || ""} ${meta.title || ""} ${ans}`.toLowerCase();

  if (/long axon|myelin/i.test(hay)) {
    return "This gains marks because it links neurone structure (long axon and myelin sheath) to function (faster transmission of electrical impulses), which is the key GCSE Biology principle being tested.";
  }
  if (/motor neurone/i.test(ans)) {
    return "This is correct because effectors are muscles or glands that produce the response. Sensory neurones carry impulses in the opposite direction.";
  }
  if (/sensory neurone|receptors to the cns|from receptors/i.test(hay)) {
    return "A sensory neurone carries electrical impulses from receptors to the CNS, so the brain or spinal cord can process the stimulus.";
  }
  if (/electrical impulses travel from receptors/i.test(ans)) {
    return "GCSE answers must name neurone types, state impulse direction, and use electrical impulse — not vague 'messages'.";
  }
  if (/spinal cord.*effector|effector.*muscle|effector.*gland/i.test(hay)) {
    return "This gains marks because it names the correct neurone type and links structure to function in the nervous-system pathway.";
  }

  return "This gains marks because it states the correct GCSE Biology point and links process to function — not just restating the answer.";
}

export function resolveImportedCheckpointExplanation(
  explanation = "",
  correctAnswer = "",
  meta: { topic?: string; title?: string } = {}
): string {
  const expl = String(explanation || "").trim();
  const ans = String(correctAnswer || "").trim();
  if (!expl || explanationsAreDuplicate(expl, ans)) {
    return deriveCheckpointWhyExplanation(ans, meta);
  }
  return expl;
}
