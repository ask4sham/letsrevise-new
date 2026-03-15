# Docker Deployment Guide

## Build and Run Locally

```bash
# From project root
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- Health: http://localhost:5000/api/health
- Ready (Mongo): http://localhost:5000/api/ready

## Environment Variables

Create `.env` in project root (or set in shell):

```env
JWT_SECRET_KEY=your-secret-key
OPENAI_API_KEY=sk-your-key
# Or disable AI:
# DISABLE_OPENAI=1
```

## Production Build (External Mongo)

For production with external MongoDB, omit the mongo service and set:

```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/letsrevise
```

Update CORS_ORIGIN/FRONTEND_URL to your frontend domain.

## Cloud/VPS Deployment

1. Set all required env vars (JWT_SECRET_KEY, OPENAI_API_KEY, MONGODB_URI, CORS_ORIGIN).
2. Build frontend with `REACT_APP_API_BASE` pointing to your backend URL.
3. Use a reverse proxy (nginx/traefik) in front of both containers if needed.
4. Ensure `/api/ready` is used for readiness probes.
