#!/bin/sh
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# PostToolUse(Edit|Write) formatter; behaviour documented in docs/03-coding-standards.md §Formatting.
input=$(cat)

warn_once() {
  session=$(printf '%s' "$input" | sed -n 's/.*"session_id" *: *"\([^"]*\)".*/\1/p')
  marker="${TMPDIR:-/tmp}/honeycomb-format-hook-${session:-unknown}-$2"
  [ -e "$marker" ] && exit 0
  : >"$marker"
  echo "$1" >&2
  exit 2
}

command -v jq >/dev/null 2>&1 || warn_once "format hook: jq not found, files are not formatted on edit" jq
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -n "$file" ] && [ -f "$file" ] || exit 0

case "$file" in
  "$CLAUDE_PROJECT_DIR"/vendor/* | "$CLAUDE_PROJECT_DIR"/node_modules/* | "$CLAUDE_PROJECT_DIR"/js/*) exit 0 ;;
  "$CLAUDE_PROJECT_DIR"/docs/mockup/*) exit 0 ;;
  "$CLAUDE_PROJECT_DIR"/*) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR" || exit 0
case "$file" in
  *.php)
    [ -f composer.json ] || exit 0
    [ -x vendor/bin/php-cs-fixer ] || warn_once "format hook: vendor/bin/php-cs-fixer missing; run \`composer install\`" php
    vendor/bin/php-cs-fixer fix --quiet "$file" >/dev/null 2>&1
    ;;
  *.js | *.ts | *.vue)
    [ -f package.json ] || exit 0
    [ -x node_modules/.bin/eslint ] || warn_once "format hook: eslint missing; run \`npm ci\`" js
    node_modules/.bin/eslint --fix --quiet "$file" >/dev/null 2>&1
    ;;
esac
exit 0
