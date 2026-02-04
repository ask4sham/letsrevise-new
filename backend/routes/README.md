# Backend Routes – AI Generation Jobs

## Overview

- AI Generation Jobs routes are mounted under the API but currently contain no handlers.
- Their purpose is to establish stable namespaces for future AI job features.

## Public routes

- **Path**: `/api/ai-generation-jobs`
- Intended for student/teacher job creation and inspection.
- No subscription or entitlement enforcement is implemented yet.

## Admin routes

- **Path**: `/api/admin/ai-generation-jobs`
- Intended for oversight and moderation of AI generation jobs.
- Admin access follows existing admin bypass patterns.

## Current status

- Placeholder routers only; there is no job creation, listing, or mutation logic.
- No background processing or execution of AI jobs is implemented at this stage.

