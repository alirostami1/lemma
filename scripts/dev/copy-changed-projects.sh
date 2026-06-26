#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${1:-origin/main}"

git rev-parse --show-toplevel >/dev/null
cd "$(git rev-parse --show-toplevel)"

git ls-files --others --exclude-standard -z |
  xargs -0 -r git add -N --

MERGE_BASE="$(git merge-base "$BASE_REF" HEAD)"

mapfile -t changed_roots < <(
  {
    git diff --name-only "$MERGE_BASE" --
    git diff --cached --name-only "$MERGE_BASE" --
  } |
    awk -F/ '/^(apps|packages)\/[^/]+/ { print $1 "/" $2 }' |
    LC_ALL=C sort -u
)

if [ "${#changed_roots[@]}" -eq 0 ]; then
  printf 'No changed apps/* or packages/* roots found against %s.\n' "$BASE_REF" | wl-copy
  echo "No changed apps/* or packages/* roots found against $BASE_REF."
  exit 0
fi

{
  printf "Changed roots against %s:\n" "$BASE_REF"
  printf -- "- %s\n" "${changed_roots[@]}"
  printf "\n"

  fd . "${changed_roots[@]}" \
    -t f \
    -e tsx \
    -e ts \
    -e json \
    -e md \
    -e yaml \
    -e yml \
    --exclude generated \
    -0 |
    LC_ALL=C sort -z |
    xargs -0 -I{} sh -c 'printf "=====%s=====\n" "$1"; cat "$1"; printf "\n"' _ {}
} | wl-copy

printf "Copied changed project contents for:\n"
printf -- "- %s\n" "${changed_roots[@]}"
