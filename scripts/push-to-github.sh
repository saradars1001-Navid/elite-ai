#!/usr/bin/env bash
# Creates a GitHub repository for Elite AI Academy and pushes the initial
# commit, which triggers the CI pipeline (.github/workflows/backend.yml).
#
# Usage:
#   bash scripts/push-to-github.sh            # repo: ai-elite, private
#   bash scripts/push-to-github.sh my-app public
#
# Requires the GitHub CLI (gh) to be installed and authenticated:
#   gh auth login
#
# After the push, CI runs automatically. Watch it with:
#   gh run watch

set -euo pipefail

REPO_NAME="${1:-ai-elite}"
VISIBILITY="${2:-private}"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: GitHub CLI (gh) is not installed." >&2
  echo "Install it from https://cli.github.com or create the repo manually and run:" >&2
  echo "  git remote add origin https://github.com/<you>/${REPO_NAME}.git" >&2
  echo "  git push -u origin main" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "error: gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

OWNER="$(gh api user --jq .login)"
REMOTE_URL="https://github.com/${OWNER}/${REPO_NAME}.git"

echo "==> Creating ${VISIBILITY} repo ${OWNER}/${REPO_NAME} on GitHub"
gh repo create "${OWNER}/${REPO_NAME}" --"${VISIBILITY}" --source . --remote origin --push

echo "==> Setting the upstream branch"
git branch --set-upstream-to=origin/main main 2>/dev/null || git push -u origin main

echo
echo "Repo is live:  https://github.com/${OWNER}/${REPO_NAME}"
echo "CI will run now (backend: PHP 8.2/8.3 lint + tests + 80% coverage; frontend: lint + typecheck + build)."
echo "Watch it:  gh run watch"
