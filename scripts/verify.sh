#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runs every CI check locally: one line per step, the full output of a failing step only.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

MARKDOWNLINT_CLI2_VERSION=0.24.0 # matches DavidAnson/markdownlint-cli2-action v25.0.0 in ci.yml
REUSE_VERSION=6.3.0              # matches the fsfe/reuse:6 image of fsfe/reuse-action v6.0.0

failed=0
step() {
  local name=$1
  shift
  local log
  log=$(mktemp)
  if "$@" >"$log" 2>&1; then
    echo "ok   $name"
  else
    echo "FAIL $name"
    cat "$log"
    failed=1
  fi
  rm -f "$log"
}

step ci-changes scripts/test-ci-changes.sh
step "gate tests" sh -c 'scripts/test-source-sizes.sh && scripts/test-pins.sh && scripts/test-specs.sh && scripts/test-spec-trailers.sh'
step source-sizes scripts/source-sizes.sh
step pins scripts/pins.sh
step specs scripts/specs.sh
# The branch's commit messages stand in for the description CI judges (docs/specs/README.md).
step "spec trailers" sh -c 'git diff --name-only origin/main...HEAD |
  SPEC_MESSAGE="$(git log --format=%B origin/main..HEAD)" scripts/spec-trailers.sh'
step markdownlint npx --yes "markdownlint-cli2@$MARKDOWNLINT_CLI2_VERSION"
step reuse uvx --from "reuse==$REUSE_VERSION" reuse lint
step "composer install" scripts/php.sh composer install --no-interaction --no-progress
step php-cs-fixer scripts/php.sh vendor/bin/php-cs-fixer fix --dry-run --diff
step psalm scripts/php.sh vendor/bin/psalm --no-cache --threads=1 --no-progress
step phpunit scripts/php.sh vendor/bin/phpunit
step "npm ci" npm ci
step eslint npx eslint
step vue-tsc npx vue-tsc
step vitest npx vitest run --coverage
step build npx vite build
step e2e npx playwright test

exit $failed
