# Quiz Bank CSV formats

Topic Quiz Bank and Topic Assessment Bank support bulk import via CSV in two canonical formats.

## MCQ CSV template

Columns (required):

- `topicKey` – topic key for the question (e.g. `diffusion`, `cell-structure`)
- `question` – question text
- `choiceA` … `choiceF` – 2–6 choices (use choiceA, choiceB, … as needed)
- `correctChoice` – letter of correct answer: **A**, **B**, **C**, **D**, **E**, or **F**
- `explanation` – optional explanation shown after answer

```csv
topicKey,question,choiceA,choiceB,choiceC,choiceD,correctChoice,explanation
diffusion,What is diffusion?,Movement of particles,No movement,Only in liquids,Only in gases,A,Net movement from high to low concentration
cell-structure,What is the function of the nucleus?,Contains DNA,Produces energy,Stores water,Supports the cell,A,Contains genetic material
```

## Short Answer CSV template

Columns (required):

- `topicKey` – topic key for the question
- `question` – question text
- `acceptableAnswers` – pipe-separated list of acceptable answers: `answer1|answer2|answer3`
- `explanation` – optional explanation

```csv
topicKey,question,acceptableAnswers,explanation
diffusion,Name the process by which particles move from high to low concentration.,diffusion|the diffusion,Diffusion is the net movement down a concentration gradient.
cell-structure,Name the organelle that contains genetic material.,nucleus|the nucleus,The nucleus contains DNA.
```

## Usage

1. In **Topic Quiz Bank** (or **Topic Assessment Bank**), select a **Topic** and set **Type** to **MCQ** or **Short Answer**.
2. Choose **Format**: CSV.
3. Paste CSV that matches the template for the selected type (or use the inline placeholder as a guide).
4. Click **Preview**, then **Import (Create Drafts)** when valid.

If **Type** is not set, the system defaults to **MCQ** (backwards compatible).
