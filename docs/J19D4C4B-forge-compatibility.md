# J19D.4C.4B — Forge context compatibility and stored synthetic acceptance

Status: candidate / NO-GO external distribution. Parent 86cc6bf was accepted locally: 313 tests passed, build passed, clean tree, forge lint 0 errors, 0 warnings, 1 approval (scope upgrade). No actual Forge fixture execution has yet been observed.

## Change
- Use documented getAppContext().installationAri.installationId and toString() on the platform InstallationAri object. Require a canonical UUID opt-in and development environment. No implicit string coercion or user-supplied context. Existing opt-in variable now accepts the installation UUID (not an ARI).
- One-shot fixture now persists an unredacted synthetic review in both dedicated fixture stores, verifies it, replaces it with the redacted synthetic review, verifies target absence and removes only the fixed fixture artifacts. Occupied keys cause a hold. This does not implement safe real legacy remediation.
- Emit a count-free skip diagnostic if the environment/installation gate rejects a configured QA mode. Never log account IDs or record data.
- Three additional regression tests target the documented context shape, stored synthetic before/after evidence and occupied fixture keys.

## Development acceptance sequence
1. Checkout exact commit in isolated QA worktree; run npm run check, npm audit --audit-level=moderate, forge lint.
2. Run forge install list -e development and verify the intended test installation. Set SCOPEPROOF_PRIVACY_FIXTURE_INSTALLATION to that installation UUID and SCOPEPROOF_PRIVACY_MODE to fixture-report only in development. Environment variables require redeployment.
3. Deploy only development and upgrade only the intended development installation for the scope change. Confirm new entity index active before interpreting fixture logs. If held/failed, inspect before retrying; never reset journal blindly.
4. Verify PRIVACY_FIXTURE_STATE pending then complete (closed=1, updated=0, remediated=1), no unexpected real writes. Disable mode and redeploy development after acceptance. No production rollout is authorized.
5. The production recurring reporting and actual real-data remediation gates remain open, including manual/free-text rights handling, retention, and policy approval. No certification is claimed.

References: https://developer.atlassian.com/platform/forge/runtime-reference/app-context-api/ ; https://developer.atlassian.com/platform/forge/user-privacy-guidelines/ ; https://developer.atlassian.com/platform/forge/runtime-reference/privacy-api/ ; https://developer.atlassian.com/platform/forge/cli-reference/variables-set/ .
