"""Scopeproof Django remote API. No shared secrets or Jira credentials in source."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.getenv("DJANGO_DEBUG") == "1"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    raise RuntimeError("Set DJANGO_SECRET_KEY in the environment before starting Django.")

ALLOWED_HOSTS = [x.strip() for x in os.getenv("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",") if x.strip()]
INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "accounts",
    "reviews",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = []
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# SQLite for local development ONLY; PostgreSQL is required for production
# transactional row locking and safe multi-worker updates.
if os.getenv("SCOPEPROOF_DB_ENGINE") == "postgres":
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["POSTGRES_DB"],
        "USER": os.environ["POSTGRES_USER"],
        "PASSWORD": os.environ["POSTGRES_PASSWORD"],
        "HOST": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }}
else:
    if not DEBUG:
        raise RuntimeError("Production requires PostgreSQL. Set SCOPEPROOF_DB_ENGINE=postgres.")
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }}

USE_TZ = True
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_NAME = "scopeproof_sessionid"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_NAME = "scopeproof_csrftoken"
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = not DEBUG

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Standalone Django accounts are separate from Forge/Jira sessions.
SCOPEPROOF_STANDALONE_AUTH = DEBUG or os.getenv("SCOPEPROOF_STANDALONE_AUTH") == "1"
# Public sign-up is permitted only in local DEBUG unless explicitly enabled later.
SCOPEPROOF_ALLOW_SIGNUP = DEBUG and os.getenv("SCOPEPROOF_ALLOW_SIGNUP", "1") == "1"

# Read from the registered Forge app, NEVER from the token itself.
SCOPEPROOF_FORGE_APP_ID = os.getenv("SCOPEPROOF_FORGE_APP_ID", "")
