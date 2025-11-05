# CI/CD GitHub Secrets

The CI/CD workflow defined in `.github/workflows/ci-cd.yml` expects the following repository secrets to be configured so that builds, image publishing, and deployments succeed.

| Secret | Used for | Notes |
| --- | --- | --- |
| `SECRET_KEY` | Django runtime | Primary Django secret key shared across services. |
| `DEBUG` | Django runtime | Set to `False` in production. |
| `ALLOWED_HOSTS` | Django runtime | Comma-separated hostnames permitted by Django. |
| `DB_ENGINE` | Database connection | Typically `django.db.backends.postgresql`. |
| `DB_NAME` | Database connection | Production PostgreSQL database name. |
| `DB_USER` | Database connection | PostgreSQL username with migration permissions. |
| `DB_PASSWORD` | Database connection | PostgreSQL user password. |
| `DB_HOST` | Database connection | Hostname or service name for PostgreSQL (e.g. `db`). |
| `DB_PORT` | Database connection | Usually `5432`. |
| `REDIS_URL` | Django/Celery runtime | Full Redis connection string, e.g. `redis://:password@redis:6379/0`. |
| `REDIS_PASSWORD` | Redis container | Plain password supplied to the Redis service. |
| `DJANGO_SETTINGS_MODULE` | Django runtime | Fully-qualified settings module (e.g. `config.settings.production`). |
| `LETSENCRYPT_EMAIL` | Traefik ACME | Email address used to request TLS certificates. |
| `NEXT_HOST` | Traefik routing | Hostname that should serve the frontend site. |
| `EMAIL_BACKEND` | Django runtime | Email backend setting, e.g. `django.core.mail.backends.smtp.EmailBackend`. |
| `JWT_SECRET_KEY` | API authentication | Secret for JWT token signing (falls back to `SECRET_KEY` if not set). |
| `CORS_ALLOWED_ORIGINS` | Django runtime | Comma-separated list of allowed origins. |
| `REGISTRY_URL` | Container registry | Domain of the registry (e.g. `ghcr.io`). |
| `REGISTRY_USERNAME` | Container registry | Username or service account for the registry. |
| `REGISTRY_PASSWORD` | Container registry | Access token or password with push and pull permissions. |

If additional environment variables are required by Django (such as `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, or third-party API keys), create matching repository secrets and update the `.env` generation steps in the workflow accordingly.
