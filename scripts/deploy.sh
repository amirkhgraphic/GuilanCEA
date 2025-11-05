#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEFAULT_ENV_FILE="$ROOT_DIR/.env.production"
ENV_FILE="${ENV_FILE:-$DEFAULT_ENV_FILE}"

COMPOSE_ARGS=(docker compose)

if [[ -f "$ENV_FILE" ]]; then
  echo "Using environment file: $ENV_FILE"
  COMPOSE_ARGS+=(--env-file "$ENV_FILE")
else
  echo "Warning: environment file '$ENV_FILE' not found. Continuing without explicit env file." >&2
fi

"${COMPOSE_ARGS[@]}" pull
"${COMPOSE_ARGS[@]}" up -d --remove-orphans
