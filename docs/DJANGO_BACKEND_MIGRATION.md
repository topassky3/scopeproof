# Scopeproof Django backend — integration plan

Django + PostgreSQL is the future backend. **Current running app remains Forge resolver + Forge KVS.** Do not delete `src/index.js`, `src/domain.js`, or change `manifest.yml` without a tested cutover.

1. Local: run Django tests and health endpoint.
2. Register the existing Forge app and verify the real app ID (manifest still has a placeholder).
3. Deploy a secured HTTPS Django endpoint and PostgreSQL; set DJANGO_SECRET_KEY, SCOPEPROOF_FORGE_APP_ID, ALLOWED_HOSTS and DB credentials through environment variables.
4. Define Forge Remote `remotes` + `endpoint` and `appUserToken` user scope according to the current official docs.
5. Validate FIT JWT, user token, tenant ID and Jira READ/EDIT permissions in a live Jira dev tenant.
6. Implement project review listing and update the React data adapter to use Django with equivalent result shapes.
7. Before cutover, export and verify Forge KVS data, perform an import with integrity tests, and keep rollback possible.
8. Add separate reviewer RBAC, audit immutability guarantees, concurrency/load tests and data residency disclosures.

The local login visual is still a preview; Jira/Atlassian handles actual authentication, and Django must never accept plain Jira passwords.

Sources:
- https://developer.atlassian.com/platform/forge/remote/essentials/
- https://developer.atlassian.com/platform/forge/remote/calling-from-frontend/
- https://developer.atlassian.com/platform/forge/remote/calling-product-apis/
