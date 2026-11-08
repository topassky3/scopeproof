# Shared UI — `src/shared/`

Reusable architecture was moved under `src/shared/` in the feature-first refactor. The current reference is [FEATURE_ARCHITECTURE.md](FEATURE_ARCHITECTURE.md).

`AppShell`, `PageHeader`, `StatusBadge`, `StatCard`, `CoverageBar`, `Panel`, navigation metadata, design tokens and base styles are shared across Scopeproof features. Only the local preview simulates Jira global navigation. The actual Forge installation uses Jira-provided chrome.

Design reference: `docs/design/overview.webp`. Authoritative business rules remain in `src/domain.js`.
