# Standalone Reviews API (Django session)

This is the **first backend foundation** for the React/Vite dashboard and Lopera's
Next.js Reviews prototype. It does **not** connect either frontend yet. Current
Next.js preview remains sample-only until a separate UI integration step.

## Security and architecture

- Authentication: existing Django `/api/local/auth/session/` session cookie
- All mutating requests require the same-origin Django CSRF token, sent as `X-CSRFToken`
- Local data is stored in `reviews.LocalReview` and scoped to the authenticated user
- This table is **separate** from `reviews.Review` used by Forge/Jira; a Django
  user session must never grant access to `/api/v1/reviews/` (requires Forge FIT).
- Existing `SCOPEPROOF_STANDALONE_AUTH` switch gates all local endpoints
- No public cross-origin credential API; connect the Vite preview through the
  existing same-origin dev proxy (`/api/local`)
- No data migration from local sample browser storage, Jira, or Forge KVS occurs

## Endpoints

- `GET /api/local/reviews/?project=ACO` — list the current user's reviews (up to 100)
- `POST /api/local/reviews/new/` — create `{"issueKey":"ACO-142","summary":"Implement SSO authentication"}`
- `GET /api/local/reviews/ACO-142/` — retrieve one review
- `POST /api/local/reviews/ACO-142/commands/` — `{"command":{"type":"addRequirement","expectedRevision":0,"title":"Require MFA login"}}`

Create/detail/command results use `{"review": {...}, "derived": {...}}`;
list uses `{"reviews":[{"issueKey":"...", "summary":"...", "status":"...", "covered":0,"mandatory":1,"revision":0}]}`.

A requested issue is a *local* identifier matching Jira-style syntax; creating
it does not fetch or verify a Jira issue. Do not treat local data as verified Jira
reviews.

## Test

```powershell
cd "$HOME\Desktop\Codegeist2026\scopeproof"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-django-local.ps1
```

The launcher runs database migrations. Run tests from a second terminal with the
same `DJANGO_DEBUG`, `DJANGO_SECRET_KEY`, and `DJANGO_ALLOWED_HOSTS`
environment settings, or rely on GitHub Actions.

## Follow-up required

1. Introduce a typed, cookie-authenticated client in the Vite Reviews screen
   (or explicitly choose the Next.js prototype as the primary UI). The current
   Vite preview and Next.js preview **still use sample data**.
2. Implement review creation/open/list UX with real session auth.
3. Confirm persistence across restart and isolation between two users.
4. Introduce roles/team collaboration only after defining authorization policy.
5. Postgres multi-worker concurrency validation and production hardening.
6. Integrate Jira Forge only through verified FIT and authorized user tokens;
   never mix local cookies into those protected endpoints.
