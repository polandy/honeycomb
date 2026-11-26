#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runs every CI check locally: one timed line per step, the full output of a failing step only.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

MARKDOWNLINT_CLI2_VERSION=0.24.0 # matches DavidAnson/markdownlint-cli2-action v25.0.0 in ci.yml
REUSE_VERSION=6.3.0              # matches the fsfe/reuse:6 image of fsfe/reuse-action v6.0.0
PSALM_MAX_THREADS=8
PSALM_THREADS=$(($(nproc) < PSALM_MAX_THREADS ? $(nproc) : PSALM_MAX_THREADS))

source scripts/e2e-names.sh
source scripts/verify-steps.sh

step ci-changes scripts/test-ci-changes.sh
step "gate tests" sh -c 'scripts/test-e2e-names.sh && scripts/test-database.sh && scripts/test-source-sizes.sh && scripts/test-pins.sh && scripts/test-words.sh && scripts/test-specs.sh && scripts/test-spec-trailers.sh && scripts/test-nextcloud-versions.sh && scripts/test-package.sh && scripts/test-verify-steps.sh'
step source-sizes scripts/source-sizes.sh
step pins scripts/pins.sh
step words scripts/words.sh
step specs scripts/specs.sh
step "nextcloud versions" scripts/nextcloud-versions.sh
# The branch's commit messages stand in for the description CI judges (docs/dev/specs/README.md).
step "spec trailers" sh -c 'git diff --name-only origin/main...HEAD |
  SPEC_MESSAGE="$(git log --format=%B origin/main..HEAD)" scripts/spec-trailers.sh'
step markdownlint npx --yes "markdownlint-cli2@$MARKDOWNLINT_CLI2_VERSION"
step reuse uvx --from "reuse==$REUSE_VERSION" reuse lint
step "composer install" scripts/php.sh composer install --no-interaction --no-progress
step php-cs-fixer scripts/php.sh vendor/bin/php-cs-fixer fix --dry-run --diff
step psalm scripts/php.sh vendor/bin/psalm --no-cache --threads=$PSALM_THREADS --no-progress
step phpunit scripts/php.sh vendor/bin/phpunit
step "npm ci" npm ci
step unused-exports scripts/unused-exports.sh
parallel_step eslint npx eslint
parallel_step vue-tsc npx vue-tsc
parallel_step vitest npx vitest run --coverage --exclude tests/js/conventions/eslint.test.ts
parallel_step "xmp interop" scripts/xmp-interop.sh
parallel_wait
# Alone, because its first lint builds the type-aware program, which starves beside eslint and vue-tsc.
step "eslint conventions" npx vitest run tests/js/conventions/eslint.test.ts
step build npx vite build
# Each Nextcloud container has its own port and name (scripts/e2e-names.sh); one run per host at a time.
# No container joins or leaves Docker's bridge while a run tests (docs/dev/02-workflow.md §2.4).
e2e_slot_take || failed=1
e2e_reap_orphans || failed=1
e2e_remove_on_exit
e2e_ports_choose || failed=1
parallel_step "phpunit db" scripts/php-db-tests.sh
parallel_step e2e env HONEYCOMB_E2E_KEEP=1 npx playwright test
parallel_step "e2e oldest" env HONEYCOMB_E2E_KEEP=1 HONEYCOMB_E2E_NEXTCLOUD=oldest HONEYCOMB_E2E_PORT="$HONEYCOMB_E2E_OLDEST_PORT" npx playwright test
parallel_wait
e2e_remove_own || failed=1
e2e_slot_release

verify_total
exit $failed
