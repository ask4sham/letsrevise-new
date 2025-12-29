# Deployment Notes - 2025-12-29

## Backend
- Entry: backend/server.js
- Port: PORT from backend/.env (defaults to 5000)
- Static content:
  - /uploads  ? backend/uploads
  - /content  ? static-site/content
  - /        ? static-site/website (index.html)

## Frontend
- Dev:
  - cd frontend
  - npm start
- Production:
  - cd frontend
  - npm run build
  - Output: frontend/build

## API Base URL (frontend)
- Primary env var: REACT_APP_API_URL
  - Example for local: http://localhost:5000
  - Example for production: https://your-backend-domain.com
- If REACT_APP_API_URL is not set, frontend falls back to:
  - http://localhost:5000/api (via src/services/api.ts)

## Environment Variables

### Backend (.env)
- PORT=5000
- MONGODB_URI=...
- JWT_SECRET=...
- (plus any others you already use)

### Frontend (.env.local or host env)
- REACT_APP_SUPABASE_URL=...
- REACT_APP_SUPABASE_ANON_KEY=...
- REACT_APP_API_URL=...   # set this in production

## Typical Production Setup (high level)
- Host backend (Node) on a server platform (e.g. Render / Railway / VPS)
  - Run: node backend/server.js (or via a process manager like PM2)
- Host frontend build (frontend/build) on:
  - Same server (served by nginx/Apache/Node static) OR
  - Static hosting (e.g. Netlify / Vercel) with a proxy rule:
    - All /api/* ? your backend URL

## Quick health URLs
- Backend health:   /api/health
- Quizzes:          /api/quizzes
- Content tree:     /api/content-tree?stage=ks3
