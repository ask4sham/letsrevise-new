# Phase F — AI Boundaries (Draft)

## Purpose
Define what AI is allowed to do in Phase F, and what is explicitly forbidden.

## Allowed (Phase F)
- Offline experimentation
- Internal utilities
- Non-production prototypes
- No user-facing behavior

## Explicitly Forbidden (Phase F)
- No background jobs
- No queues or cron
- No OpenAI / Anthropic calls in production code
- No curriculum mutation
- No user data access
- No API routes

## Activation Rule
AI behavior may only be introduced after:
- Explicit Phase F → Phase G transition
- Separate approval and review

