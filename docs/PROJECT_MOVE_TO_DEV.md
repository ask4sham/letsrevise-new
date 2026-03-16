# LetsRevise – Project Move to C:\dev

**Date:** 2026-03-15  
**From:** `C:\Users\ask4s\OneDrive\Desktop\letsrevise-new`  
**To:** `C:\dev\letsrevise-new`

## Summary

Project was **copied** (not moved) to `C:\dev\letsrevise-new` because the original folder was in use (Cursor/OneDrive). The copy excluded `node_modules` and `build`. The `.git` folder was copied separately to preserve version history.

## What Was Done

1. **Created** `C:\dev`
2. **Copied** project via robocopy (excluding node_modules, build)
3. **Copied** `.git` folder to preserve version history
4. **Verified** structure: backend, frontend, docker-compose.yml, docs all present
5. **Updated** hardcoded paths in `backend/services/videoGenerator/outputs/microscopy-magnification-calculations.py` (4 occurrences: OneDrive path → C:\dev\letsrevise-new)
6. **Installed** dependencies: `npm install` in backend and frontend
7. **Docker** build started from new path

## Paths Updated

| File | Change |
|------|--------|
| `backend/services/videoGenerator/outputs/microscopy-magnification-calculations.py` | `C:\Users\ask4s\OneDrive\Desktop\letsrevise-new` → `C:\dev\letsrevise-new` |

**Note:** `partial_movie_file_list.txt` files in media/videos contain old paths; these are Manim-generated and will be regenerated if you re-run the video pipeline.

## Next Steps (Manual)

1. **Close Cursor** and reopen the project from `C:\dev\letsrevise-new`
2. **Delete the old project** (after verifying the new one works):
   ```
   C:\Users\ask4s\OneDrive\Desktop\letsrevise-new
   ```
3. **Copy .env files** from old location if you had custom env:
   - `backend/.env`
   - `frontend/.env.development` (already created with REACT_APP_API_BASE=http://localhost:5000)

## Docker Commands (from new path)

```powershell
cd C:\dev\letsrevise-new
docker compose down
docker system prune -f
docker compose build --no-cache
docker compose up -d
docker compose ps
```

## Verify Application

- Homepage: http://localhost:3000
- Login: http://localhost:3000/login
- Teacher dashboard: http://localhost:3000/teacher-dashboard (after login as teacher)
