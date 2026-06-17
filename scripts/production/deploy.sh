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

current="$(cat "$STATE_FILE" 2>/dev/null || true)"
if [ "$current" = "blue" ]; then
  next="green"
else
  next="blue"
fi

if [ "${LEMMA_IMAGE_TAG:-}" ]; then
  tmp_env="$(mktemp)"
  grep -v '^LEMMA_IMAGE_TAG=' "$ENV_FILE" > "$tmp_env"
  printf 'LEMMA_IMAGE_TAG=%s\n' "$LEMMA_IMAGE_TAG" >> "$tmp_env"
  mv "$tmp_env" "$ENV_FILE"
fi

set -a
. "$ENV_FILE"
set +a

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
      "clientId": "${LEMMA_WEB_OIDC_CLIENT_ID:-lemma-web}",
      "name": "Lemma Web",
      "enabled": true,
      "publicClient": true,
      "standardFlowEnabled": true,
      "implicitFlowEnabled": false,
      "directAccessGrantsEnabled": false,
      "serviceAccountsEnabled": false,
      "redirectUris": ["${LEMMA_WEB_APP_URL}/*", "${LEMMA_WEB_APP_URL}"],
      "webOrigins": ["${LEMMA_WEB_APP_URL}"],
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
            "included.client.audience": "${LEMMA_OIDC_AUDIENCE:-lemma-api}",
            "access.token.claim": "true",
            "id.token.claim": "false"
          }
        }
      ]
    },
    {
      "clientId": "${LEMMA_ADMIN_OIDC_CLIENT_ID:-lemma-admin}",
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
      "redirectUris": ["${LEMMA_ADMIN_APP_URL}/*", "${LEMMA_ADMIN_APP_URL}"],
      "webOrigins": ["${LEMMA_ADMIN_APP_URL}"],
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
            "included.client.audience": "${LEMMA_OIDC_AUDIENCE:-lemma-api}",
            "access.token.claim": "true",
            "id.token.claim": "false"
          }
        }
      ]
    },
    {
      "clientId": "${LEMMA_OIDC_AUDIENCE:-lemma-api}",
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

echo "Deploying color: $next"
compose pull
compose up -d postgres garage postgres-keycloak keycloak centrifugo libreoffice-worker
compose up garage-cors
compose run --rm migrate
compose up -d "api-$next" "web-$next" "admin-$next"

for service in "api-$next" "web-$next" "admin-$next"; do
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
      compose stop "api-$next" "web-$next" "admin-$next"
      exit 1
    fi
    sleep 2
  done
done

tmp_env="$(mktemp)"
grep -v '^LEMMA_ACTIVE_COLOR=' "$ENV_FILE" > "$tmp_env"
printf 'LEMMA_ACTIVE_COLOR=%s\n' "$next" >> "$tmp_env"
mv "$tmp_env" "$ENV_FILE"
printf '%s\n' "$next" > "$STATE_FILE"

compose up -d caddy worker

if [ -n "$current" ]; then
  compose stop "api-$current" "web-$current" "admin-$current" || true
fi

docker image prune -f
echo "Deploy complete: $next"
