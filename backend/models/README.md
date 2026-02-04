# Backend Models – AI Generation Jobs

## Overview

- The AI Generation Job model persists AI job state in MongoDB.
- It is designed to mirror the AI generation job contracts defined in the contracts layer.

## What exists

- `AiGenerationJob` schema.
- Fields for job type, status, input, output, error details, and lifecycle timestamps.
- Indexes on requester, status, and type for common access patterns.

## What does NOT exist

- No business logic or decision-making in the model.
- No execution or worker orchestration logic.
- No provider or external API integrations.
- No access or entitlement enforcement.

## Usage note

- The model is intended to be used by future routes and workers that operate on AI jobs.
- Schema changes should stay aligned with the AI job contracts to avoid drift.

