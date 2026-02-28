# Teacher docs (served at /docs/)

Place the official Edit Lesson guide PDF here with this **exact** filename (case-sensitive):

**Edit_Lesson_Activities_and_Action_Points_Explained.pdf**

Full path: `frontend/public/docs/Edit_Lesson_Activities_and_Action_Points_Explained.pdf`

If the filename differs by case or underscore, rename it to match exactly. Otherwise the link opens the homepage and HEAD returns 500.

Validate: `curl -I http://localhost:3000/docs/Edit_Lesson_Activities_and_Action_Points_Explained.pdf` → expect `HTTP 200` and `Content-Type: application/pdf`.

**Note:** The file must be the real PDF binary (not the 303-byte stub). Generate it from the Markdown source with: `npm run generate:teacher-guide-pdf` (from repo root). `frontend/public/docs/*.pdf` is tracked with Git LFS (see `.gitattributes`).
