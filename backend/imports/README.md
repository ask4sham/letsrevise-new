# Sample CSVs for bulk import converters (example / placeholder rows only)

- **past_papers.csv** — Example rows only; keep `pdfUrl`/`pdfMediaId` empty. Required columns: `examBoard`, `level`, `year`, `paperCode`. Optional: `series`, `tier`, `title`, `notes`, `pdfUrl`, `pdfMediaId`. Run: `npm run convert:past-papers-csv -- aqa-gcse-biology ./imports/past_papers.csv`
- **past_paper_questions.csv** — Required: `pastPaperId`, `topicKey`, `question`. Optional: `questionNumber`, `marks`, `markScheme`. Replace `PASTE_PAST_PAPER_ID_HERE` with a real past paper ID from a previous past-papers import. Run: `npm run convert:past-paper-questions-csv -- aqa-gcse-biology ./imports/past_paper_questions.csv`

Output is JSON to stdout (redirect to file or pipe as needed).
