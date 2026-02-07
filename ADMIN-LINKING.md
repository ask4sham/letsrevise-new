# LetsRevise – Admin Parent ↔ Child Linking

This document defines the **official workflow** for linking students to parents.
It exists to eliminate manual Mongo edits and prevent “No child profiles linked” confusion.

---

## Problem this solves

- Parent dashboard correctly shows “No child profiles linked”
- But ops needs a **safe, repeatable** way to fix data state
- Manual DB edits are error-prone and non-auditable

---

## Data model (Mongo)

- Parent user document contains:
  - `children: ObjectId[]` (references student `_id`s)
- Student documents are unchanged

---

## Required admin-only API endpoints

> All routes must be protected by admin auth middleware.

### Link child to parent
