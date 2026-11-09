#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Table test for scripts/ci-changes.sh: changed paths in, one key=true|false line per job group out.
set -uo pipefail
cd "$(dirname "$0")" || exit 1

failed=0
expect() {
  local name=$1 want=$2 got
  shift 2
  got=$(printf '%s\n' "$@" | ./ci-changes.sh | tr '\n' ' ')
  if [ "$got" != "$want " ]; then
    echo "FAIL $name: want '$want' got '$got'"
    failed=1
  fi
}

expect docs-only "markdown=true php=false ts=false app=false" docs/plan.md
expect mockup-only "markdown=false php=false ts=false app=false" docs/mockup/index.html
expect php-only "markdown=false php=true ts=false app=true" lib/Controller/PageController.php
expect composer-lock "markdown=false php=true ts=false app=true" composer.lock
expect ts-only "markdown=false php=false ts=true app=true" src/logic/pairing.ts
expect npm-lock "markdown=false php=false ts=true app=true" package-lock.json
expect e2e-only "markdown=false php=false ts=false app=true" tests/e2e/grid.spec.ts
expect info-xml "markdown=false php=true ts=false app=true" appinfo/info.xml
expect workflow "markdown=true php=true ts=true app=true" .github/workflows/ci.yml
expect verify-script "markdown=true php=true ts=true app=true" scripts/verify.sh
expect markdownlint-config "markdown=true php=false ts=false app=false" .markdownlint-cli2.jsonc
expect unknown-file "markdown=true php=true ts=true app=true" tools/new-thing.bin
expect mixed "markdown=true php=true ts=false app=true" README.md lib/Db/Mapper.php
expect empty "markdown=true php=true ts=true app=true"

exit $failed
