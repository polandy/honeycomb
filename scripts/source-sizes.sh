#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Fails on a source file longer than MAX_LINES and warns from WARN_LINES; checks the given files, or every tracked file.
set -uo pipefail

MAX_LINES=300
WARN_LINES=250

[ $# -gt 0 ] || set -- $(git ls-files)

failed=0
for file in "$@"; do
  case $file in
    tests/fixtures/* | docs/dev/mockup/*) continue ;;
    *.php | *.ts | *.vue | *.js | *.mjs | *.sh) ;;
    *) continue ;;
  esac
  lines=$(wc -l <"$file")
  if [ "$lines" -gt "$MAX_LINES" ]; then
    echo "$file: $lines lines, at most $MAX_LINES; split it along a seam (docs/dev/conventions.md)"
    failed=1
  elif [ "$lines" -gt "$WARN_LINES" ]; then
    echo "warning: $file: $lines lines, plan its split before $MAX_LINES (docs/dev/conventions.md)"
  fi
done
exit $failed
