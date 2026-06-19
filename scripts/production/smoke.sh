#!/bin/sh
set -eu

ENV_FILE="${1:-/opt/lemma/.env}"
TIMEOUT_SECONDS="${LEMMA_SMOKE_TIMEOUT_SECONDS:-180}"
INTERVAL_SECONDS="${LEMMA_SMOKE_INTERVAL_SECONDS:-5}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Smoke env file not found: $ENV_FILE" >&2
  exit 1
fi

get_env() {
  key="$1"
  value="$(
    awk -v key="$key" '
      $0 ~ "^[[:space:]]*#" || $0 ~ "^[[:space:]]*$" { next }
      index($0, key "=") == 1 {
        sub("^[^=]*=", "")
        print
        found = 1
        exit
      }
      END { if (!found) exit 1 }
    ' "$ENV_FILE"
  )" || {
    echo "Missing required smoke env: $key" >&2
    exit 1
  }

  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

trim_trailing_slash() {
  value="$1"
  while [ "${value%/}" != "$value" ]; do
    value="${value%/}"
  done
  printf '%s' "$value"
}

check_url() {
  name="$1"
  url="$2"
  deadline=$(($(date +%s) + TIMEOUT_SECONDS))

  echo "Checking $name"
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if curl -fsS --max-time 10 "$url" >/dev/null; then
      echo "$name ok"
      return 0
    fi
    sleep "$INTERVAL_SECONDS"
  done

  echo "$name failed: $url" >&2
  return 1
}

web_url="$(trim_trailing_slash "$(get_env LEMMA_WEB_APP_URL)")"
admin_url="$(trim_trailing_slash "$(get_env LEMMA_ADMIN_APP_URL)")"
api_url="$(trim_trailing_slash "$(get_env LEMMA_WEB_API_URL)")"
oidc_issuer_url="$(trim_trailing_slash "$(get_env LEMMA_OIDC_ISSUER_URL)")"

check_url "web" "$web_url/"
check_url "admin" "$admin_url/"
check_url "api health" "$api_url/api/health"
check_url "oidc discovery" "$oidc_issuer_url/.well-known/openid-configuration"

echo "Smoke checks passed"
