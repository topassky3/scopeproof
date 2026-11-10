# Scopeproof — Django Remote Backend (foundation)

**Status:** Backend implemented on a feature branch; NOT YET wired to Forge UI, registered, deployed, or tested live against Jira. Existing Forge resolver and KVS remain authoritative until a verified migration.

## Architecture

```
Jira (user session) → Forge Custom UI / Forge Remote → Django API → PostgreSQL
                             FIT (verified JWT)     ↘ Jira as user
```

Django 5.2 LTS was selected for long support. `reviews.services` ports the same requirement-version / evidence / approval behavior as `src/domain.js`. A review aggregate is isolated by **Forge installation ID + Jira issue ID**. Production writes use PostgreSQL transactions and row locks.

## Windows PowerShell local start

From the main project checkout:

```powershell
cd "$HOME\Desktop\Codegeist2026\scopeproof"
git fetch origin
git switch feat/django-backend-foundation-20261110
cd backend

py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

$env:DJANGO_DEBUG = "1"
$env:DJANGO_SECRET_KEY = "local-dev-only-change-this-to-a-long-random-secret"
$env:DJANGO_ALLOWED_HOSTS = "127.0.0.1,localhost"

.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py test
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Visit `http://127.0.0.1:8000/health/` to check **liveness**. This route intentionally does not prove the Jira connection works.

Every `/api/v1/reviews/...` endpoint **requires a signed Forge Invocation Token** (FIT) and a user OAuth token. Ordinary browser requests return 401/503, not mock data. No password-based Jira authentication is added.

## Protected endpoints

- `GET /api/v1/reviews/<issue-key>/` — load the review for the authenticated installation after checking Jira issue access as the acting user
- `POST /api/v1/reviews/<issue-key>/commands/` — apply one `src/domain.js`-compatible command after checking Jira `EDIT_ISSUES` as the acting user, atomically
- `GET /health/` — public liveness

POST body: `{"command":{"type":"addRequirement","expectedRevision":0,"title":"Require MFA login"}}`.

## Deploy gates before connecting Forge

1. Register the *existing* Forge app ONCE, verify its genuine app ID; configure `SCOPEPROOF_FORGE_APP_ID` in Django deployment. Never register a new identity by accident.
2. Deploy Django behind HTTPS with PostgreSQL, secure secrets, application logs without tokens, network restrictions and backups.
3. Configure `remotes` and `endpoint` in `manifest.yml` (and `auth.appUserToken.enabled`, required permission scope) as specified in official Forge Remote documentation.
4. Update the frontend's bridge calls to `invokeRemote` and verify FIT/Jira user access end-to-end in a development tenant.
5. Define and test a one-time Forge KVS → Django import, with backups and checksums. **Do not switch the source of truth silently.**
6. Add dedicated reviewer permissions before any real production approval; current MVP allows a user with `EDIT_ISSUES` to approve.
7. Validate threat model, data residency, permission consents and Apps for Software Teams competition requirements.

This backend currently supports one-issue review get/command; **project list, notification integrations, PDF reports and a UI backend switch are not implemented**.

## Security

- FIT validated with Atlassian's JWKS, issuer `forge/invocation-token`, expected audience and app ID from server configuration.
- OAuth user token is forwarded only to `api.atlassian.com/ex/jira/...`; never log it.
- Rejects unverified requests; no insecure `DEBUG` auth bypass.
- Forge installation ID is a tenant key.
- POST is CSRF-exempt because it uses FIT bearer validation, not session cookies.
- SQLite may be used for **local development only**. PostgreSQL is mandatory in production.
