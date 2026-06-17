#!/usr/bin/env sh
set -eu

ROOT_DIR="${LEMMA_DEPLOY_ROOT:-/opt/lemma}"
ENV_FILE="${LEMMA_DEPLOY_ENV_FILE:-$ROOT_DIR/.env}"
STATE_FILE="${LEMMA_DEPLOY_STATE_FILE:-$ROOT_DIR/.active-color}"
COMPOSE_FILE="$ROOT_DIR/infra/production/compose.yml"
PROJECT_NAME="${LEMMA_COMPOSE_PROJECT:-lemma}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing deploy env file: $ENV_FILE" >&2
  exit 1
fi

current="$(cat "$STATE_FILE" 2>/dev/null || echo blue)"
if [ "$current" = "blue" ]; then
  previous="green"
else
  previous="blue"
fi

compose() {
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

compose up -d "api-$previous" "web-$previous" "admin-$previous"

for service in "api-$previous" "web-$previous" "admin-$previous"; do
  id="$(compose ps -q "$service")"
  attempts=0
  until [ "$(docker inspect --format '{{.State.Health.Status}}' "$id" 2>/dev/null || true)" = "healthy" ]; do
    attempts=$((attempts + 1))
    if [ "$attempts" -gt 60 ]; then
      echo "Rollback target unhealthy: $service" >&2
      exit 1
    fi
    sleep 2
  done
done

tmp_env="$(mktemp)"
grep -v '^LEMMA_ACTIVE_COLOR=' "$ENV_FILE" > "$tmp_env"
printf 'LEMMA_ACTIVE_COLOR=%s\n' "$previous" >> "$tmp_env"
mv "$tmp_env" "$ENV_FILE"
printf '%s\n' "$previous" > "$STATE_FILE"

compose up -d caddy
compose stop "api-$current" "web-$current" "admin-$current" || true
echo "Rolled back traffic to: $previous"
