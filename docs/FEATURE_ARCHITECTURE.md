# ScopeProof — feature-first frontend architecture (RC1)

This document updates the earlier UI refactor notes to describe [`scopeproof-codegeist-rc1`](https://github.com/topassky3/scopeproof/tree/scopeproof-codegeist-rc1). The Forge Custom UI uses React 18, TypeScript, Vite and shared CSS.

## Structure and responsibilities

```text
src/
  main.tsx                       React bootstrap
  app/                           Jira/preview coordination and editor context
  shared/                        Shared UI, contracts, styles and intelligence
  features/
    overview/                    Project status and selected review diagnosis
    reviews/                     Review workspace and decision presentation
    requirements/                Requirement versions and coverage
    evidence/                    Evidence records and explicit evidence targets
    history/                     Historical events and decisions
    reports/                     JSON and PDF snapshot reports
    settings/                    Read-only application policy
  domain.js                      Domain rules and transitions
  change-impact.js               Approval invalidation diagnosis
  revalidation-planner.js        Recovery operations
  review-integrity.js            Record integrity checks
  review-read.js                 Safe read/consumer boundary
  index.js                       Authorized Forge resolver
  review-store.js                Conditional review persistence
  ces-adapter.js                 CES operations and legacy reads
```

## Design rules

1. Shared layout, types, components and application-wide styles belong in `src/shared/`. Keep feature-specific code in `src/features/<name>/`.
2. `src/app/` coordinates data retrieval, command dispatch, browser preview behavior and editor context. Feature components receive data and callbacks rather than performing unauthorized storage access.
3. Preserve the distinction between a historical test result and its current applicability to a requirement version.
4. Use common integrity, diagnostic and decision projections across the relevant views. Full coverage is not a substitute for a new explicit approval.
5. The evidence editor requires an explicit requirement target. Its issue, revision, version and description are validated against the loaded review. Selecting a historical evidence row must not silently select a target for a new evidence record.
6. Filtered requirement and evidence detail panels follow visible rows; hidden selections must not drive the displayed detail.
7. The Forge-hosted UI must not imitate the global Jira header. Local sample-data preview remains labeled and separate from real Jira data.
8. Keep changes to approval rules separate from cosmetic work and cover them with domain and cross-view tests.

## Shared behavior in RC1

- The overview, reviews and requirements flows distinguish initial approval, revalidation, rejection and approved states.
- History preserves earlier evidence and decisions without presenting historical results as current coverage.
- PDF and JSON exports use the selected loaded review revision and common diagnostic semantics, subject to publication integrity guards.
- Responsive page headers and modal constraints are included in the candidate CSS. The frontend has been functionally tested in Jira; this does not claim exhaustive device or accessibility coverage.
- The optional standalone Django and Next.js paths remain separate from the Forge submission runtime.

## Verification

```powershell
npm ci
npm run check
npm run dev
```

The RC1 core suite passed 287 tests and its production build succeeded. Local preview behavior is not proof of a deployed Jira permission or CES transaction. See [architecture](ARCHITECTURE.md) for server-side boundaries and the [README](../README.md) for acceptance results.

The images under `docs/design/` are design references, not necessarily screenshots of the deployed RC1 UI. Avoid introducing new dependencies or substantial visual changes solely for submission unless a verified blocking issue warrants them.
