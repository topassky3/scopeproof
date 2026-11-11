import json
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase, override_settings

from .models import Review
from .security import AccessDenied
from .services import ReviewError, apply_command, blank_review, summarize


ISSUE = {"id": "142", "key": "AC-142", "summary": "Implement SSO",
         "projectId": "15", "projectKey": "AC"}
APP_ID = "ari:cloud:ecosystem::app/77334c21-3dd0-474f-a53f-28b4eeee5a71"


def change(review, kind, **fields):
    return apply_command(review, {"type": kind, "expectedRevision": review["revision"], **fields}, "tester")


class ReviewRuleTests(SimpleTestCase):
    def test_requirement_version_invalidates_previous_approval(self):
        review = blank_review(ISSUE)
        review = change(review, "addRequirement", title="SSO login enabled")
        review = change(review, "addEvidence", requirementId="RQ-01", title="SSO test", result="passed")
        review = change(review, "approve")
        self.assertEqual(summarize(review)["status"], "approved")
        review = change(review, "publishVersion", requirementId="RQ-01", title="SSO with mandatory MFA")
        state = summarize(review)
        self.assertEqual(state["status"], "revalidation")
        self.assertEqual(state["rows"][0]["state"], "stale")
        self.assertEqual(len(review["approvals"]), 1)

    def test_fresh_evidence_can_approve_and_preserve_history(self):
        review = blank_review(ISSUE)
        review = change(review, "addRequirement", title="SSO login enabled")
        review = change(review, "addEvidence", requirementId="RQ-01", title="SSO test", result="passed")
        review = change(review, "approve")
        review = change(review, "publishVersion", requirementId="RQ-01", title="SSO with mandatory MFA")
        review = change(review, "addEvidence", requirementId="RQ-01", title="MFA test", result="passed")
        review = change(review, "approve")
        self.assertEqual(summarize(review)["status"], "approved")
        self.assertEqual(len(review["approvals"]), 2)
        self.assertEqual(len(review["requirements"][0]["versions"]), 2)

    def test_reject_approval_with_missing_evidence(self):
        review = change(blank_review(ISSUE), "addRequirement", title="Mandatory SSO evidence")
        with self.assertRaisesRegex(ReviewError, "APPROVAL_BLOCKED"):
            change(review, "approve")

    def test_failed_latest_evidence_blocks_approval(self):
        review = change(blank_review(ISSUE), "addRequirement", title="Mandatory SSO evidence")
        review = change(review, "addEvidence", requirementId="RQ-01", title="Passing test", result="passed")
        review = change(review, "addEvidence", requirementId="RQ-01", title="Failed test", result="failed")
        self.assertEqual(summarize(review)["rows"][0]["state"], "failed")
        with self.assertRaisesRegex(ReviewError, "APPROVAL_BLOCKED"):
            change(review, "approve")

    def test_revision_mismatch_detected(self):
        review = change(blank_review(ISSUE), "addRequirement", title="Required SSO evidence")
        with self.assertRaisesRegex(ReviewError, "CONFLICT"):
            apply_command(review, {"type": "approve", "expectedRevision": 0}, "tester")


@override_settings(SCOPEPROOF_FORGE_APP_ID=APP_ID)
class RemoteApiTests(TestCase):
    def test_health_does_not_claim_jira_is_connected(self):
        data = self.client.get("/health/").json()
        self.assertEqual(data["kind"], "liveness")

    def test_read_requires_forge_invocation_token(self):
        response = self.client.get("/api/v1/reviews/AC-142/")
        self.assertEqual(response.status_code, 401)

    def test_write_requires_forge_invocation_token(self):
        response = self.client.post(
            "/api/v1/reviews/AC-142/commands/",
            data=json.dumps({"command": {"type": "addRequirement", "expectedRevision": 0, "title": "New SSO requirement"}}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    def test_tenant_isolation_and_revision_persistence(self):
        first = {"installation": "tenant-A", "actor": "account-1"}
        second = {"installation": "tenant-B", "actor": "account-2"}
        payload = {"command": {"type": "addRequirement", "expectedRevision": 0, "title": "SSO test evidence"}}
        with patch("reviews.views.authenticated_context", return_value=first), patch(
            "reviews.views.authorized_issue", return_value=ISSUE
        ):
            result = self.client.post("/api/v1/reviews/AC-142/commands/",
                                      data=json.dumps(payload), content_type="application/json")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["review"]["revision"], 1)
        self.assertEqual(Review.objects.count(), 1)
        with patch("reviews.views.authenticated_context", return_value=second), patch(
            "reviews.views.authorized_issue", return_value=ISSUE
        ):
            view = self.client.get("/api/v1/reviews/AC-142/")
        self.assertEqual(view.json()["review"]["revision"], 0)
        self.assertEqual(Review.objects.count(), 1)

    def test_stale_revision_returns_conflict(self):
        ctx = {"installation": "tenant-A", "actor": "account-1"}
        payload = {"command": {"type": "addRequirement", "expectedRevision": 0, "title": "Mandatory SSO test"}}
        with patch("reviews.views.authenticated_context", return_value=ctx), patch(
            "reviews.views.authorized_issue", return_value=ISSUE
        ):
            first = self.client.post("/api/v1/reviews/AC-142/commands/",
                                     data=json.dumps(payload), content_type="application/json")
            stale = self.client.post("/api/v1/reviews/AC-142/commands/",
                                     data=json.dumps(payload), content_type="application/json")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(Review.objects.get().revision, 1)

    def test_project_list_requires_forge_invocation_token(self):
        response = self.client.get("/api/v1/projects/AC/reviews/")
        self.assertEqual(response.status_code, 401)

    def test_project_list_rejects_invalid_project_key(self):
        response = self.client.get("/api/v1/projects/AC$OTHER/reviews/")
        self.assertEqual(response.status_code, 400)

    def test_project_list_excludes_other_tenants_and_inaccessible_issues(self):
        available = change(blank_review(ISSUE), "addRequirement", title="Mandatory SSO evidence")
        Review.objects.create(
            installation_id="tenant-A", issue_id="142", issue_key="AC-142",
            project_id="15", document=available, revision=available["revision"],
        )
        Review.objects.create(
            installation_id="tenant-A", issue_id="143", issue_key="AC-143",
            project_id="15", document=blank_review({**ISSUE, "id": "143", "key": "AC-143"}),
        )
        Review.objects.create(
            installation_id="tenant-B", issue_id="144", issue_key="AC-144",
            project_id="15", document=blank_review({**ISSUE, "id": "144", "key": "AC-144"}),
        )
        Review.objects.create(
            installation_id="tenant-A", issue_id="145", issue_key="OTHER-145",
            project_id="19", document=blank_review({**ISSUE, "id": "145", "key": "OTHER-145", "projectId": "19"}),
        )

        def permissions(_ctx, key, **_kwargs):
            if key == "AC-143":
                raise AccessDenied("JIRA_ISSUE_NOT_ACCESSIBLE", 403)
            return ISSUE

        ctx = {"installation": "tenant-A", "actor": "account-1"}
        with patch("reviews.views.authenticated_context", return_value=ctx), patch(
            "reviews.views.jira_get", return_value={"id": "15"}
        ), patch("reviews.views.authorized_issue", side_effect=permissions):
            result = self.client.get("/api/v1/projects/AC/reviews/")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json(), {"reviews": [{
            "issueKey": "AC-142", "summary": "Implement SSO", "status": "in-review",
            "covered": 0, "mandatory": 1,
        }]})

    def test_project_list_requires_project_access(self):
        ctx = {"installation": "tenant-A", "actor": "account-1"}
        with patch("reviews.views.authenticated_context", return_value=ctx), patch(
            "reviews.views.jira_get", side_effect=AccessDenied("JIRA_ISSUE_NOT_ACCESSIBLE", 403)
        ):
            response = self.client.get("/api/v1/projects/AC/reviews/")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"], "JIRA_ISSUE_NOT_ACCESSIBLE")
