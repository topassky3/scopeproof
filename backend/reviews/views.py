"""Forge Remote Django endpoints. Never accessible with browser cookies or local bypasses."""
import json
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .models import Review
from .security import AccessDenied, authenticated_context, authorized_issue
from .services import ReviewError, apply_command, blank_review, summarize


def _denied(error):
    return JsonResponse({"error": error.code}, status=error.status)


@require_GET
def health(request):
    # Liveness only; does not imply Jira or Forge are connected.
    return JsonResponse({"status": "ok", "service": "scopeproof-django", "kind": "liveness"})


@require_GET
def review_detail(request, issue_key):
    try:
        ctx = authenticated_context(request)
        issue = authorized_issue(ctx, issue_key)
    except AccessDenied as exc:
        return _denied(exc)

    record = Review.objects.filter(
        installation_id=ctx["installation"], issue_id=issue["id"],
    ).first()
    current = record.document if record else blank_review(issue)
    return JsonResponse({"review": current, "derived": summarize(current)})


@csrf_exempt  # FIT bearer authorization, not cookie-based authentication.
@require_POST
def review_command(request, issue_key):
    try:
        ctx = authenticated_context(request)
        issue = authorized_issue(ctx, issue_key, write=True)
    except AccessDenied as exc:
        return _denied(exc)

    if request.content_type != "application/json":
        return JsonResponse({"error": "JSON_REQUIRED"}, status=415)
    if len(request.body) > 16384:
        return JsonResponse({"error": "PAYLOAD_TOO_LARGE"}, status=413)
    try:
        payload = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"error": "INVALID_JSON"}, status=400)
    if not isinstance(payload, dict) or not isinstance(payload.get("command"), dict):
        return JsonResponse({"error": "INVALID_COMMAND"}, status=400)

    try:
        # PostgreSQL row lock protects concurrent writes to the same review.
        with transaction.atomic():
            Review.objects.get_or_create(
                installation_id=ctx["installation"],
                issue_id=issue["id"],
                defaults={
                    "issue_key": issue["key"],
                    "project_id": issue["projectId"],
                    "document": blank_review(issue),
                },
            )
            record = Review.objects.select_for_update().get(
                installation_id=ctx["installation"], issue_id=issue["id"],
            )
            current = record.document
            changed = apply_command(current, payload["command"], ctx["actor"])
            record.document = changed
            record.revision = changed["revision"]
            record.issue_key = issue["key"]
            record.project_id = issue["projectId"]
            record.save(update_fields=[
                "document", "revision", "issue_key", "project_id", "updated_at",
            ])
    except ReviewError as exc:
        message = str(exc)
        code = 409 if message.startswith("CONFLICT") else 422 if message.startswith("APPROVAL_BLOCKED") else 400
        return JsonResponse({"error": message}, status=code)

    return JsonResponse({"review": changed, "derived": summarize(changed)})
