# Scopeproof Overview dashboard — phase 3

This phase follows `docs/design/overview.webp` and the approved Jira screenshot reference.

## What it includes

- Project review counts calculated from the Forge `listReviews` rows, with the active review refreshed from the current state.
- Interactive search, status tabs and pagination (six rows per page).
- Selected issue requirements and accurate evidence coverage.
- Change impact based on the authoritative domain summary (stale requirements, linked outdated evidence, previous approval requiring revalidation).
- Latest stored audit events with no invented actor, issue, assignee or Jira workflow state.
- Working actions to focus the Jira issue lookup, open Reviews or History, and open the existing add-evidence modal.
- Narrow-width layout and accessible names for important controls.

## Boundaries

The app does **not** currently know Jira issue status, the assigned Jira user, or a project-wide history summary; these are not shown as real data. The local preview starts with one sample review, not fictitious dashboard totals. Forge / Jira installation and authorization still require separate verification.

Changes are isolated to Overview; all other feature screens remain unchanged. Tests cover view-model data, filters and impacts. Business domain, resolver, manifest, and storage are untouched.
