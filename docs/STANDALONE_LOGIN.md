# Scopeproof — standalone Django account login

**Implementation:** `feat/standalone-django-auth-20261111`. This is **not** an Atlassian sign-in. The standalone local login uses Django's password hashing, CSRF and server-side sessions. The Forge app remains separately authenticated by Jira and still uses the original Forge resolver/KVS.

## URLs

- `http://127.0.0.1:5173/login` — local login and (development-only) account registration.
- `http://127.0.0.1:5173/dashboard` — guarded React dashboard. Anonymous browser sessions redirect to `/login`; authenticated sessions redirect from `/login` to `/dashboard`.
- `http://127.0.0.1:8000/health/` — standalone Django service liveness only.

## First run in Windows PowerShell

From `C:\Users\felipe\Desktop\Codegeist2026\scopeproof` (adapt if your project is elsewhere):

```powershell
git fetch origin
git switch feat/standalone-django-auth-20261111
py -3 -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-django-local.ps1
```

Keep that Django terminal open. In a second terminal at the same repository:

```powershell
npm.cmd install
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

Visit `http://127.0.0.1:5173/login`, select **Crear cuenta**, register a local user, then sign out and sign back in.

The PowerShell script generates and retains an **untracked local signing key** so sessions survive development-server restarts. Do not publish the key, the SQLite database, or passwords. Session cookies are HTTP-only; Django applies CSRF checks on POST.

## Current boundaries

- Local preview dashboard still uses **sample data in browser storage** (namespaced per logged-in username). This is **not** an authorization boundary or durable per-user backend data; users can alter it locally. Do not put confidential customer data in the preview.
- Django's signed-in session is real and is verified by the backend; it does not grant access to protected Forge Remote endpoints or Jira information.
- Production account enrollment needs rate limiting, email verification/recovery, hardened deployment configuration, monitoring, secure HTTPS and a decision on tenant/user authorization. Public registration is disabled when Django DEBUG is false.
- To build a standalone deployment rather than Forge Custom UI, explicitly set `VITE_STANDALONE_AUTH=true` while building and configure secured Django + PostgreSQL. This path is not yet production-qualified.
- Forge's `manifest.yml` placeholder must still be replaced and the real Forge integration separately tested.
