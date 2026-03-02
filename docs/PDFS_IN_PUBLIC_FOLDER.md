# Serving PDFs from the frontend public folder

## Overview

- Any PDF placed under **`frontend/public/`** is served as a **static file** by both the frontend dev server and the production build.
- The **URL path mirrors the folder path after `public`**:  
  e.g. `frontend/public/docs/a.pdf` → **`/docs/a.pdf`** (so `http://localhost:3000/docs/a.pdf` in dev).
- If the browser shows the **homepage** (or SPA) instead of the PDF, either:
  - The file does **not** exist at that exact path (check path and filename, including case), or
  - The dev server needs a **restart** so it picks up the new file.

## Windows PowerShell examples

**Copy a PDF into place (e.g. teacher guide):**

```powershell
Copy-Item "C:\path\to\YourFile.pdf" -Destination "frontend\public\docs\Edit_Lesson_Activities_and_Action_Points_Explained.pdf"
```

**Check file size (confirm it’s a real binary, not a stub):**

```powershell
(Get-Item "frontend\public\docs\Edit_Lesson_Activities_and_Action_Points_Explained.pdf").Length
```

Use the same path and filename the app expects (e.g. `/docs/Edit_Lesson_Activities_and_Action_Points_Explained.pdf`). After updating the file, restart the frontend dev server (`npm start` in `frontend/`) if the PDF doesn’t load.

## Past papers and other PDFs

- **PDFs must live in `frontend/public/docs/`** to be served at `/docs/...` (e.g. `/docs/MyPaper.pdf`).
- The UI should link **directly** to `/docs/<filename>.pdf` so the browser opens the PDF (no redirects to the homepage).
- Upload PDF → stored and served from `/docs/…`; ensure the file exists at that path and restart the dev server if needed.
