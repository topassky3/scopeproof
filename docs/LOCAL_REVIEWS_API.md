# Standalone Reviews API (Django session)

This backend is connected to the **main React/Vite dashboard** at
`http://127.0.0.1:5173/dashboard` after Django login. It loads and persists
user-owned Reviews through `/api/local/reviews/`. Lopera's independent
Next.js prototype on port 3000 remains a **sample-only** preview.
Its tested search, status filters, metrics and rejection-reason display have
been ported into the primary Reviews UI.

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

## Browser acceptance test

1. Start Django with `scripts/start-django-local.ps1` in terminal one.
2. Run `npm.cmd run dev` from the repository root (React/Vite) in terminal two.
3. Sign in to `http://127.0.0.1:5173/login` with a Django account.
4. Open **Reviews** in the existing left navigation. Click **New review** and
   create `ACO-210` with summary `Verify durable changes`.
5. Open **Requirements**, add a mandatory requirement. Then use **Evidence**
   or the requirement's **Add evidence** action to add a passed result.
6. Return to **Reviews**, approve and open **History**; the event is preserved.
7. Change the requirement version: the review must become **Revalidation**.
8. Sign out, restart both servers, sign back in: `ACO-210` and its history
   must still exist. Another account must not be able to read `ACO-210`.
9. Verify the Next.js preview at port 3000 remains isolated and does not
   claim to be connected to Django.

This is *local standalone* persistence. It does not verify real Jira issues,
and does not migrate the demo data from browser localStorage.

## Follow-up required

1. Complete manual browser acceptance testing with two real local users.
2. Define user roles/team collaboration; current local reviews belong to one
   authenticated user and are not shared.
3. Validate PostgreSQL multi-worker concurrency in a staging deployment.
4. Integrate Jira Forge only through verified FIT and authorized user tokens,
   including actual tenant checks and Forge permissions.
5. Review dependency audit warnings before production deployment.

