# Scopeproof — Architecture / decisions

## Boundaries

Browser Custom UI -> Forge bridge `invoke` -> Forge resolver -> `api.asUser().requestJira()` -> Forge KVS.

Both `jira:projectPage` and `jira:issuePanel` use the same bundle and resolver. The issue ID comes from the authenticated Jira REST response, never from an unvalidated client-provided database key. User actions use Jira's `EDIT_ISSUES` permission before modifying a review.

## Domain rules

Requirements have monotonically increasing versions. Evidence is bound to one requirement version. The **last registered test result** for the current version determines the current evidence state. Historical evidence retains its original passed/failed result independently of current applicability. The approval contains a snapshot of requirement version and evidence IDs. A changed mandatory requirement or superseding evidence makes that approval non-current. Approval is permitted only if mandatory requirements have passing current evidence.

## Security risks / open design debt

- KVS isolates installations. App-side role-level permissions (reviewer vs developer) are TODO.
- Current KVS write flow isn't an atomic CAS; concurrent reviewers can lose updates.
- Audit data is within the same mutable review object and isn't yet append-only.
- URLs supplied as evidence are references only, not independently verified proof. Never claim their contents have been inspected.
- Data export should be reviewed for privacy before sharing.

## Local preview

Vite builds a UI-only preview with sample data in browser localStorage, explicitly labeled and separate from Forge. All logic is shared for quick visual iteration.
