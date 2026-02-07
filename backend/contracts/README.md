# AI Generation Jobs – Contracts

## Purpose

- Define shared data shapes and rules for AI generation jobs across backend and frontend.
- Pure data only: no execution logic, no validation, and no side effects.

## What’s included

- **Job contract**: version, payload shape, and enums for job types and statuses.
- **Policy**: ownership, visibility, and lifecycle rules as data.
- **Type specs**: per-job input/output expectations for different job types.
- **Error codes**: canonical error semantics for AI generation job failures.

## What’s not included

- No execution logic or orchestration of jobs.
- No persistence logic (models handle storage separately).
- No provider integrations (e.g. LLMs or external APIs).
- No access or entitlement enforcement.

## Usage note

- These contracts are consumed by models, routes, workers, and UI as a single source of truth.
- Any changes must be backward-compatible or explicitly versioned via the job contract version field.

