"""Verify Forge FIT, then authorize every read/write as the acting Jira user."""
import re
from urllib.parse import urlparse

import jwt
import requests
from django.conf import settings

JWKS_URL = "https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json"
FIT_ISSUER = "forge/invocation-token"
JIRA_KEY_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]*-[1-9][0-9]{0,8}$")
_jwks = jwt.PyJWKClient(JWKS_URL, cache_jwk_set=True, lifespan=300)


class AccessDenied(Exception):
    def __init__(self, code="NOT_AUTHORIZED", status=403):
        super().__init__(code)
        self.code = code
        self.status = status


def authenticated_context(request):
    app_id = settings.SCOPEPROOF_FORGE_APP_ID
    if not app_id or app_id.endswith("/REPLACE_ME") or app_id.endswith("/00000000-0000-0000-0000-000000000000"):
        raise AccessDenied("BACKEND_NOT_CONFIGURED", 503)
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise AccessDenied("FORGE_INVOCATION_TOKEN_REQUIRED", 401)
    fit = header[7:].strip()
    try:
        signing_key = _jwks.get_signing_key_from_jwt(fit).key
        claims = jwt.decode(
            fit, signing_key, algorithms=["RS256"],
            audience=app_id, issuer=FIT_ISSUER,
            options={"require": ["exp", "iat", "nbf", "iss", "aud"]},
        )
    except (jwt.PyJWTError, ValueError):
        raise AccessDenied("INVALID_FORGE_INVOCATION_TOKEN", 401) from None
    app = claims.get("app")
    if not isinstance(app, dict) or app.get("id") != app_id:
        raise AccessDenied("INVALID_FORGE_APP", 401)
    installation = app.get("installationId")
    if not isinstance(installation, str) or not installation:
        raise AccessDenied("INVALID_FORGE_INSTALLATION", 401)
    actor = claims.get("principal")
    if not isinstance(actor, str) or not actor:
        raise AccessDenied("FORGE_USER_REQUIRED", 403)
    token = request.headers.get("x-forge-oauth-user", "")
    if not token:
        raise AccessDenied("JIRA_USER_TOKEN_REQUIRED", 403)
    base = app.get("apiBaseUrl", "")
    parsed = urlparse(base)
    if (parsed.scheme != "https" or parsed.netloc != "api.atlassian.com"
            or not re.fullmatch(r"/ex/jira/[a-zA-Z0-9-]+/?", parsed.path)
            or parsed.query or parsed.fragment or parsed.username):
        raise AccessDenied("INVALID_JIRA_API_BASE", 401)
    return {"installation": installation, "actor": actor, "user_token": token,
            "api_base": base.rstrip("/")}


def jira_get(ctx, path, params=None):
    try:
        response = requests.get(
            ctx["api_base"] + path,
            headers={"Authorization": "Bearer " + ctx["user_token"],
                     "Accept": "application/json"},
            params=params, timeout=8, allow_redirects=False,
        )
    except requests.RequestException:
        raise AccessDenied("JIRA_UNAVAILABLE", 502) from None
    if response.status_code in (401, 403, 404):
        raise AccessDenied("JIRA_ISSUE_NOT_ACCESSIBLE", 403)
    if response.status_code != 200:
        raise AccessDenied("JIRA_UPSTREAM_ERROR", 502)
    try:
        return response.json()
    except ValueError:
        raise AccessDenied("JIRA_INVALID_RESPONSE", 502) from None


def authorized_issue(ctx, issue_key, *, write=False):
    key = str(issue_key).strip().upper()
    if not JIRA_KEY_PATTERN.fullmatch(key):
        raise AccessDenied("INVALID_ISSUE_KEY", 400)
    data = jira_get(ctx, "/rest/api/3/issue/" + key,
                    params={"fields": "summary,project"})
    issue = {
        "id": str(data["id"]), "key": data["key"],
        "summary": data["fields"]["summary"],
        "projectId": str(data["fields"]["project"]["id"]),
        "projectKey": data["fields"]["project"]["key"],
    }
    if write:
        permission = jira_get(ctx, "/rest/api/3/mypermissions",
                              params={"issueKey": key, "permissions": "EDIT_ISSUES"})
        if not permission.get("permissions", {}).get("EDIT_ISSUES", {}).get("havePermission"):
            raise AccessDenied("EDIT_PERMISSION_REQUIRED", 403)
    return issue
