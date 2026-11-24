# Consolidated UI QA — November 24, 2026

Integrates the content of Cerati1987's PRs #11, #12, #13 and the November 23 mobile CSS additions from #5 onto PR #10, without replacing the actor-name and historical-evidence improvements from #9.

- Preserve the Django-only Reviews consumer: Forge-specific actions are optional and the shared navigation callback accepts Requirements and History; the Forge wrapper wires Evidence explicitly.
- Keep the separate Ready to approve filter from the earlier Reviews UI.
- Keep the selected evidence inspection independent from the new-evidence requirement target.
- Follow filtered Requirements rows in the detail panel.
- Disable approval with no mandatory requirements; the domain already rejects such commands.
- Incorporate best-effort local-preview cross-tab checks. These are not atomic multi-user locking in Forge KVS.
- Keep mobile CSS fixes scoped to small-screen page headers and dialogs.
- No Forge manifest, KVS migration, backend data, or production deployment changed.

Local integration must preserve the registered Forge application ID, local Django entry points, and the original Jira review. Test and build the actual local integration branch, not only the remote QA branch. Use a different Jira issue for write/negative-path tests.
