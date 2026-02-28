# Teacher docs (served at /docs/)

Place the official Edit Lesson guide PDF here with this **exact** filename (case-sensitive):

**Edit_Lesson_Activities_and_Action_Points_Explained.pdf**

Full path: `frontend/public/docs/Edit_Lesson_Activities_and_Action_Points_Explained.pdf`

If the filename differs by case or underscore, rename it to match exactly. Otherwise the link opens the homepage and HEAD returns 500.

Validate: `curl -I http://localhost:3000/docs/Edit_Lesson_Activities_and_Action_Points_Explained.pdf` → expect `HTTP 200` and `Content-Type: application/pdf`.

**Note:** The canonical PDF is a hand-authored binary (grid-table version). Do not overwrite it from Markdown. `EDIT_LESSON_ACTIVITIES_GUIDE.md` remains an editable source for reference only. `frontend/public/docs/*.pdf` is tracked with Git LFS (see `.gitattributes`).
