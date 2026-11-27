# J19D.4C.1 — Privacy inventory and synthetic lifecycle candidate

Status: PARTIAL / NO-GO external distribution. Issue #19. RC1 baseline 82c55e6; documentation baseline cd6d4d4. No production deployment or live deletion is authorized. This report records design and code, not completed execution.

## Inventory
- `src/index.js` uses authenticated Jira accountId for writes, authorized issue/project metadata and edit permissions.
- `src/domain.js` stores actor and createdAt on requirement versions, evidence, approvals and events. User-entered title, issue summary, evidence URLs and decision notes can contain personal data beyond structured IDs.
- `src/review-store.js` stores the review in CES and reads legacy KVS; the old copy may survive migration. The UI project index is limited to 40 candidates and is not suitable for privacy enumeration.
- `useActorNames.ts` queries display names in the browser as the viewing user and does not persist profiles in Forge storage. `review-selection.mjs` stores a session preference keyed by account ID; browser lifetime and clearing must be reviewed. Preview localStorage, standalone Django and Next.js are separate from the Forge release.
- Reports can be downloaded and are outside app storage. No structured identifier in logs is intentionally added here. Free text, historical logs and backup retention need separate review.

## Official requirements
See https://developer.atlassian.com/platform/forge/user-privacy-guidelines/ and https://developer.atlassian.com/platform/forge/runtime-reference/privacy-api/. Report stored personal data by accountId with oldest retrieval age, observe the required cycle (default seven days and possible server override), handle closed/updated results, avoid reporting unknown accounts, and erase data no longer needed. Use official synthetic IDs for live API regression testing.

## Implemented candidate
- Read-only full key-prefix enumeration over CES by-key and legacy KVS, direct reread, validation and explicit bounded failure; no UI project index dependency.
- Four actor paths, oldest event age as conservative retrieval proxy for structured IDs recorded at command time; malformed data fails closed. Per-run deduplication and batches of at most 90, strict response validation.
- Pure redaction of closed structured actor references with revision advancement and preserved approval snapshots. No account-derived replacement; erased actor marker is not a Jira account. The marker may affect legacy event-to-decision attribution; review before use. Free-text and indirect identifiers are not erased by this function.
- Synthetic maintenance executor requires exclusive maintenance and injected conditional replacement for both stores. Updated status is routed to review, not falsely acknowledged. No live storage write adapter is provided.
- Weekly Forge function and permission are candidate-only. Default off; modes inventory (counts only) and fixture-report (official test accounts only). Neither mode reports stored real accounts nor erases data. Do not enable fixture mode repeatedly; verify in a dedicated development environment and unset afterward.
- Eleven new tests and a separate non-deployment CI workflow for requested checks.

## Release blockers
1. Verify actual SDK query/index syntax and consistency on a dedicated development installation; eventual queries cannot certify absence of records. Need a durable installation-scoped inventory/registration mechanism for new records and old copies; browser session preferences need an explicit lifecycle.
2. Implement durable per-account reporting checkpoints, cycle override handling (SDK helper may hide headers), retry/backoff, duplicate-invocation handling and recovery after interrupted batches. Current live reporting is intentionally not wired.
3. Implement authorized access, correction/erasure and safe remediation of CES and legacy KVS including concurrent migration, stale reads and retries. Legacy KVS CAS is not established. Validate event-to-decision rendering and manual redaction of user-entered personal text; do not assume structured redaction is anonymization.
4. Confirm private support channel, uninstall retention and backup/export handling, approve PR #18 privacy notice and terms, then verify end-to-end in development with synthetic data.
5. Verify npm ci, full suite, audit, Forge lint and app identity; CI results must be attached when observed. No production rollout or external sharing until all gates pass.

No live personal data was accessed or deleted. No compliance certification is claimed.
