from .base import *

# Lightweight defaults keep local/CI test runs isolated from production infra.

TEST_DB_ENGINE = config("TEST_DB_ENGINE", default="django.db.backends.sqlite3")
TEST_DB_NAME = config("TEST_DB_NAME", default=str(BASE_DIR / "db.test.sqlite3"))
TEST_DB_USER = config("TEST_DB_USER", default="")
TEST_DB_PASSWORD = config("TEST_DB_PASSWORD", default="")
TEST_DB_HOST = config("TEST_DB_HOST", default="")
TEST_DB_PORT = config("TEST_DB_PORT", default="")

DATABASES["default"] = {
    "ENGINE": TEST_DB_ENGINE,
    "NAME": TEST_DB_NAME,
    "USER": TEST_DB_USER,
    "PASSWORD": TEST_DB_PASSWORD,
    "HOST": TEST_DB_HOST,
    "PORT": TEST_DB_PORT,
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Tests should not enforce HTTPS-only cookies to simplify client simulations.
CSRF_COOKIE_SECURE = False
SESSION_COOKIE_SECURE = False

# Silence verbose INFO logs (e.g., Celery task output) during tests.
LOGGING["handlers"]["console"]["level"] = "ERROR"  # type: ignore[index]
LOGGING["root"]["level"] = "ERROR"  # type: ignore[index]
if "django" in LOGGING["loggers"]:
    LOGGING["loggers"]["django"]["level"] = "ERROR"  # type: ignore[index]
if "apps" in LOGGING["loggers"]:
    LOGGING["loggers"]["apps"]["level"] = "ERROR"  # type: ignore[index]
