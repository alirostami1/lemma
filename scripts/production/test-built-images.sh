#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
IMAGE_OWNER="${LEMMA_IMAGE_OWNER:-local}"
IMAGE_TAG="${LEMMA_IMAGE_TAG:-test}"
PROJECT_NAME="${LEMMA_COMPOSE_PROJECT:-lemma-image-test}"
COMPOSE_FILE="$ROOT_DIR/infra/production/compose.test-built.yml"

build_image() {
  image="$1"
  dockerfile="$2"
  shift 2

  docker buildx build \
    --load \
    -t "ghcr.io/$IMAGE_OWNER/$image:$IMAGE_TAG" \
    -f "$dockerfile" \
    "$@" \
    "$ROOT_DIR"
}

build_image lemma-api apps/api/Dockerfile
build_image lemma-worker apps/worker/Dockerfile
build_image \
  lemma-web \
  apps/web/Dockerfile \
  --build-arg "LEMMA_WEB_APP_TITLE=${LEMMA_WEB_APP_TITLE:-Lemma}" \
  --build-arg "LEMMA_WEB_APP_URL=${LEMMA_WEB_APP_URL:-http://localhost:3000}" \
  --build-arg "LEMMA_WEB_API_URL=${LEMMA_WEB_API_URL:-http://localhost:3001}" \
  --build-arg "LEMMA_WEB_REALTIME_URL=${LEMMA_WEB_REALTIME_URL:-ws://localhost:8000/connection/websocket}" \
  --build-arg "LEMMA_WEB_OIDC_ISSUER_URI=${LEMMA_WEB_OIDC_ISSUER_URI:-http://localhost:8001/realms/lemma}" \
  --build-arg "LEMMA_WEB_OIDC_CLIENT_ID=${LEMMA_WEB_OIDC_CLIENT_ID:-lemma-web}"
build_image \
  lemma-admin \
  apps/admin/Dockerfile \
  --build-arg "LEMMA_ADMIN_APP_TITLE=${LEMMA_ADMIN_APP_TITLE:-Lemma Admin}" \
  --build-arg "LEMMA_ADMIN_APP_URL=${LEMMA_ADMIN_APP_URL:-http://localhost:3003}" \
  --build-arg "LEMMA_ADMIN_API_URL=${LEMMA_ADMIN_API_URL:-http://localhost:3001}" \
  --build-arg "LEMMA_ADMIN_OIDC_ISSUER_URI=${LEMMA_ADMIN_OIDC_ISSUER_URI:-http://localhost:8001/realms/lemma}" \
  --build-arg "LEMMA_ADMIN_OIDC_CLIENT_ID=${LEMMA_ADMIN_OIDC_CLIENT_ID:-lemma-admin}"
build_image lemma-keycloak apps/keycloak-theme/Dockerfile
build_image lemma-libreoffice-worker apps/libreoffice-worker/Dockerfile

LEMMA_IMAGE_OWNER="$IMAGE_OWNER" \
LEMMA_IMAGE_TAG="$IMAGE_TAG" \
LEMMA_SHARED_IMAGE_TAG="$IMAGE_TAG" \
docker compose \
  -p "$PROJECT_NAME" \
  -f "$COMPOSE_FILE" \
  up \
  --force-recreate
