#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Table test for scripts/pins.sh: one manifest or workflow in, pass or fail out.
set -uo pipefail
cd "$(dirname "$0")" || exit 1

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
SHA=3d3c42e5aac5ba805825da76410c181273ba90b1

failed=0
expect() {
  local name=$1 want=$2 file=$3 content=$4 got
  find "$work" -mindepth 1 -delete && mkdir -p "$work/$(dirname "$file")"
  printf '%s\n' "$content" >"$work/$file"
  if (cd "$work" && "$OLDPWD/pins.sh") >/dev/null 2>&1; then got=pass; else got=fail; fi
  if [ "$got" != "$want" ]; then
    echo "FAIL $name: want $want got $got"
    failed=1
  fi
}

expect npm-exact pass package.json '{"devDependencies":{"eslint":"10.14.0"}}'
expect npm-caret fail package.json '{"devDependencies":{"eslint":"^10.14.0"}}'
expect npm-tilde fail package.json '{"dependencies":{"vue":"~3.5.0"}}'
expect npm-override-range fail package.json '{"overrides":{"glob":">=11"}}'
expect composer-exact pass composer.json '{"require":{"php":">=8.3 <8.6"},"require-dev":{"vimeo/psalm":"7.2.0"}}'
expect composer-ocp-branch pass composer.json '{"require-dev":{"nextcloud/ocp":"dev-stable35"}}'
expect composer-caret fail composer.json '{"require-dev":{"vimeo/psalm":"^7.2"}}'
expect action-sha pass .github/workflows/ci.yml "      - uses: actions/checkout@$SHA # v7.0.1"
expect action-tag fail .github/workflows/ci.yml '      - uses: actions/checkout@v7'
expect local-action pass .github/workflows/ci.yml '      - uses: ./.github/actions/setup'
expect image-digest pass scripts/php.sh "IMAGE=composer:2.11.1@sha256:$SHA${SHA:0:24}"
expect image-tag fail scripts/php.sh 'COMPOSER_IMAGE=composer:2.11.1'

exit $failed
