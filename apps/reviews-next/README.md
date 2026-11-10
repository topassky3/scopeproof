# Scopeproof Reviews — Next.js frontend

Independent Reviews frontend for collaborating without changing the existing Vite + Forge application.
The original root application and its Forge manifest remain untouched until Felipe agrees to integrate.

## Start locally

Requirements: Node.js 22+, npm.

1. Open a terminal in apps/reviews-next.
2. Run: npm install
3. Run: npm run test
4. Run: npm run dev
5. Open http://localhost:3000
6. For an export build, run: npm run build (outputs apps/reviews-next/out).

The default is visibly labeled SAMPLE PREVIEW. It never writes to Jira.
Sample data contains one ACO-142 review in revalidation status.

## What to test manually

- Renders the issue list and current review with coverage 2/3.
- Search for ACO-142; status filter Revalidation.
- Inspect RQ-01 v2, showing outdated evidence.
- Click Demo: add passed evidence for RQ-01 v2: coverage becomes 3/3, approval not yet recorded.
- Click Approve: creates a second approval in preview, preserving the first.
- Click View history: previous and new events are visible.
- Reset demo and try Reject: reason under 5 characters is rejected, valid reason is accepted.
- Test narrow browser widths, keyboard tab order, and screen-reader labels.

## Contract with Felipe's existing Forge backend

Set environment variable NEXT_PUBLIC_SCOPEPROOF_MODE=forge BEFORE building to enable the live bridge.
The Next.js bundle runs with static export; no Next.js API routes or server actions.
These calls are made through @forge/bridge (existing resolver names):

- invoke('getReview', { issueKey }) returns { review, derived }.
- invoke('listReviews', { projectKey }) returns an array of issueKey, summary, status, covered, mandatory.
- invoke('command', { issueKey, command: { type, expectedRevision, ...payload } }) returns { review, derived }.
- command.type 'approve': backend decides if current passing mandatory evidence exists.
- command.type 'reject': command.note must contain at least 5 characters.
- The demo-only addEvidence button is intentionally NOT present in Forge mode; use the existing Evidence screen for actual records.

To activate it in Jira, Felipe must decide how to use the generated out/ assets and update manifest.yml resource/module configuration accordingly. This branch deliberately does NOT redeploy or change Jira identity, KVS, permissions, backend or root build.

IMPORTANT: The browser-side projection is for display and preview. Only the Forge server can authorize mutations. Known backend limitations (reviewer-role authorization and atomic KVS writes) remain open.

## Automated tests

Run npm run test to execute tests/reviews-model.test.mjs using Node's built-in test runner.
Run npm run build for TypeScript / Next static export validation.
There are no connected Jira integration tests here: run CP-01 to CP-10 in the Jira development tenant after installation. CP-09 requires Felipe to fix atomic persistence first.
