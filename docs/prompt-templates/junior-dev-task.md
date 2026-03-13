# Junior Dev one-shot task template

Paste this into Cursor and fill in `<DESCRIBE CHANGE>`.

---

**TASK:**  
Implement the following change in this repo, PR-ready and CI-passing:

<DESCRIBE CHANGE>

**CONSTRAINTS:**

- Follow [docs/cursor-system-prompt-taxonomy.md](../cursor-system-prompt-taxonomy.md) and [docs/cursor-system-prompt-junior-dev.md](../cursor-system-prompt-junior-dev.md).
- Do not refactor unrelated code.
- Preserve topicKey namespacing (writes namespaced; reads queryCandidates).
- Ensure `backend/scripts/validateTaxonomies.js` passes.
- Ensure backend tests pass.

**DELIVERABLES:**

1) Code changes with exact files edited/created  
2) Any required tests added/updated  
3) Verification commands (copy/paste)  
4) Short PR description  

**IF YOU NEED CONTEXT:**

- Ask for the current contents of the specific files you must patch line-accurately (only those).
- Otherwise, proceed with best-effort changes consistent with existing patterns.

**OUTPUT (use this exact format):**

- **A)** Summary  
- **B)** Files  
- **C)** Patches / full files  
- **D)** Verification  
- **E)** PR description  
