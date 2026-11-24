#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Table test for scripts/words.sh: one source or doc line in, pass or fail out.
set -uo pipefail
cd "$(dirname "$0")" || exit 1

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

failed=0
expect() {
  local name=$1 want=$2 file=$3 content=$4 got
  find "$work" -mindepth 1 -delete && mkdir -p "$work/$(dirname "$file")"
  printf '%s\n' "$content" >"$work/$file"
  if (cd "$work" && "$OLDPWD/words.sh") >/dev/null 2>&1; then got=pass; else got=fail; fi
  if [ "$got" != "$want" ]; then
    echo "FAIL $name: want $want got $got"
    failed=1
  fi
}

expect photo-text pass src/a.ts "t('honeycomb', 'Moved {count} photos')"
expect picture-text fail src/a.ts "t('honeycomb', 'No pictures match')"
expect picture-plural-of-n fail src/a.vue "n('honeycomb', '{count} photo', '{count} pictures', count)"
expect picture-in-code pass src/a.ts "t('honeycomb', '{name}', { name: row.picture.baseName })"
expect retry-word fail src/a.vue "t('honeycomb', 'Retry failed files')"
expect try-again pass src/a.vue "t('honeycomb', 'Try again')"
expect done-display-only fail src/components/CullFinished.vue "t('honeycomb', 'Done')"
expect done-leaves-mode pass src/components/GridToolbar.vue "t('honeycomb', 'Done')"
expect close pass src/components/CullFinished.vue "t('honeycomb', 'Close')"
expect honey-frame-doc fail docs/user/culling.md 'a honey frame marks a series'
expect honey-bracket-doc fail docs/dev/specs/a.md 'the honey-bracket'
expect primary-frame-doc pass docs/user/culling.md 'a primary frame marks a series'

exit $failed
