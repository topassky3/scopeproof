# Overview & Reviews acceptance: Forge project page

The **main React/Vite Forge frontend** is authoritative for the application navigation.
The separate Next.js Reviews demo remains in the repository but is not mounted in the Forge app.

## Scope
- Overview project health, saved issues, filters including Rejected, pagination, responsive cards, version-impact counts, and readable audit actor names.
- Reviews real saved-issue search, status filters, pagination, current review details, immutable historical decisions, approval status, and audit activity.
- No changes to `src/domain.js`, Forge resolver permissions, KVS, Jira issue data, or existing approvals.
- `read:jira-user` is already configured in the source branch for display names (viewer permissions are respected).

## Manual acceptance in development
1. Open Scopeproof project page, load `ACD-1` from the existing Jira installation.
2. Overview: 1 tracked issue, status Approved, version `RQ-01 v2`, coverage `1/1`. **One outdated historical evidence** (`EV-101`) should still appear in impact even though the approval is current.
3. Verify the status filters, search and empty results, plus mobile cards with no sideways overflow at 393px.
4. Reviews: same live selected review; filtering/search shows no invented issues. Select `ACD-1`; verify requirement snapshot, coverage and latest real approval with resolved actor label.
5. Navigate to Requirements, Evidence and History without triggering mutations. Confirm `EV-101`, `EV-102`, original requirement versions and 7 audit events remain.
6. Optionally test a **separate sandbox Jira issue**, never `ACD-1`, for a revalidation scenario.
7. Deploy only to Forge Development after local npm tests + build + forge lint pass. Keep `main` and Production untouched until visual QA completes.
