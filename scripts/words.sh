#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Fails on a UI or doc word the glossary replaced: picture, Retry, display-only Done, honey frame.
set -uo pipefail

# Buttons that leave a mode keep "Done"; every display-only dialog says "Close".
DONE_OK='/(SelectionRow|TagEntry)\.vue$'

PICTURE='(^|[^[:alnum:]])[Pp]ictures?([^[:alnum:]]|$)'
RETRY='(^|[^[:alnum:]])[Rr]etry([^[:alnum:]]|$)'

failed=0
report() {
  echo "$1"
  failed=1
}

while IFS= read -r file; do
  while IFS= read -r line; do
    text=${line#*:}
    lineno=${line%%:*}
    while IFS= read -r literal; do
      [[ $literal == *' '* || $literal == "'Done'" ]] || continue
      [[ $literal =~ $PICTURE ]] && report "$file:$lineno: UI text says picture, the UI says photo: $literal"
      [[ $literal =~ $RETRY ]] && report "$file:$lineno: UI text says retry, the UI says Try again: $literal"
      [[ $literal == "'Done'" && ! $file =~ $DONE_OK ]] && report "$file:$lineno: a display-only dialog says Close, not Done"
    done < <(grep -oE "'[^']*'" <<<"$text")
  done < <(grep -nE "'honeycomb'" "$file")
done < <(grep -rlE "'honeycomb'" src --include='*.ts' --include='*.vue' 2>/dev/null)

while IFS= read -r line; do
  report "honey frame is called the primary frame: $line"
done < <(grep -rniE 'honey[ -](frame|bracket)' docs src 2>/dev/null | cut -c1-160)

exit $failed
