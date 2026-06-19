#!/usr/bin/env sh
set -eu

ROOT_DIR="${LEMMA_DEPLOY_ROOT:-/opt/lemma}"
ENV_FILE="${LEMMA_DEPLOY_ENV_FILE:-$ROOT_DIR/.env}"
STATE_ENV_FILE="${LEMMA_DEPLOY_STATE_ENV_FILE:-$ROOT_DIR/.deploy-state.env}"
STATE_FILE="${LEMMA_DEPLOY_STATE_FILE:-$ROOT_DIR/.active-color}"
LOCK_FILE="${LEMMA_DEPLOY_LOCK_FILE:-$ROOT_DIR/.deploy.lock}"
COMPOSE_FILE="$ROOT_DIR/infra/production/compose.yml"
PROJECT_NAME="${LEMMA_COMPOSE_PROJECT:-lemma}"

touch "$STATE_ENV_FILE"
chmod 600 "$STATE_ENV_FILE"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another deploy or rollback is already running." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing deploy env file: $ENV_FILE" >&2
  exit 1
fi

env_value() {
  key="$1"
  default="${2-}"
  value="$(grep -E "^${key}=" "$STATE_ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
  if [ -z "$value" ]; then
    value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
  fi
  if [ -n "$value" ]; then
    printf '%s' "$value"
  else
    printf '%s' "$default"
  fi
}

set_env() {
  key="$1"
  value="$2"
  tmp_env="$(mktemp "$ROOT_DIR/.deploy-state.env.tmp.XXXXXX")"
  grep -v "^${key}=" "$STATE_ENV_FILE" > "$tmp_env" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp_env"
  chmod 600 "$tmp_env"
  mv "$tmp_env" "$STATE_ENV_FILE"
}

current="$(cat "$STATE_FILE" 2>/dev/null || env_value LEMMA_ACTIVE_COLOR blue)"
case "$current" in
  blue)
    previous="green"
    previous_tag="$(env_value LEMMA_GREEN_IMAGE_TAG)"
    ;;
  green)
    previous="blue"
    previous_tag="$(env_value LEMMA_BLUE_IMAGE_TAG)"
    ;;
  *)
    echo "Unknown active color: $current" >&2
    exit 1
    ;;
esac

if [ -z "$previous_tag" ]; then
  echo "No stored image tag for rollback color: $previous" >&2
  exit 1
fi

compose() {
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" --env-file "$STATE_ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

wait_for_healthy() {
  service="$1"
  id="$(compose ps -q "$service")"
  if [ -z "$id" ]; then
    echo "Service did not start: $service" >&2
    exit 1
  fi
  attempts=0
  until [ "$(docker inspect --format '{{.State.Health.Status}}' "$id" 2>/dev/null || true)" = "healthy" ]; do
    attempts=$((attempts + 1))
    if [ "$attempts" -gt 60 ]; then
      echo "Rollback target unhealthy: $service" >&2
      compose logs "$service" >&2
      exit 1
    fi
    sleep 2
  done
}

echo "Rolling back app traffic from $current to $previous using image tag $previous_tag"
compose up -d "api-$previous" "web-$previous" "admin-$previous"

wait_for_healthy "api-$previous"
wait_for_healthy "web-$previous"
wait_for_healthy "admin-$previous"

set_env LEMMA_ACTIVE_COLOR "$previous"
printf '%s\n' "$previous" > "$STATE_FILE"

compose up -d --force-recreate caddy
compose stop "api-$current" "web-$current" "admin-$current" || true
echo "Rolled back traffic to: $previous"
