#!/usr/bin/env bash
set -euo pipefail

: "${DJANGO_WSGI_MODULE:=config.wsgi:application}"
: "${DATABASE_URL:=postgres://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@db:5432/${DB_NAME:-app}}"

# wait for db
host="db"
port="5432"
for i in {1..60}; do
  if nc -z "$host" "$port"; then
    echo "DB ready"
    break
  fi
  echo "Waiting for DB... ($i)"
  sleep 2
done

python manage.py migrate --noinput || true
python manage.py collectstatic --noinput || true

# Start gunicorn (API)
( exec gunicorn "$DJANGO_WSGI_MODULE" --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-3} --threads ${GUNICORN_THREADS:-2} --timeout 60 ) &

# Start nginx (Frontend)
exec nginx -g "daemon off;"
