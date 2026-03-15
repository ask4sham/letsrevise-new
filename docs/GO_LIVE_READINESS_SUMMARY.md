# GO-LIVE READINESS SUMMARY

## Blockers

| Item | Description | Action |
|------|--------------|--------|
| **JWT_SECRET_KEY** | Must be set and non-default in production | Generate a strong secret: `openssl rand -base64 32` |
| **MONGODB_URI** | Required for persistence | Set to your MongoDB Atlas or self-hosted URI |
| **OPENAI_API_KEY** | Required for AI features (lesson generation, reteach, etc.) | Set from OpenAI dashboard, or use `DISABLE_OPENAI=1` to run without AI |

---

## Warnings

| Item | Description | Recommendation |
|------|-------------|----------------|
| **File uploads** | Backend uses local `uploads/` directory | For multi-instance, plan migration to S3/cloud storage |
| **CORS_ORIGIN** | Must include your frontend domain(s) | Set `CORS_ORIGIN=https://yourdomain.com` (comma-separated for multiple) |
| **REACT_APP_API_BASE** | Frontend build bakes in API URL | Rebuild frontend with correct backend URL for each environment |
| **Student–teacher link** | Practice content requires StudentTeacherLink | Ensure students are linked to teachers before they can access flashcards/quiz/exam |
| **Demo credentials** | `seedDemoData.js` creates demo-teacher@letsrevise.local / Demo123! | Remove or change in production; do not run seed on prod DB |

---

## Safe-to-Deploy Items

- Canonical mastery (LearningEvidenceEvent)
- Student dashboard and progress page
- Actionable revision flow (flashcards, quiz, exam from progress page)
- Adaptive revision engine (due/overdue, spaced repetition)
- Evidence recording (flashcard_review, quiz_attempt, exam_question_attempt)
- Health endpoints (`/api/health`, `/api/ready`)
- Auth-protected student/teacher/admin routes
- Docker setup (backend, frontend, mongo)

---

## Env Vars Required

### Backend

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `NODE_ENV` | No | development | Use `production` for go-live |
| `PORT` | No | 5000 | Server port |
| `MONGODB_URI` | Yes* | — | Or `MONGO_URI` |
| `JWT_SECRET_KEY` | Yes | — | Or `JWT_SECRET` |
| `OPENAI_API_KEY` | Yes** | — | Or set `DISABLE_OPENAI=1` |
| `CORS_ORIGIN` | Yes (prod) | — | Frontend origin(s), comma-separated |
| `FRONTEND_URL` | No | — | Alternative to CORS_ORIGIN |

\* Backend can start without DB in dev; will log and continue.  
\** Set `DISABLE_OPENAI=1` to skip AI features.

### Frontend (build-time)

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `REACT_APP_API_BASE` | Yes (prod) | — | Backend URL, no trailing slash |
| `REACT_APP_API_URL` | No | — | Alternative name |

---

## Docker Commands

```bash
# Build and run (from project root)
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Seed demo data (after containers are up)
docker-compose exec backend node scripts/seedDemoData.js

# Production build with custom API URL
docker-compose build --build-arg REACT_APP_API_BASE=https://api.yourdomain.com frontend
```

---

## First Deployment Recommendation

1. **Staging first**
   - Deploy to a staging URL (e.g. staging.yourdomain.com).
   - Use a separate MongoDB database (e.g. `letsrevise-staging`).
   - Set `DISABLE_OPENAI=1` initially if you want to validate non-AI flows first.

2. **Env setup**
   ```env
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/letsrevise-staging
   JWT_SECRET_KEY=<generate-with-openssl-rand-base64-32>
   CORS_ORIGIN=https://staging.yourdomain.com
   OPENAI_API_KEY=sk-...  # or DISABLE_OPENAI=1
   ```

3. **Frontend build**
   ```bash
   REACT_APP_API_BASE=https://api.staging.yourdomain.com npm run build
   ```

4. **Smoke test**
   - `GET /api/health` → 200
   - `GET /api/ready` → 200 (Mongo connected)
   - Register → Login → Dashboard → My Progress → Start Flashcards (with linked teacher)

5. **Production**
   - Repeat with production MongoDB and domains.
   - Enable AI if desired.
   - Do not run `seedDemoData.js` on production.
