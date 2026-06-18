#!/usr/bin/env sh
set -eu

ROOT_DIR="${LEMMA_DEPLOY_ROOT:-/opt/lemma}"
ENV_FILE="${LEMMA_DEPLOY_ENV_FILE:-$ROOT_DIR/.env}"
STATE_FILE="${LEMMA_DEPLOY_STATE_FILE:-$ROOT_DIR/.active-color}"
LOCK_FILE="${LEMMA_DEPLOY_LOCK_FILE:-$ROOT_DIR/.deploy.lock}"
COMPOSE_FILE="$ROOT_DIR/infra/production/compose.yml"
PROJECT_NAME="${LEMMA_COMPOSE_PROJECT:-lemma}"

mkdir -p "$ROOT_DIR" "$ROOT_DIR/infra/production" "$ROOT_DIR/infra/garage"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another deploy is already running." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing deploy env file: $ENV_FILE" >&2
  exit 1
fi

env_value() {
  key="$1"
  default="${2-}"
  value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
  if [ -n "$value" ]; then
    printf '%s' "$value"
  else
    printf '%s' "$default"
  fi
}

is_placeholder() {
  case "$1" in
    "" | replace-me | replace-with-* | "*.example.com" | "https://lemma.example.com" | "https://api.lemma.example.com" | "https://admin.lemma.example.com" | "https://auth.lemma.example.com"* | "https://realtime.lemma.example.com")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

require_env() {
  key="$1"
  value="$(env_value "$key")"
  if is_placeholder "$value"; then
    echo "Missing production value for $key in $ENV_FILE" >&2
    exit 1
  fi
  printf '%s' "$value"
}

require_hex_env() {
  key="$1"
  expected_length="$2"
  value="$(require_env "$key")"
  if [ "${#value}" -ne "$expected_length" ]; then
    echo "$key must be $expected_length hex characters in $ENV_FILE" >&2
    exit 1
  fi
  case "$value" in
    *[!0123456789abcdefABCDEF]*)
      echo "$key must contain only hex characters in $ENV_FILE" >&2
      exit 1
      ;;
  esac
  printf '%s' "$value"
}

set_env() {
  key="$1"
  value="$2"
  tmp_env="$(mktemp "$ROOT_DIR/.env.tmp.XXXXXX")"
  grep -v "^${key}=" "$ENV_FILE" > "$tmp_env" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp_env"
  chmod 600 "$tmp_env"
  mv "$tmp_env" "$ENV_FILE"
}

ensure_env() {
  key="$1"
  value="$2"
  current_value="$(env_value "$key")"
  if is_placeholder "$current_value"; then
    set_env "$key" "$value"
  fi
}

set_color_tag() {
  color="$1"
  value="$2"
  if [ "$color" = "blue" ]; then
    set_env LEMMA_BLUE_IMAGE_TAG "$value"
  else
    set_env LEMMA_GREEN_IMAGE_TAG "$value"
  fi
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

current="$(cat "$STATE_FILE" 2>/dev/null || env_value LEMMA_ACTIVE_COLOR)"
case "$current" in
  blue)
    next="green"
    ;;
  green)
    next="blue"
    ;;
  *)
    current=""
    next="blue"
    ;;
esac

requested_tag="${LEMMA_IMAGE_TAG:-$(env_value LEMMA_IMAGE_TAG)}"
if is_placeholder "$requested_tag"; then
  echo "Set LEMMA_IMAGE_TAG to the immutable image tag to deploy." >&2
  exit 1
fi

ensure_env LEMMA_BLUE_IMAGE_TAG "$requested_tag"
ensure_env LEMMA_GREEN_IMAGE_TAG "$requested_tag"
set_color_tag "$next" "$requested_tag"
set_env LEMMA_IMAGE_TAG "$requested_tag"
set_env LEMMA_SHARED_IMAGE_TAG "$requested_tag"

require_env CLOUDFLARE_API_TOKEN >/dev/null
GARAGE_RPC_SECRET="$(require_hex_env GARAGE_RPC_SECRET 64)"
GARAGE_ADMIN_TOKEN="$(require_env GARAGE_ADMIN_TOKEN)"
GARAGE_METRICS_TOKEN="$(require_env GARAGE_METRICS_TOKEN)"

cat > "$ROOT_DIR/infra/garage/garage.toml" <<EOF
metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"

replication_factor = 1
rpc_bind_addr = "[::]:3901"
rpc_public_addr = "garage:3901"
rpc_secret = "$GARAGE_RPC_SECRET"

[s3_api]
s3_region = "garage"
api_bind_addr = "[::]:3900"
root_domain = ".s3.garage.localhost"

[s3_web]
bind_addr = "[::]:3902"
root_domain = ".web.garage.localhost"
index = "index.html"

[admin]
api_bind_addr = "[::]:3903"
admin_token = "$GARAGE_ADMIN_TOKEN"
metrics_token = "$GARAGE_METRICS_TOKEN"
EOF

LEMMA_WEB_APP_URL="$(json_escape "$(require_env LEMMA_WEB_APP_URL)")"
LEMMA_WEB_OIDC_CLIENT_ID="$(json_escape "$(env_value LEMMA_WEB_OIDC_CLIENT_ID lemma-web)")"
LEMMA_ADMIN_APP_URL="$(json_escape "$(require_env LEMMA_ADMIN_APP_URL)")"
LEMMA_ADMIN_OIDC_CLIENT_ID="$(json_escape "$(env_value LEMMA_ADMIN_OIDC_CLIENT_ID lemma-admin)")"
LEMMA_OIDC_AUDIENCE="$(json_escape "$(env_value LEMMA_OIDC_AUDIENCE lemma-api)")"

cat > "$ROOT_DIR/infra/production/keycloak-realm.json" <<EOF
{
  "realm": "lemma",
  "enabled": true,
  "registrationAllowed": true,
  "loginWithEmailAllowed": true,
  "resetPasswordAllowed": true,
  "verifyEmail": false,
  "clients": [
    {
      "clientId": "$LEMMA_WEB_OIDC_CLIENT_ID",
      "name": "Lemma Web",
      "enabled": true,
      "publicClient": true,
      "standardFlowEnabled": true,
      "implicitFlowEnabled": false,
      "directAccessGrantsEnabled": false,
      "serviceAccountsEnabled": false,
      "redirectUris": ["$LEMMA_WEB_APP_URL/*", "$LEMMA_WEB_APP_URL"],
      "webOrigins": ["$LEMMA_WEB_APP_URL"],
      "attributes": {
        "pkce.code.challenge.method": "S256"
      },
      "protocol": "openid-connect",
      "protocolMappers": [
        {
          "name": "lemma-api-audience",
          "protocol": "openid-connect",
          "protocolMapper": "oidc-audience-mapper",
          "consentRequired": false,
          "config": {
            "included.client.audience": "$LEMMA_OIDC_AUDIENCE",
            "access.token.claim": "true",
            "id.token.claim": "false"
          }
        }
      ]
    },
    {
      "clientId": "$LEMMA_ADMIN_OIDC_CLIENT_ID",
      "name": "Lemma Admin",
      "enabled": true,
      "publicClient": true,
      "standardFlowEnabled": true,
      "implicitFlowEnabled": false,
      "directAccessGrantsEnabled": false,
      "serviceAccountsEnabled": false,
      "fullScopeAllowed": true,
      "defaultClientScopes": ["web-origins", "acr", "profile", "roles", "email"],
      "optionalClientScopes": ["address", "phone", "offline_access", "microprofile-jwt"],
      "redirectUris": ["$LEMMA_ADMIN_APP_URL/*", "$LEMMA_ADMIN_APP_URL"],
      "webOrigins": ["$LEMMA_ADMIN_APP_URL"],
      "attributes": {
        "pkce.code.challenge.method": "S256"
      },
      "protocol": "openid-connect",
      "protocolMappers": [
        {
          "name": "lemma-subject",
          "protocol": "openid-connect",
          "protocolMapper": "oidc-usermodel-property-mapper",
          "consentRequired": false,
          "config": {
            "user.attribute": "id",
            "claim.name": "sub",
            "jsonType.label": "String",
            "access.token.claim": "true",
            "id.token.claim": "false",
            "userinfo.token.claim": "false",
            "introspection.token.claim": "true"
          }
        },
        {
          "name": "lemma-api-audience",
          "protocol": "openid-connect",
          "protocolMapper": "oidc-audience-mapper",
          "consentRequired": false,
          "config": {
            "included.client.audience": "$LEMMA_OIDC_AUDIENCE",
            "access.token.claim": "true",
            "id.token.claim": "false"
          }
        }
      ]
    },
    {
      "clientId": "$LEMMA_OIDC_AUDIENCE",
      "name": "Lemma API",
      "enabled": true,
      "bearerOnly": true,
      "protocol": "openid-connect"
    }
  ]
}
EOF

compose() {
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

wait_for_healthy() {
  service="$1"
  echo "Waiting for $service"
  id="$(compose ps -q "$service")"
  if [ -z "$id" ]; then
    echo "Service did not start: $service" >&2
    exit 1
  fi
  attempts=0
  until [ "$(docker inspect --format '{{.State.Health.Status}}' "$id" 2>/dev/null || true)" = "healthy" ]; do
    attempts=$((attempts + 1))
    if [ "$attempts" -gt 60 ]; then
      echo "Health check failed: $service" >&2
      compose logs "$service" >&2
      compose stop "api-$next" "web-$next" "admin-$next" || true
      exit 1
    fi
    sleep 2
  done
}

echo "Deploying image tag $requested_tag to color: $next"
compose pull
compose up -d postgres garage postgres-keycloak keycloak centrifugo libreoffice-worker
compose up garage-cors
compose run --rm migrate
compose up -d "api-$next" "web-$next" "admin-$next"

wait_for_healthy "api-$next"
wait_for_healthy "web-$next"
wait_for_healthy "admin-$next"

set_env LEMMA_ACTIVE_COLOR "$next"
printf '%s\n' "$next" > "$STATE_FILE"

compose up -d --force-recreate caddy
compose up -d worker

if [ -n "$current" ]; then
  compose stop "api-$current" "web-$current" "admin-$current" || true
fi

docker image prune -f
echo "Deploy complete: $next"
