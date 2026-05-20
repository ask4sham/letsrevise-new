# Spec map (pilot P0) — AQA GCSE Biology — Infection and response

**Document type:** Authoring reference only — **not** wired to code, schemas, or the live app.  
**Exam:** AQA GCSE Biology (8461) — **Topic 4: Infection and response** (also aligns closely with Combined Science: Biology Trilogy where this topic appears as **4.3**).  
**Use:** When writing lessons or tagging blocks/questions, copy **spec point IDs** and **statements** into your metadata plan (`docs/aqa-spec-ao-tagging-plan.md`) until tooling exists.

> **Numbering note:** AQA publishes precise **specification references** (e.g. **4.3.1.3**). The IDs below follow that style. If your school uses a different numbering sheet, treat these as **logical keys** and remap once official mapping is imported.

---

## 1. Topic overview

**Infection and response** is about how **pathogens** cause disease, how the **body defends itself**, how we **prevent and treat** infection (vaccination, antibiotics, drug development), and (in full Biology GCSE) how **monoclonal antibodies** and **plant disease** fit in.

**Why it matters for lessons:** Strong lessons move from **names and definitions** (AO1) → **explain in context** (AO2) → **interpret evidence / evaluate claims** (AO3), e.g. antibiotic resistance, vaccine programmes, clinical trials.

**Typical lesson arc (suggested):**

1. Pathogens & transmission → 2. First and specific defences → 3. Vaccination → 4. Antibiotics & resistance → 5. Drug development / monoclonal antibodies (where in spec).

---

## 2. Key AQA spec areas (Infection and response)

| Spec area (summary) | What students must handle |
|---------------------|-----------------------------|
| **Pathogens & communicable disease** | Types of pathogen; how infections spread; examples of diseases |
| **Human defence systems** | Barriers, non-specific responses, specific immune response (overview level at GCSE) |
| **Vaccination** | How vaccines work; herd immunity; pros/limitations in context |
| **Antibiotics & painkillers** | Bacterial vs viral; misuse and resistance; painkillers do not kill pathogens |
| **Drug development** | Stages of testing; ethics and risk; data from trials |
| **Monoclonal antibodies** (Biology GCSE) | Idea of specificity; typical uses (e.g. diagnosis / treatment — keep to spec depth) |
| **Plant disease** (Biology GCSE) | Detection / identification at overview level |

---

## 3. Proposed spec point IDs

Use as **stable keys** in docs and (later) in `specPoint` fields. Format: `AQA-BIO-IR-<section>-<n>` *or* mirror AQA numbering directly — both shown.

| Proposed ID (internal) | AQA-style ref (target) | Topic (short) |
|------------------------|-------------------------|---------------|
| `AQA-BIO-IR-4.3.1.1` | **4.3.1.1** | Pathogens & communicable diseases |
| `AQA-BIO-IR-4.3.1.2` | **4.3.1.2** | Viruses & bacteria (and disease examples) |
| `AQA-BIO-IR-4.3.1.3` | **4.3.1.3** | Protists & fungi (as pathogens) |
| `AQA-BIO-IR-4.3.1.4` | **4.3.1.4** | Direct & indirect transmission |
| `AQA-BIO-IR-4.3.1.5` | **4.3.1.5** | Body defences (non-specific & specific overview) |
| `AQA-BIO-IR-4.3.1.6` | **4.3.1.6** | Vaccination |
| `AQA-BIO-IR-4.3.1.7` | **4.3.1.7** | Antibiotics & painkillers |
| `AQA-BIO-IR-4.3.1.8` | **4.3.1.8** | Discovery & development of drugs |
| `AQA-BIO-IR-4.3.1.9` | **4.3.1.9** | Monoclonal antibodies |
| `AQA-BIO-IR-4.3.1.10` | **4.3.1.10** | Plant diseases (Biology GCSE) |

If you already use **namespaced topic keys** elsewhere (e.g. `aqa-gcse-biology:…`), you can prefix these IDs with that namespace in implementation — **not required for this pilot doc**.

---

## 4. Plain-English student-friendly spec statements

One line each — suitable for “learning outcome” lines on slides or block intros.

| Spec point ID | Student-friendly statement |
|---------------|---------------------------|
| `…-4.3.1.1` | I can say what a **pathogen** is and give examples of **communicable diseases**. |
| `…-4.3.1.2` | I can explain differences between **viruses and bacteria** and how they make us ill. |
| `…-4.3.1.3` | I know **protists and fungi** can also cause disease. |
| `…-4.3.1.4` | I can describe **ways infections spread** (direct and indirect). |
| `…-4.3.1.5` | I can describe **how the body defends itself** before and during a specific immune response. |
| `…-4.3.1.6` | I can explain **how vaccination** reduces disease spread and what **herd immunity** means. |
| `…-4.3.1.7` | I can explain **antibiotics vs painkillers** and why **antibiotic resistance** is a problem. |
| `…-4.3.1.8` | I can outline **how new drugs are tested** and why testing matters for safety. |
| `…-4.3.1.9` | I can describe **monoclonal antibodies** as targeted molecules and give **uses** in context. |
| `…-4.3.1.10` | I can describe **how plant diseases** are detected/identified at an overview level. |

---

## 5. Suggested AO mapping (AQA GCSE style)

Use this when tagging **blocks** or **questions**. It is a **guide**, not a mark scheme.

| When the student is mainly… | Typical AO | Examples in this topic |
|----------------------------|------------|-------------------------|
| **Stating, naming, defining, labelling, recalling** | **AO1** | Name pathogens; list defences; define vaccine; recall stages of drug testing in order |
| **Explaining a process in context, using a model, transferring knowledge to a scenario** | **AO2** | Explain transmission in a given situation; explain how a vaccine reduces infection; explain why antibiotics don’t work on viruses |
| **Analysing data, comparing methods, evaluating risk/benefit, suggesting improvements** | **AO3** | Interpret graphs on antibiotic use; evaluate claims about a vaccine programme; compare strategies to reduce spread |

**Practical rule of thumb for lesson blocks:**

- **Hook / key idea (definitions)** → mostly **AO1**  
- **Worked explanation / apply to scenario** → **AO2**  
- **Discuss / exam-style “suggest / evaluate / compare using information”** → **AO3**

---

## 6. Example lesson / block tags

Assume lesson defaults: `examBoard: AQA`, `subject: Biology`, `examLevel: GCSE`.

### Example A — “Pathogens and transmission” page

| Block (illustrative) | `specPoint` | `assessmentObjective` | `commandWord` | `marks` | `difficulty` |
|----------------------|-------------|------------------------|-----------------|--------|----------------|
| Key idea: what is a pathogen? | `AQA-BIO-IR-4.3.1.1` | AO1 | state | 2 | low |
| Explanation: spread of infection | `AQA-BIO-IR-4.3.1.4` | AO2 | explain | 4 | medium |
| Quick check MCQ | `AQA-BIO-IR-4.3.1.2` | AO1 | choose | 1 | low |

### Example B — “Vaccination” page

| Block | `specPoint` | `assessmentObjective` | `commandWord` | `marks` | `difficulty` |
|-------|-------------|------------------------|-----------------|--------|----------------|
| Diagram + caption: immune memory | `AQA-BIO-IR-4.3.1.6` | AO2 | describe | 3 | medium |
| Exam-style prompt (data on uptake) | `AQA-BIO-IR-4.3.1.6` | AO3 | evaluate | 6 | high |

---

## 7. Example question tags

Use the same shape as block tags (`specPoint`, `assessmentObjective`, `commandWord`, `marks`, `difficulty`).

**Q1 (MCQ)**  
- Stem: “Which is a bacterial disease?”  
- Tags: `specPoint: AQA-BIO-IR-4.3.1.2`, `AO: AO1`, `commandWord: identify`, `marks: 1`, `difficulty: low`

**Q2 (Short)**  
- Stem: “Explain one way a communicable disease can be transmitted indirectly.”  
- Tags: `specPoint: AQA-BIO-IR-4.3.1.4`, `AO: AO2`, `commandWord: explain`, `marks: 3`, `difficulty: medium`

**Q3 (Extended / data)**  
- Stem: “The graph shows antibiotic prescriptions over time. Describe the trend and discuss one consequence for treating bacterial infections.”  
- Tags: `specPoint: AQA-BIO-IR-4.3.1.7`, `AO: AO3`, `commandWord: discuss`, `marks: 6`, `difficulty: high`

---

## 8. Notes on future implementation

1. **Import path:** This file can become a **CSV/JSON seed** that populates a taxonomy UI; keep **IDs stable** even if display labels change.  
2. **Trilogy vs Biology:** Confirm which sub-points your cohort uses; split maps if Combined Science trims content (duplicate IDs with `examLevel` or `qualification` metadata later).  
3. **Command words:** Align picklists to AQA **AO + command word** conventions used in your department.  
4. **Mark tariffs:** Use marks as **lesson design hints** first; only later tie to automated scoring where question types support it.  
5. **Link to tagging plan:** See `docs/aqa-spec-ao-tagging-plan.md` for where metadata could live on blocks and phased rollout (P0–P5).

---

*P0 pilot spec map — documentation only — AQA GCSE Biology, Infection and response.*
