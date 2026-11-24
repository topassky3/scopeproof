# J15.10 — Restore selected Jira review
- Stores only a confirmed Jira issue key in browser sessionStorage, scoped by site, account, Forge environment and project ID/key.
- Project module only. An explicit issue panel takes precedence. Every restore calls the existing getReview resolver which authorizes the current viewer via Jira.
- Invalid or inaccessible selections fail safely. Browser storage is optional; clearing it returns to manual lookup. No review contents, KVS writes or manifest changes.
- Preview/Django behavior is unchanged. Storage is per browser tab/session; no promise of cross-device or cross-tab persistence.
- Acceptance: open ACD-1 in the project page, reload in the same tab, confirm the approved review, two evidence records and seven events remain. Try another project/account and confirm no automatic cross-project restoration. Clear browser session storage or deny it and confirm manual lookup still works.
- Browser iframe storage availability and real Jira context must be verified after deployment.
