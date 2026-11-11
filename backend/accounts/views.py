"""Standalone Scopeproof account endpoints (NOT Atlassian/Jira authentication)."""
import json
import re

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.http import require_GET, require_POST


def _only_standalone():
    return settings.SCOPEPROOF_STANDALONE_AUTH


def _state(request):
    user = request.user
    return {
        "authenticated": user.is_authenticated,
        "username": user.get_username() if user.is_authenticated else None,
        "signupEnabled": settings.SCOPEPROOF_ALLOW_SIGNUP,
        "csrfToken": get_token(request),
    }


def _payload(request):
    if request.content_type != "application/json":
        return None
    if len(request.body) > 4096:
        return None
    try:
        obj = json.loads(request.body)
    except (UnicodeDecodeError, ValueError):
        return None
    return obj if isinstance(obj, dict) else None


@require_GET
def session_status(request):
    if not _only_standalone():
        return JsonResponse({"error": "NOT_AVAILABLE"}, status=404)
    return JsonResponse(_state(request))


@require_POST
def sign_in(request):
    if not _only_standalone():
        return JsonResponse({"error": "NOT_AVAILABLE"}, status=404)
    data = _payload(request)
    if data is None:
        return JsonResponse({"error": "INVALID_REQUEST"}, status=400)
    username, password = data.get("username"), data.get("password")
    if not isinstance(username, str) or not isinstance(password, str):
        return JsonResponse({"error": "INVALID_CREDENTIALS"}, status=400)
    username = username.strip()
    if len(username) > 150 or len(password) > 1024:
        return JsonResponse({"error": "INVALID_CREDENTIALS"}, status=400)
    user = authenticate(request, username=username, password=password)
    if user is None or not user.is_active:
        return JsonResponse({"error": "INVALID_CREDENTIALS"}, status=401)
    login(request, user)
    return JsonResponse(_state(request))


@require_POST
def sign_out(request):
    if not _only_standalone():
        return JsonResponse({"error": "NOT_AVAILABLE"}, status=404)
    logout(request)
    return JsonResponse(_state(request))


@require_POST
def sign_up(request):
    if not _only_standalone() or not settings.SCOPEPROOF_ALLOW_SIGNUP:
        return JsonResponse({"error": "SIGNUP_DISABLED"}, status=403)
    data = _payload(request)
    if data is None:
        return JsonResponse({"error": "INVALID_REQUEST"}, status=400)
    username, password = data.get("username"), data.get("password")
    if not isinstance(username, str) or not isinstance(password, str):
        return JsonResponse({"error": "INVALID_INPUT"}, status=400)
    username = username.strip()
    if not re.fullmatch(r"[A-Za-z0-9_]{3,30}", username):
        return JsonResponse({"error": "USERNAME_FORMAT"}, status=400)
    if len(password) > 1024:
        return JsonResponse({"error": "INVALID_PASSWORD"}, status=400)
    User = get_user_model()
    candidate = User(username=username)
    try:
        validate_password(password, user=candidate)
    except ValidationError:
        return JsonResponse({"error": "WEAK_PASSWORD"}, status=400)
    try:
        with transaction.atomic():
            user = User.objects.create_user(username=username, password=password)
    except IntegrityError:
        return JsonResponse({"error": "USERNAME_UNAVAILABLE"}, status=409)
    login(request, user)
    return JsonResponse(_state(request), status=201)
