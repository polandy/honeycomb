#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Table test for scripts/source-sizes.sh: source files in, pass or fail out.
set -uo pipefail
cd "$(dirname "$0")" || exit 1

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
lines() { mkdir -p "$(dirname "$work/$2")"; seq "$1" >"$work/$2"; }

lines 250 src/logic/at-warning.ts
lines 251 src/logic/over-warning.ts
lines 300 src/logic/at-limit.ts
lines 301 src/logic/over-limit.ts
lines 301 lib/Service/Big.php
lines 301 src/components/Big.vue
lines 900 tests/fixtures/pairing/vectors.ts
lines 900 docs/dev/mockup/app.js
lines 900 README.md

failed=0
expect() {
  local name=$1 want=$2 got
  shift 2
  if (cd "$work" && "$OLDPWD/source-sizes.sh" "$@") >/dev/null 2>&1; then got=pass; else got=fail; fi
  if [ "$got" != "$want" ]; then
    echo "FAIL $name: want $want got $got"
    failed=1
  fi
}

expect at-limit pass src/logic/at-limit.ts
expect ts-over-limit fail src/logic/over-limit.ts
expect php-over-limit fail lib/Service/Big.php
expect vue-over-limit fail src/components/Big.vue
expect fixture-exempt pass tests/fixtures/pairing/vectors.ts
expect mockup-exempt pass docs/dev/mockup/app.js
expect markdown-exempt pass README.md
expect one-over-among-many fail src/logic/at-limit.ts src/logic/over-limit.ts

warns() {
  local name=$1 want=$2 got
  shift 2
  if (cd "$work" && "$OLDPWD/source-sizes.sh" "$@") 2>/dev/null | grep -q '^warning: '; then got=warn; else got=quiet; fi
  if [ "$got" != "$want" ]; then
    echo "FAIL $name: want $want got $got"
    failed=1
  fi
}

warns at-warning quiet src/logic/at-warning.ts
warns over-warning warn src/logic/over-warning.ts
expect over-warning-passes pass src/logic/over-warning.ts

exit $failed
