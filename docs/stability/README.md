# Stability Engineering (Phase 4)

**Mission:** No new user-facing features. Reduce risk. Protect the production baseline.

**Production baseline tag:** `production-table-parts-enabled-v1`

## Principles

- No feature work, UI redesign, architecture rewrites, or large refactors  
- Fix only confirmed defects  
- Every fix ships with a regression test where practical  
- One concern per commit  

## Tooling

| Phase | Command | Purpose |
|-------|---------|---------|
| 4A | `npm run test:golden` | Golden unit/integration regression paths |
| 4B | `npm run validate:production-build` | Bundle + feature-flag + API report |
| 4C | `npm run test:smoke` | Playwright browser smoke |
| 4D | `npm run stability:dashboard` | Aggregated release health report |
| 4E | [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md) | Debt register (document only) |

## Typical pre-release sequence

```bash
npm run test:golden
npm run build --prefix frontend   # with REACT_APP_TABLE_PARTS_ENABLED=true for prod-like
npm run validate:production-build -- --build frontend/build
# optional against live:
npm run validate:production-build -- --url https://letsrevise.com
npm run test:smoke                # needs SMOKE_BASE_URL (default http://localhost:3000)
npm run stability:dashboard
```

## Documents

- [GOLDEN_PATHS.md](./GOLDEN_PATHS.md) — journey matrix  
- [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md) — deferred work  
