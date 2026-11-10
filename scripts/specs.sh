#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Checks docs/specs/ against the tests and TODO.md (docs/specs/README.md, ADR 0015).
set -uo pipefail

SPECS=${SPECS_DIR:-docs/specs}
TESTS=${TESTS_DIR:-tests}
TODO=${TODO_FILE:-TODO.md}
STATUSES='draft|accepted|implemented|removed'
ID='[A-Z]+-[0-9]{3}'

failed=0
fail() {
  echo "$1"
  failed=1
}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
# One line per criterion: <criterion id> <spec status> <kind: open|gap|removed> <file>
: >"$work/criteria"
: >"$work/ids"

for file in $(find "$SPECS" -mindepth 2 -name '*.md' | sort); do
  name=$(basename "$file" .md)
  id=$(grep -oE "^$ID" <<<"$name")
  if [ -z "$id" ]; then
    fail "$file: the file name must start with an ID such as GRID-001"
    continue
  fi
  echo "$id" >>"$work/ids"
  grep -qE "^# $id – .+" "$file" || fail "$file: the first heading must be '# $id – <title>'"
  status=$(sed -nE "s/^- Status: ($STATUSES)$/\1/p" "$file" | head -n 1)
  [ -n "$status" ] || fail "$file: needs '- Status: <$STATUSES>'"
  for field in Area Origin 'Depends on'; do
    grep -qE "^- $field: .+" "$file" || fail "$file: needs '- $field: …'"
  done
  grep -E '^### ' "$file" | while IFS= read -r heading; do
    criterion=$(grep -oE "^### $id\.[0-9]+ – " <<<"$heading" | grep -oE "$ID\.[0-9]+")
    if [ -z "$criterion" ]; then
      echo "$file: criterion heading must be '### $id.<n> – <title>': $heading" >>"$work/errors"
      continue
    fi
    kind=open
    [[ $heading == *' (gap)' ]] && kind=gap
    [[ $heading == *' (removed)' ]] && kind=removed
    echo "$criterion ${status:-none} $kind $file" >>"$work/criteria"
  done
done

[ -f "$work/errors" ] && { cat "$work/errors"; failed=1; }
for id in $(sort "$work/ids" | uniq -d); do fail "$id: used by more than one spec"; done
for id in $(cut -d' ' -f1 "$work/criteria" | sort | uniq -d); do fail "$id: criterion listed twice"; done

# Markers: a line '// spec: GRID-001.3' (or '# spec:', '* spec:'), several IDs comma-separated.
grep -rnE "^[[:space:]]*(//|#|\*) spec: " "$TESTS" 2>/dev/null |
  while IFS= read -r line; do
    where=$(cut -d: -f1,2 <<<"$line")
    for criterion in $(grep -oE "$ID\.[0-9]+" <<<"${line#*spec: }"); do echo "$criterion $where"; done
  done >"$work/markers"

while read -r criterion where; do
  entry=$(awk -v c="$criterion" '$1 == c' "$work/criteria")
  if [ -z "$entry" ]; then
    fail "$where: spec: $criterion names no criterion"
    continue
  fi
  read -r _ status kind _ <<<"$entry"
  case $status in draft | removed) fail "$where: spec: $criterion belongs to a $status spec" ;; esac
  [ "$kind" = removed ] && fail "$where: spec: $criterion is a removed criterion"
done <"$work/markers"

while read -r criterion status kind file; do
  [ "$status" = implemented ] || continue
  case $kind in
    open) awk -v c="$criterion" '$1 == c { found = 1 } END { exit !found }' "$work/markers" ||
      fail "$file: $criterion has no test; mark one with '// spec: $criterion' or mark the criterion (gap)" ;;
    gap) grep -qwF "$criterion" "$TODO" || fail "$file: $criterion is a (gap) with no $TODO item naming it" ;;
  esac
done <"$work/criteria"

exit $failed
