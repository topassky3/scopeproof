# Scopeproof — feature-first frontend architecture

Scopeproof is a Jira Forge Custom UI application. This refactor isolates the **shared design system** from the **functional screens** without changing its backend, domain rules, Forge manifest, or storage strategy.

```text
src/
  main.tsx                       # React bootstrap only
  app/
    App.tsx                      # Jira/Forge data orchestration and UI actions
  shared/
    layout/
      AppShell.tsx               # Scopeproof sidebar, preview header, footer, page header
    components/
      ui.tsx                     # StatusBadge, StatCard, Panel, CoverageBar
    config/
      navigation.ts              # One navigation definition for all views
    types/
      review.ts                  # Shared frontend contracts
    styles/
      base.css                   # Existing common controls and table styles
      design-system.css          # Visual tokens and responsive application shell
  features/
    overview/OverviewPage.tsx
    reviews/ReviewsPage.tsx
    reviews/ReviewWorkspace.tsx  # Shared issue list and review summary during MVP
    requirements/RequirementsPage.tsx
    evidence/EvidencePage.tsx
    history/HistoryPage.tsx
    reports/ReportsPage.tsx
    settings/SettingsPage.tsx
  domain.js                     # Authoritative validation/state rules (unchanged)
  index.js                      # Forge resolver and KVS bridge (unchanged)
```

## Rules for new work

1. **Shared belongs in `src/shared/`** only if at least two features use it or it defines application-wide layout/tokens.
2. **Feature code belongs in `src/features/<name>/`.** Do not add new page JSX to `src/app/App.tsx`.
3. `src/app/` coordinates fetching, local preview state and command dispatch. Feature components should receive data and callbacks as props.
4. Preserve historical evidence semantics: **test result** (`passed`/`failed`) differs from **applicability** (`current`/`stale`).
5. Forge-hosted UI must not render a fake global Jira header. `PreviewJiraHeader` is local-only.
6. Never alter approval rules while doing a cosmetic refactor. Add domain tests in a separate feature branch for rule changes.
7. Keep the current React+TypeScript and CSS stack. Avoid introducing routing, Redux, a new UI framework, or extra build dependencies during the hackathon MVP.

## Refactor safety

This patch moves existing shared components and CSS under `src/shared/`; extracts seven screen entrypoints under `src/features/`; replaces the long `src/main.tsx` with a React bootstrap; and keeps backend domain/resolver files unchanged.

### Validate in Windows PowerShell

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

A local browser preview only proves UI behavior with sample data. Install and test Forge in a Jira development site separately.

## Next UX step

Implement the screenshot-matching `OverviewPage`: attention banner, issue filters/list, selected issue panel, requirement coverage, change impact, and recent activity. Reuse shared UI and leave the other features independently evolvable.
