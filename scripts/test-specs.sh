#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Table test for scripts/specs.sh: a spec, a test file and TODO.md in, pass or fail out.
set -uo pipefail
cd "$(dirname "$0")" || exit 1

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# spec <status> <criterion heading suffixes…>: writes GRID-001 with one criterion per argument.
spec() {
  local status=$1 n=0 suffix
  shift
  mkdir -p "$work/case/docs/specs/grid"
  {
    printf '# GRID-001 – Grid\n\n- Status: %s\n- Area: grid\n- Origin: plan.md\n- Depends on: –\n\n' "$status"
    for suffix in "$@"; do n=$((n + 1)); printf '### GRID-001.%d – Rule%s\n\n' "$n" "$suffix"; done
  } >"$work/case/docs/specs/grid/GRID-001-grid.md"
}
markers() { mkdir -p "$work/case/tests"; printf '%s\n' "$@" >"$work/case/tests/grid.test.ts"; }
todo() { printf '%s\n' "$@" >"$work/case/TODO.md"; }

failed=0
expect() {
  local name=$1 want=$2 got
  if (cd "$work/case" && "$OLDPWD/specs.sh") >/dev/null 2>&1; then got=pass; else got=fail; fi
  if [ "$got" != "$want" ]; then
    echo "FAIL $name: want $want got $got"
    failed=1
  fi
  rm -rf "$work/case"
}

spec implemented '' ''; markers '// spec: GRID-001.1' '	// spec: GRID-001.2'; todo; expect covered pass
spec implemented '' ''; markers '// spec: GRID-001.1, GRID-001.2'; todo; expect comma-list pass
spec implemented '' ''; markers '// spec: GRID-001.1'; todo; expect untested-criterion fail
spec implemented '' ' (gap)'; markers '// spec: GRID-001.1'; todo '- [ ] GRID-001.2 is untested'; expect gap-in-todo pass
spec implemented '' ' (gap)'; markers '// spec: GRID-001.1'; todo '- [ ] GRID-001.20'; expect gap-not-in-todo fail
spec implemented '' ' (removed)'; markers '// spec: GRID-001.1'; todo; expect removed-untested pass
spec implemented '' ' (removed)'; markers '// spec: GRID-001.1, GRID-001.2'; todo; expect marker-on-removed fail
spec implemented ''; markers '// spec: GRID-001.1' '// spec: GRID-001.9'; todo; expect unknown-criterion fail
spec accepted ''; markers; todo; expect accepted-untested pass
spec draft ''; markers '// spec: GRID-001.1'; todo; expect marker-on-draft fail
spec finished ''; markers '// spec: GRID-001.1'; todo; expect bad-status fail
spec implemented '' ''; markers '// spec: GRID-001.1' '# spec: GRID-001.2'; todo; expect hash-marker pass
spec implemented ''; markers '// spec: GRID-001.1'; todo
printf '# GRID-001 – Twin\n\n- Status: accepted\n- Area: a\n- Origin: o\n- Depends on: –\n' \
  >"$work/case/docs/specs/grid/GRID-001-twin.md"
expect duplicate-id fail
spec implemented ''; markers '// spec: GRID-001.1'; todo
sed -i 's/^### GRID-001.1 – /### GRID-1 /' "$work/case/docs/specs/grid/GRID-001-grid.md"
expect bad-heading fail
spec implemented ''; markers '// spec: GRID-001.1'; todo
sed -i '/^- Origin/d' "$work/case/docs/specs/grid/GRID-001-grid.md"
expect missing-field fail

exit $failed
