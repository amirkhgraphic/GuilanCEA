# Backend

## Stack
- Django 5+ with Ninja API routers, JWT auth, and Ninja schemas.
- PostgreSQL + Redis + Celery + Gunicorn orchestrated via Docker Compose.
- Traefik handles TLS termination and routing to `/api`, `/admin`, `/static`, `/media`.
- Metrics exporters (Prometheus, node exporter, PostgreSQL exporter) are wired in `docker-compose.yml`.

## Key apps

| App | Responsibilities |
| --- | --- |
| `users` | Custom `User` model, email verification, password resets, soft deletes. |
| `blog` | Posts, comments, categories/tags, likes, admin delete/restore operations. |
| `events` | Events, registrations, invitations, registration emails, Celery tasks. |
| `payments` | Discount codes, payment tracking linked to registrations. |

## API highlights
- **Authentication** (`/api/auth/*`): register, login, refresh, profile, delete profile picture, deleted users, filtered user lists.
- **Blog** (`/api/blog/*`): posts/comments, soft delete/restore, likes, categories/tags APIs.
- **Events** (`/api/events/*`): list, detail, create/update/delete, admin endpoints for event/registration detail and paginated/filterable registrations.
- **Payments** (`/api/payments/*`): create payment, get by ref, discounts.

## Running locally
```bash
docker compose build backend
docker compose run --rm backend python manage.py migrate
```

### Tests
```bash
docker compose run --rm backend python manage.py test --settings=config.settings.test
```

### Admin tooling
- Ninja routers live under `backend/api/views`. Schemas are in `backend/api/schemas`.
- JWT auth files: `backend/api/authentication.py`.
- Celery configs in `backend/config/services/celery.py` and tasks (events, users, communications).
