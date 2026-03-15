# Final Phase Verification

## A. Actionable Revision Flow

- [ ] Start flashcards from progress page → /practice/flashcards/:topicKey
- [ ] Start quiz from progress page → /practice/quiz/:topicKey
- [ ] Start exam practice from progress page → /practice/exam/:topicKey
- [ ] Evidence recorded (LearningEvidenceEvent)
- [ ] Mastery refreshes after session (dashboard refetch)

## B. Adaptive Revision Flow

- [ ] Review state updates after flashcard/quiz/exam
- [ ] Due/overdue logic (StudentTopicReviewState)
- [ ] Recommendations adjust after activity (adaptive reasons in study plan)

## C. Production Checks

- [ ] Backend boots with env vars (MONGODB_URI, JWT_SECRET_KEY, DISABLE_OPENAI or OPENAI_API_KEY)
- [ ] Frontend builds (`npm run build`)
- [ ] docker-compose up --build
- [ ] GET /api/health returns 200
- [ ] GET /api/ready returns 200 when Mongo connected

## Commands

```bash
# Local backend
cd backend && npm run dev

# Local frontend
cd frontend && npm start

# Docker
docker-compose up --build

# Seed demo data
cd backend && node scripts/seedDemoData.js
```
