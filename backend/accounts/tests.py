import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings


@override_settings(SCOPEPROOF_STANDALONE_AUTH=True, SCOPEPROOF_ALLOW_SIGNUP=True)
class StandaloneAuthTests(TestCase):
    def setUp(self):
        self.browser = Client(enforce_csrf_checks=True)

    def csrf(self):
        response = self.browser.get("/api/local/auth/session/")
        self.assertEqual(response.status_code, 200)
        return response.json()["csrfToken"]

    def post(self, path, payload, csrf=None):
        headers = {"HTTP_X_CSRFTOKEN": csrf} if csrf else {}
        return self.browser.post(path, data=json.dumps(payload),
                                 content_type="application/json", **headers)

    def test_anonymous_session_and_login_required(self):
        state = self.browser.get("/api/local/auth/session/").json()
        self.assertFalse(state["authenticated"])
        self.assertIsNone(state["username"])

    def test_create_user_and_login_with_real_session(self):
        token = self.csrf()
        result = self.post("/api/local/auth/register/", {
            "username": "sample_user", "password": "LongDemoPassword#83",
        }, token)
        self.assertEqual(result.status_code, 201)
        self.assertEqual(result.json()["username"], "sample_user")
        self.assertEqual(get_user_model().objects.count(), 1)
        session = self.browser.get("/api/local/auth/session/").json()
        self.assertTrue(session["authenticated"])
        logout_response = self.post("/api/local/auth/logout/", {}, session["csrfToken"])
        self.assertEqual(logout_response.status_code, 200)
        self.assertFalse(self.browser.get("/api/local/auth/session/").json()["authenticated"])
        login_token = self.csrf()
        logged_in = self.post("/api/local/auth/login/", {
            "username": "sample_user", "password": "LongDemoPassword#83",
        }, login_token)
        self.assertEqual(logged_in.status_code, 200)
        self.assertTrue(logged_in.json()["authenticated"])

    def test_invalid_password_is_rejected(self):
        get_user_model().objects.create_user(username="sample_user", password="LongDemoPassword#83")
        resp = self.post("/api/local/auth/login/", {
            "username": "sample_user", "password": "wrong-password",
        }, self.csrf())
        self.assertEqual(resp.status_code, 401)
        self.assertFalse(self.browser.get("/api/local/auth/session/").json()["authenticated"])

    def test_login_requires_csrf(self):
        get_user_model().objects.create_user(username="sample_user", password="LongDemoPassword#83")
        self.csrf()
        resp = self.post("/api/local/auth/login/", {
            "username": "sample_user", "password": "LongDemoPassword#83",
        })
        self.assertEqual(resp.status_code, 403)

    def test_duplicate_user_and_weak_password(self):
        token = self.csrf()
        payload = {"username": "sample_user", "password": "LongDemoPassword#83"}
        self.assertEqual(self.post("/api/local/auth/register/", payload, token).status_code, 201)
        csrf = self.browser.get("/api/local/auth/session/").json()["csrfToken"]
        self.assertEqual(self.post("/api/local/auth/register/", payload, csrf).status_code, 409)
        weak = self.post("/api/local/auth/register/", {
            "username": "another_user", "password": "abc",
        }, csrf)
        self.assertEqual(weak.status_code, 400)

    @override_settings(SCOPEPROOF_ALLOW_SIGNUP=False)
    def test_registration_is_disabled_when_flag_off(self):
        token = self.csrf()
        resp = self.post("/api/local/auth/register/", {
            "username": "sample_user", "password": "LongDemoPassword#83",
        }, token)
        self.assertEqual(resp.status_code, 403)

    @override_settings(SCOPEPROOF_STANDALONE_AUTH=False)
    def test_standalone_auth_can_be_disabled_for_forge(self):
        resp = self.browser.get("/api/local/auth/session/")
        self.assertEqual(resp.status_code, 404)
