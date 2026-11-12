import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings

from .models import LocalReview, Review


@override_settings(SCOPEPROOF_STANDALONE_AUTH=True)
class LocalReviewApiTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.alice = User.objects.create_user(username="alice", password="VerySecurePassword#12")
        self.bob = User.objects.create_user(username="bob", password="VerySecurePassword#34")
        self.browser = Client(enforce_csrf_checks=True)
        self.browser.force_login(self.alice)
        self.token = self.browser.get("/api/local/auth/session/").json()["csrfToken"]

    def send(self, endpoint, data, token=None, browser=None):
        client = browser or self.browser
        csrf = self.token if token is None else token
        return client.post(
            endpoint, data=json.dumps(data),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf,
        )

    def create(self):
        result = self.send("/api/local/reviews/new/", {
            "issueKey": "ACO-142", "summary": "Implement SSO authentication",
        })
        self.assertEqual(result.status_code, 201)
        return result.json()

    def command(self, kind, revision=0, **kwargs):
        return self.send("/api/local/reviews/ACO-142/commands/", {
            "command": {"type": kind, "expectedRevision": revision, **kwargs},
        })

    def test_anonymous_users_cannot_read_or_write(self):
        unauthenticated = Client(enforce_csrf_checks=True)
        self.assertEqual(unauthenticated.get("/api/local/reviews/").status_code, 401)
        self.assertEqual(unauthenticated.get("/api/local/reviews/ACO-142/").status_code, 401)
        self.assertEqual(unauthenticated.post(
            "/api/local/reviews/new/", data="{}", content_type="application/json"
        ).status_code, 403)  # CSRF blocks before the view

    def test_create_read_list_and_restart_persistence(self):
        created = self.create()
        self.assertEqual(created["review"]["issueKey"], "ACO-142")
        self.assertEqual(created["review"]["revision"], 0)
        self.assertEqual(created["derived"]["status"], "pending")
        fetched = self.browser.get("/api/local/reviews/ACO-142/").json()
        self.assertEqual(fetched, created)
        listed = self.browser.get("/api/local/reviews/?project=ACO").json()
        self.assertEqual(len(listed["reviews"]), 1)
        self.assertEqual(listed["reviews"][0]["issueKey"], "ACO-142")
        self.assertEqual(listed["reviews"][0]["revision"], 0)
        self.assertEqual(Review.objects.count(), 0)  # Forge store remains untouched.

    def test_user_isolation_and_404_for_other_owner(self):
        self.create()
        bob_browser = Client()
        bob_browser.force_login(self.bob)
        self.assertEqual(bob_browser.get("/api/local/reviews/").json()["reviews"], [])
        self.assertEqual(bob_browser.get("/api/local/reviews/ACO-142/").status_code, 404)
        self.assertEqual(bob_browser.post(
            "/api/local/reviews/ACO-142/commands/",
            data=json.dumps({"command": {"type": "approve", "expectedRevision": 0}}),
            content_type="application/json",
        ).status_code, 404)
        self.assertEqual(LocalReview.objects.count(), 1)

    def test_same_issue_key_allowed_for_different_users(self):
        self.create()
        bob_browser = Client(enforce_csrf_checks=True)
        bob_browser.force_login(self.bob)
        csrf = bob_browser.get("/api/local/auth/session/").json()["csrfToken"]
        response = self.send("/api/local/reviews/new/", {
            "issueKey": "ACO-142", "summary": "Different user's personal review",
        }, token=csrf, browser=bob_browser)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(LocalReview.objects.count(), 2)

    def test_revision_persistence_and_revalidation(self):
        self.create()
        req = self.command("addRequirement", title="SSO login needs MFA")
        self.assertEqual(req.status_code, 200)
        self.assertEqual(req.json()["review"]["revision"], 1)
        evidence = self.command("addEvidence", revision=1, requirementId="RQ-01",
                                title="MFA test", result="passed")
        self.assertEqual(evidence.status_code, 200)
        self.assertEqual(evidence.json()["derived"]["status"], "ready")
        approval = self.command("approve", revision=2)
        self.assertEqual(approval.status_code, 200)
        self.assertEqual(approval.json()["derived"]["status"], "approved")
        changed = self.command("publishVersion", revision=3, requirementId="RQ-01",
                               title="SSO login needs hardware token")
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(changed.json()["derived"]["status"], "revalidation")
        self.assertEqual(len(changed.json()["review"]["approvals"]), 1)
        self.assertEqual(self.browser.get("/api/local/reviews/ACO-142/").json(), changed.json())
        self.assertEqual(LocalReview.objects.get().revision, 4)

    def test_stale_revision_never_overwrites_another_change(self):
        self.create()
        first = self.command("addRequirement", title="Requirement one")
        self.assertEqual(first.status_code, 200)
        stale = self.command("addRequirement", title="Requirement two")
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(LocalReview.objects.get().revision, 1)
        self.assertEqual(len(LocalReview.objects.get().document["requirements"]), 1)

    def test_csrf_blocks_writes_without_valid_token(self):
        self.create()
        create_result = self.browser.post(
            "/api/local/reviews/new/", data=json.dumps({"issueKey": "ACO-143", "summary": "Another issue"}),
            content_type="application/json",
        )
        self.assertEqual(create_result.status_code, 403)
        command_result = self.browser.post(
            "/api/local/reviews/ACO-142/commands/",
            data=json.dumps({"command": {"type": "approve", "expectedRevision": 0}}),
            content_type="application/json",
        )
        self.assertEqual(command_result.status_code, 403)

    def test_validation_and_duplicate_prevention(self):
        self.create()
        duplicate = self.send("/api/local/reviews/new/", {
            "issueKey": "ACO-142", "summary": "Same issue again",
        })
        self.assertEqual(duplicate.status_code, 409)
        invalid = self.send("/api/local/reviews/new/", {
            "issueKey": "../../admin", "summary": "Invalid key",
        })
        self.assertEqual(invalid.status_code, 400)
        invalid_summary = self.send("/api/local/reviews/new/", {
            "issueKey": "ACO-143", "summary": "no",
        })
        self.assertEqual(invalid_summary.status_code, 400)
        self.assertEqual(self.browser.get("/api/local/reviews/?project=$bad").status_code, 400)

    def test_approval_blocked_by_missing_evidence(self):
        self.create()
        req = self.command("addRequirement", title="Require valid proof")
        self.assertEqual(req.status_code, 200)
        blocked = self.command("approve", revision=1)
        self.assertEqual(blocked.status_code, 422)
        self.assertEqual(LocalReview.objects.get().revision, 1)

    @override_settings(SCOPEPROOF_STANDALONE_AUTH=False)
    def test_local_api_disabled_without_standalone_setting(self):
        self.assertEqual(self.browser.get("/api/local/reviews/").status_code, 404)
        self.assertEqual(self.browser.get("/api/local/reviews/ACO-142/").status_code, 404)
        self.assertEqual(self.send("/api/local/reviews/new/", {
            "issueKey": "ACO-142", "summary": "Should not be created",
        }).status_code, 404)
        self.assertEqual(LocalReview.objects.count(), 0)
