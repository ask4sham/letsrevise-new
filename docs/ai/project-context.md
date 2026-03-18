# Project Context – LetsRevise

## Overview
LetsRevise is a learning platform with a React frontend and a Node.js/Express backend. It supports lesson creation, revision content, uploads, quizzes, dashboards, and AI-assisted features.

## Stack
- Frontend: React
- Frontend hosting: Netlify
- Backend: Node.js / Express
- Backend hosting: Render
- Database: MongoDB Atlas
- Monitoring: Sentry
- AI: OpenAI API

## Production URLs
- Frontend: https://profound-gumdrop-4c8d83.netlify.app
- Backend: https://letsrevise-new.onrender.com

## Environments
### Frontend
- Uses Netlify environment variables
- Important env vars include:
  - REACT_APP_API_BASE
  - REACT_APP_API_URL
  - REACT_APP_SENTRY_DSN
  - REACT_APP_SENTRY_ENVIRONMENT

### Backend
- Uses Render environment variables
- Important env vars include:
  - MONGO_URI
  - JWT_SECRET
  - OPENAI_API_KEY
  - CORS_ORIGIN
  - FRONTEND_URL
  - SENTRY_DSN
  - SENTRY_ENVIRONMENT

## Architecture Notes
- Frontend should prefer same-origin `/api/...` on Netlify when proxying is configured.
- Avoid direct browser-to-Render API calls when a same-origin proxy path can be used.
- Backend CORS must allow valid frontend origins.
- New uploaded lesson images should be saved as absolute URLs.
- Legacy lesson/template content may still contain relative asset URLs and may require migration.
- Backend serves static assets from routes such as:
  - `/uploads`
  - `/visuals`
  - `/content`

## Media Strategy
### Current
- Media is served from backend-hosted paths and Render-accessible URLs.
- New upload flow should store canonical absolute URLs in markdown/content.

### Long-term
- Consider moving media to CDN/cloud storage (S3, Cloudflare R2, Supabase Storage) later.
- Keep media URL generation abstracted so storage provider can change without large app rewrites.

## Monitoring
- Sentry is configured for frontend and backend.
- Monitoring verification route/page has been added.
- Alerts are configured.

## Important Lessons Learned
- CORS and proxy mismatches caused production issues.
- Frontend-only URL rewriting is fragile.
- Legacy relative image URLs are a source of production inconsistency.
- Nested Mongoose updates require care and may need `markModified`.
