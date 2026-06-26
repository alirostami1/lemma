#!/usr/bin/env bash
set -euo pipefail

git rev-parse --show-toplevel >/dev/null
cd "$(git rev-parse --show-toplevel)"

git ls-files --others --exclude-standard -z |
  xargs -0 -r git add -N --

git diff --binary HEAD -- | wl-copy

echo "Copied git diff to clipboard."
