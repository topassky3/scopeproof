# J16.1 History acceptance
Preserves existing shared Panel, timeline, actor label and original event ordering. Adds read-only category/search, counters, details and incremental rendering. Legacy links are accepted only for uniquely matched records, never inferred from latest state. No storage, resolver, App or manifest changes.
- ACD-1: 7 events; requirement events 2, evidence events 2, decisions 2, revalidation events 1. Newest first. Inspect EV-101 and EV-102, both approvals, RQ-01 v1/v2.
- Filter decisions: 2; evidence: 2; revalidation: 1; no-match search: empty detail. Clear filters restores all 7.
- Historical v1/v2 wording and snapshots must match original persisted data; unavailable or ambiguous detail must be marked as such.
- At 393px width verify keyboard-accessible timeline and stacked detail; verify no new writes or changes to audit data.
- Legacy events lack explicit linked record IDs for decisions; matching by type, actor and timestamp is conservative, not cryptographic proof. No claim of tamper-proof storage.
