# Scopeproof shared UI architecture (phase 1)

This phase follows the Jira-oriented **Project Overview** design reference, but deliberately separates shared navigation and presentation from domain logic.

## Structure

```text
src/
  components/
    AppShell.tsx      # Shared shell, local-only Jira preview header, sidebar, footer, page heading
    ui.tsx            # StatusBadge, StatCard, Panel, CoverageBar
  config/
    navigation.ts     # Navigation entries and page metadata (single source of truth)
  styles/
    design-system.css # Shared design tokens, layout, responsive rules
  domain.js           # Existing business rules (unchanged)
  index.js            # Existing Forge resolver (unchanged)
  main.tsx            # Existing screen flows using shared components
```

## Design constraints

1. **Forge is hosted by Jira.** Never imitate Jira's global navigation inside the installed Forge UI. `PreviewJiraHeader` is rendered only in local Vite preview. Jira supplies its actual global navigation in production.
2. **One navigation configuration.** Add or rename pages in `config/navigation.ts` rather than duplicating strings and icons in each screen.
3. **One status vocabulary.** Reuse `StatusBadge` and status-tone mappings. A historically passed test may be stale for the current requirement: keep test result and applicability distinct.
4. **One visual token system.** Update CSS custom properties in `styles/design-system.css` instead of adding arbitrary colors to every screen.
5. **Reusable semantic layout.** Reuse `Panel`, `StatCard`, and `CoverageBar` for consistent accessibility and responsive behavior.
6. **Keep business logic isolated.** UI refactoring must not change `domain.js`, `index.js`, `manifest.yml`, or Forge storage rules.

## Next incremental UI work

- Phase 2: Dedicated `OverviewPage` + right-side issue summary, change impact, recent activity.
- Phase 3: `ReviewsPage` and `RequirementsPage`, shared filters, version comparison and action drawers.
- Phase 4: `EvidencePage`, `HistoryPage`, `ReportsPage`, and `SettingsPage` with honest MVP-only controls.
- Phase 5: UI interaction, accessibility, small-width Jira issue panel, and Forge deploy QA.

## Local verification

```powershell
npm install
npm test
npm run build
npm run dev
```

Local preview uses demonstration data. The real Forge deployment must be tested independently.
