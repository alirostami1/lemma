#!/usr/bin/env bash
set -euo pipefail

git rev-parse --show-toplevel >/dev/null
cd "$(git rev-parse --show-toplevel)"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is required." >&2
  exit 1
fi

if ! command -v wl-copy >/dev/null 2>&1; then
  echo "wl-copy is required." >&2
  exit 1
fi

branch_name="$(git branch --show-current)"

if [ -z "$branch_name" ]; then
  echo "Cannot detect current branch. Are you in detached HEAD?" >&2
  exit 1
fi

if [[ ! "$branch_name" =~ ^[^/]+/([0-9]+)(-|$) ]]; then
  echo "Current branch does not match expected pattern: <type>/<issue-number>-<slug>" >&2
  echo "Current branch: $branch_name" >&2
  exit 1
fi

issue_number="${BASH_REMATCH[1]}"
core_fields="number,title,state,stateReason,url,author,body,labels,assignees,milestone,createdAt,updatedAt,closed,closedAt,comments"
extra_fields=",parent,subIssues,blockedBy,blocking,closedByPullRequestsReferences"

if issue_json="$(gh issue view "$issue_number" --json "${core_fields}${extra_fields}" 2>/dev/null)"; then
  :
else
  issue_json="$(gh issue view "$issue_number" --json "$core_fields")"
fi

if command -v jq >/dev/null 2>&1; then
  issue_json="$(printf '%s\n' "$issue_json" | jq .)"
elif command -v python3 >/dev/null 2>&1; then
  issue_json="$(printf '%s\n' "$issue_json" | python3 -m json.tool)"
fi

{
  printf "=====branch=====\n"
  printf "%s\n\n" "$branch_name"

  printf "=====issue number=====\n"
  printf "#%s\n\n" "$issue_number"

  printf "=====issue data json=====\n"
  printf "%s\n\n" "$issue_json"

  printf "=====issue text and comments=====\n"
  GH_PAGER=cat gh issue view "$issue_number" --comments
} | wl-copy

echo "Copied issue #${issue_number} context from branch ${branch_name} to clipboard."
