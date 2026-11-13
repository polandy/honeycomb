#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Table test for scripts/spec-trailers.sh: changed paths and a message in, pass or fail out.
set -uo pipefail
cd "$(dirname "$0")" || exit 1

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/docs/specs/grid"
printf -- '- Status: implemented\n' >"$work/docs/specs/grid/GRID-001-grid.md"
printf -- '- Status: accepted\n' >"$work/docs/specs/grid/GRID-002-later.md"

failed=0
expect() {
  local name=$1 want=$2 message=$3 got
  shift 3
  if printf '%s\n' "$@" | (cd "$work" && SPEC_MESSAGE=$message SPEC_HEAD_REF=${HEAD_REF-} "$OLDPWD/spec-trailers.sh") >/dev/null 2>&1
  then got=pass; else got=fail; fi
  if [ "$got" != "$want" ]; then
    echo "FAIL $name: want $want got $got"
    failed=1
  fi
}

spec=docs/specs/grid/GRID-001-grid.md
expect nothing pass ''
expect docs-only pass '' docs/plan.md
expect code-without-spec fail '' src/logic/cull.ts
expect php-without-spec fail '' lib/Service/TrashService.php
expect code-with-spec pass '' src/logic/cull.ts "$spec"
expect code-with-trailer pass $'refactor\n\nSpec-Unchanged: pure rename' src/logic/cull.ts
expect empty-trailer fail $'Spec-Unchanged:' src/logic/cull.ts
expect crlf-empty-trailer fail $'Spec-Unchanged:\r\nmore' src/logic/cull.ts
expect quoted-trailer fail $'see `Spec-Unchanged: x`' src/logic/cull.ts
expect tests-only pass '' tests/js/logic/cull.test.ts
expect spec-alone fail '' "$spec"
expect spec-with-tests pass '' "$spec" tests/js/logic/cull.test.ts
expect spec-with-trailer pass 'Spec-Only: wording' "$spec"
expect accepted-spec-alone pass '' docs/specs/grid/GRID-002-later.md
expect deleted-spec-alone fail '' docs/specs/grid/GRID-009-gone.md
expect readme-alone pass '' docs/specs/README.md
expect readme-not-a-spec fail '' docs/specs/README.md src/App.vue

release=release-please--branches--main--components--honeycomb
HEAD_REF=$release expect release-pr-exempt pass '' appinfo/info.xml package.json
HEAD_REF=$release expect release-pr-spec-alone-exempt pass '' "$spec"
HEAD_REF=feat/release-please--branches-- expect other-branch-enforced fail '' src/logic/cull.ts
HEAD_REF=main expect main-branch-enforced fail '' appinfo/info.xml

exit $failed
