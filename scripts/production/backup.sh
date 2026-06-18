#!/usr/bin/env sh
set -eu

ROOT_DIR="${LEMMA_DEPLOY_ROOT:-/opt/lemma}"
ENV_FILE="${LEMMA_DEPLOY_ENV_FILE:-$ROOT_DIR/.env}"
COMPOSE_FILE="$ROOT_DIR/infra/production/compose.yml"
BACKUP_DIR="${LEMMA_BACKUP_DIR:-$ROOT_DIR/backups}"
PROJECT_NAME="${LEMMA_COMPOSE_PROJECT:-lemma}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"

compose() {
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

compose exec -T postgres pg_dump -U "$(grep '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2-)" "$(grep '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2-)" > "$BACKUP_DIR/postgres-$STAMP.sql"
compose exec -T postgres-keycloak pg_dump -U "$(grep '^KC_POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2-)" "$(grep '^KC_POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2-)" > "$BACKUP_DIR/keycloak-postgres-$STAMP.sql"
docker run --rm -v "$PROJECT_NAME"_garage-data:/garage-data:ro -v "$BACKUP_DIR:/backup" docker.io/library/alpine:3.22 tar -czf "/backup/garage-data-$STAMP.tgz" -C /garage-data .
docker run --rm -v "$PROJECT_NAME"_garage-meta:/garage-meta:ro -v "$BACKUP_DIR:/backup" docker.io/library/alpine:3.22 tar -czf "/backup/garage-meta-$STAMP.tgz" -C /garage-meta .

echo "Backups written to $BACKUP_DIR"
