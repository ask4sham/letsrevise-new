# AI Diagram Generation: Research & Alternatives

**Context:** LetsRevise uses DALL·E 3 for “Try AI” diagram generation. Outcomes are inconsistent: wrong/misspelled labels, style that looks like copied textbook art, and teachers prefer uploading their own images. This doc summarises how other models and products handle educational diagrams and options for improvement.

---

## 1. Why DALL·E 3 Struggles Here

- **Text in images:** DALL·E 3 is known to add or garble text/labels; there is no reliable way to force “no text”. That leads to wrong spellings and extra labels.
- **Prompt rewriting:** The API rewrites prompts (e.g. via GPT) before generation, so fine-grained control (“exactly these organelles, no others”) is limited.
- **Scientific accuracy:** General image models are not built for strict scientific correctness; they often produce plausible-looking but wrong or inconsistent biology (e.g. “loose DNA” vs nucleus, wrong organelles).
- **Copyright/originality:** Asking for “original only” helps but does not guarantee the output won’t resemble existing textbook figures; the training data includes many such images.

**Conclusion:** Relying on DALL·E 3 for accurate, labelled, copyright-safe educational diagrams is not reliable. “Replace diagram” (upload own image) remains the recommended path.

---

## 2. How Other AI / Products Do It

### 2.1 ChatGPT / OpenAI

- **DALL·E 3 (standalone):** Same model we use; same limitations (text, accuracy, style).
- **GPT-4o image generation (ChatGPT UI):** As of 2025, ChatGPT can use GPT-4o’s built-in image generation. It is described as having better prompt adherence and text-in-image quality, but it is not exposed as a separate “diagram” API for third-party apps; it’s part of the conversational product.
- **Takeaway:** For our stack, we only have the Images API (DALL·E 3); we cannot switch to “GPT-4o image generation” as a separate service today.

### 2.2 Education-Specific Platforms

- **Chalkie.ai:** Generates full lessons (slides, activities, images) from a topic + curriculum. Images are part of a broader lesson flow, not a dedicated “diagram API”; they don’t publish how diagram images are produced (model or vendor).
- **Chartable:** Focuses on **structured diagrams** (flowcharts, ERDs, mind maps, etc.) from documents. It turns structure into diagram layout, not freeform “draw a cell”. Good for process/structure, not for biology cell illustrations.
- **ConceptViz (ConceptViz.app):** Markets “AI-powered science diagrams for teachers & scientists” and diagram-generation APIs; site was unavailable at time of research (502). Worth revisiting for science-specific diagram APIs.

### 2.3 Specialised Scientific / Biology Tools

- **AI Figure (Stork):** Aims at **scientific figures**: mechanism diagrams, cell pathways, molecular structures, workflows. Tuned for research-style figures; may offer better control than generic DALL·E for science.
- **CellPAINT:** Builds **molecular/cell illustrations** from experimental data (e.g. PDB). Good for atomic-level accuracy in a specific domain, not a general “draw a simple cell” API.
- **Takeaway:** For “accurate biology cell diagram”, dedicated tools (AI Figure, CellPAINT, or future ConceptViz-style APIs) are closer to the use case than generic text-to-image.

### 2.4 Other Generic Image Models

- **Stable Diffusion (e.g. Replicate, Stability, third-party APIs):** Text-to-image + **negative prompts** (e.g. “no text”) can reduce unwanted text. Quality and prompt adherence vary by model; still not designed for scientific accuracy. Possible future option if we add a second provider.
- **Flux (Black Forest Labs):** Often cited as better prompt adherence and quality than DALL·E 3; available via Replicate, fal.ai, etc. Same caveats: not science-specific, text-in-image can still be wrong. Could be A/B tested vs DALL·E for “Try AI”.
- **Google Imagen:** Similar trade-offs; API availability and terms need checking for our use case.

---

## 3. Non–Image-Model Approaches

- **Diagram-as-code (e.g. Mermaid):** Turn a text description into a **structural** diagram (flowchart, sequence, etc.) and render to SVG/PNG. Labels are correct by construction. **Limitation:** Mermaid is not for “draw a cell with organelles”; it’s for graphs, flows, timelines. Not a drop-in for biology cell diagrams.
- **Template + placeholders:** Provide a small set of **pre-drawn** cell templates (e.g. simple animal cell, plant cell, prokaryotic) as SVG/PNG; teacher picks one and adds labels in our “Place labels” UI. No AI image generation; 100% accurate and copyright-safe if we own or license the templates.
- **Upload-only:** Rely entirely on “Replace diagram” and optional integration with stock/asset libraries (with proper licensing). No AI diagram generation; avoids all AI diagram quality and copyright issues.

---

## 4. Recommended Directions (Short Term)

1. **Keep current behaviour:** “Replace diagram” primary, “Try AI” (DALL·E 3) as optional/experimental, with clear UI that AI output may be wrong and that teachers should upload their own image when accuracy matters. No change to model required.
2. **Trial an alternative model:** Add a second provider (e.g. Flux via Replicate/fal.ai) behind a feature flag or env switch; compare quality and label behaviour vs DALL·E 3 for the same prompts. Keeps “Try AI” but reduces dependence on a single model.
3. **Introduce template diagrams:** Add a small “Diagram library” (e.g. simple cell, plant cell, prokaryotic) as pre-made, unlabeled images; teacher selects one and uses “Place labels”. Gives a reliable, accurate option without AI generation.
4. **Research dedicated APIs:** Re-check ConceptViz, AI Figure (Stork), or similar “science diagram” APIs for licensing and integration cost; evaluate if they can replace or complement “Try AI” for biology.

---

## 5. References (high level)

- SridBench / scientific illustration benchmarks (e.g. arxiv 2505.22126).
- AI Figure (Stork): storkapp.me/aifigure.
- CellPAINT: ccsb.scripps.edu/cellpaint.
- Mermaid: mermaid.js.org (diagram-as-code).
- Chartable: chartable.app (structured diagrams from documents).
- Chalkie: chalkie.ai (AI lessons; diagram method not public).
- OpenAI: DALL·E 3 API, GPT-4o image generation (product blog).
- Flux: Black Forest Labs, Replicate, fal.ai (generic text-to-image).

---

*Last updated from research: 2025. Implemented “Try AI” path uses DALL·E 3; see `backend/services/diagramGeneration.js`.*
