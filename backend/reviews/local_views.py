"""Session-authenticated standalone Reviews API.

This module NEVER accepts Forge FIT or Jira credentials. Forge Remote endpoints
remain in reviews.views and require independent Atlassian authorization.
"""
import json
import re

from django.conf import settings
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from .models import LocalReview
from .services import ReviewError, apply_command, blank_review, summarize


ISSUE_KEY_RE = re.compile(r"^[A-Z][A-Z0-9_]*-[1-9][0-9]{0,8}$")


def _guard(request):
    if not settings.SCOPEPROOF_STANDALONE_AUTH:
        return JsonResponse({"error": "NOT_AVAILABLE"}, status=404)
    if not request.user.is_authenticated or not request.user.is_active:
        return JsonResponse({"error": "AUTH_REQUIRED"}, status=401)
    return None


def _json_payload(request):
    if request.content_type != "application/json":
        return None
    if len(request.body) > 16384:
        return None
    try:
        data = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        return None
    return data if isinstance(data, dict) else None


def _issue_key(value):
    if not isinstance(value, str):
        return None
    normalized = value.strip().upper()
    return normalized if ISSUE_KEY_RE.fullmatch(normalized) else None


def _serialize(record):
    review = record.document
    return {"review": review, "derived": summarize(review)}


def _failure(exc):
    msg = str(exc)
    status = 409 if msg.startswith("CONFLICT") else 422 if msg.startswith("APPROVAL_BLOCKED") else 400
    return JsonResponse({"error": msg}, status=status)


@require_GET
def local_review_list(request):
    denied = _guard(request)
    if denied is not None:
        return denied
    project_key = request.GET.get("project", "").strip().upper()
    if project_key and not re.fullmatch(r"[A-Z][A-Z0-9_]{0,30}", project_key):
        return JsonResponse({"error": "INVALID_PROJECT_KEY"}, status=400)
    records = LocalReview.objects.filter(owner=request.user)
    if project_key:
        records = records.filter(project_key=project_key)
    rows = []
    for record in records.order_by("-updated_at", "-id")[:100]:
        status = summarize(record.document)
        rows.append({
            "issueKey": record.issue_key,
            "summary": record.summary,
            "status": status["status"],
            "covered": status["covered"],
            "mandatory": status["mandatory"],
            "revision": record.revision,
        })
    return JsonResponse({"reviews": rows})


@require_POST
def local_review_create(request):
    denied = _guard(request)
    if denied is not None:
        return denied
    body = _json_payload(request)
    if body is None:
        return JsonResponse({"error": "INVALID_JSON"}, status=400)
    issue_key = _issue_key(body.get("issueKey"))
    summary = body.get("summary")
    if not issue_key:
        return JsonResponse({"error": "INVALID_ISSUE_KEY"}, status=400)
    if not isinstance(summary, str) or not 5 <= len(summary.strip()) <= 180:
        return JsonResponse({"error": "INVALID_SUMMARY"}, status=400)
    summary = summary.strip()
    project_key = issue_key.split("-", 1)[0]
    issue = {
        "id": "local:" + issue_key,
        "key": issue_key,
        "projectId": "local:" + project_key,
        "projectKey": project_key,
        "summary": summary,
    }
    try:
        with transaction.atomic():
            record = LocalReview.objects.create(
                owner=request.user, issue_key=issue_key, project_key=project_key,
                summary=summary, document=blank_review(issue),
            )
    except IntegrityError:
        return JsonResponse({"error": "REVIEW_ALREADY_EXISTS"}, status=409)
    return JsonResponse(_serialize(record), status=201)


@require_GET
def local_review_detail(request, issue_key):
    denied = _guard(request)
    if denied is not None:
        return denied
    clean_key = _issue_key(issue_key)
    if clean_key is None:
        return JsonResponse({"error": "INVALID_ISSUE_KEY"}, status=400)
    record = LocalReview.objects.filter(owner=request.user, issue_key=clean_key).first()
    if record is None:
        return JsonResponse({"error": "REVIEW_NOT_FOUND"}, status=404)
    return JsonResponse(_serialize(record))


@require_POST
def local_review_command(request, issue_key):
    denied = _guard(request)
    if denied is not None:
        return denied
    clean_key = _issue_key(issue_key)
    if clean_key is None:
        return JsonResponse({"error": "INVALID_ISSUE_KEY"}, status=400)
    payload = _json_payload(request)
    if payload is None or not isinstance(payload.get("command"), dict):
        return JsonResponse({"error": "INVALID_COMMAND"}, status=400)

    try:
        with transaction.atomic():
            record = LocalReview.objects.select_for_update().filter(
                owner=request.user, issue_key=clean_key,
            ).first()
            if record is None:
                return JsonResponse({"error": "REVIEW_NOT_FOUND"}, status=404)
            changed = apply_command(
                record.document, payload["command"], "local-user:" + str(request.user.pk),
            )
            record.document = changed
            record.revision = changed["revision"]
            record.save(update_fields=["document", "revision", "updated_at"])
    except ReviewError as exc:
        return _failure(exc)
    return JsonResponse({"review": changed, "derived": summarize(changed)})
