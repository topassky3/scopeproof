# J19D.4C.4A — Durable privacy batch and isolated Forge fixture

Status: PARTIAL / NO-GO external distribution. Based on c44fd63; no production deployment or real-data operations. The earlier 301 tests and authenticated lint (0 errors, 0 warnings, one major-version approval due to scope) were observed on that parent, not on this commit.

## Implementation
- A bounded durable batch journal stores report/maintenance progress using conditional CES revision+token writes. Duplicate triggers cannot acquire the same claim. A known retry rejection is delayed; an ambiguous report or remediation outcome is held for inspection rather than repeated or falsely acknowledged. Successful batches record a next-eligible time when supplied by the transport, and discard the account/action arrays at completion.
- The SDK helper exposes actions, not the server cycle or retry headers. The generic batch interface requires those metadata for real reporting. Only the one-shot official fixture accepts a missing cycle. This does not yet implement a recurring per-account scheduler.
- A new scopeproof-privacy-job entity isolates the journal from real reviews. The scheduled QA interval is fiveMinute, only active when the platform context is DEVELOPMENT and matches SCOPEPROOF_PRIVACY_FIXTURE_INSTALLATION exactly, with SCOPEPROOF_PRIVACY_MODE=fixture-report or inventory. No public trigger/resolver added.
- The live fixture sends only the two published Atlassian regression account IDs and demands the documented closed response. It writes and directly verifies a redacted synthetic approved review to isolated fixed CES and KVS fixture keys, then deletes only those keys. The normal review keys and real account IDs are never sent or mutated by this path. This verifies a redacted write/readback/cleanup, not real legacy CAS or end-to-end erasure of a stored unredacted review.
- A finished journal makes the fixture one-shot, even with repeated trigger calls. An ambiguous state requires developer inspection; no automatic reset.
- Tests model duplicate invocation, interrupted report and remediation, rate-delay contract, foreign responses, tenant isolation, both fixture stores, and production guard. Live Forge behavior is not established by mocks.

## Sources checked
https://developer.atlassian.com/platform/forge/user-privacy-guidelines/
https://developer.atlassian.com/platform/forge/runtime-reference/privacy-api/
https://developer.atlassian.com/platform/forge/storage-reference/entities-transactions/
https://developer.atlassian.com/platform/forge/runtime-reference/app-context-api/
https://developer.atlassian.com/platform/forge/manifest-reference/modules/scheduled-trigger/

## Remaining gates
Actual recurring account inventory/registration and server cycle/retry metadata; verified remediation of real structured and free-text data including old KVS copies; authorized individual rights workflow and retention; reconciliation for held operations; browser session lifecycle; real development SDK/fixture acceptance; approved privacy notice, private support contact and final production acceptance. The five-minute QA schedule must be reconsidered before production. No real user data reporting or deletion is enabled. Do not enable external distribution.
