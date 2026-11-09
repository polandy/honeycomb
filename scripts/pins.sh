#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Fails on a dependency, Action or image that is not pinned to an exact version or digest.
set -uo pipefail

EXACT_VERSION='^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'
NEXTCLOUD_OCP_BRANCH='^dev-stable[0-9]+$'

failed=0
report() {
  echo "$1"
  failed=1
}

if [ -f package.json ]; then
  while IFS=$'\t' read -r name version; do
    [[ $version =~ $EXACT_VERSION ]] || report "package.json: $name $version is not an exact version"
  done < <(jq -r '[.dependencies, .devDependencies, .overrides] | map(. // {}) | add
    | to_entries[] | "\(.key)\t\(.value)"' package.json)
fi

if [ -f composer.json ]; then
  while IFS=$'\t' read -r name version; do
    [ "$name" = php ] && continue
    [ "$name" = nextcloud/ocp ] && [[ $version =~ $NEXTCLOUD_OCP_BRANCH ]] && continue
    [[ $version =~ $EXACT_VERSION ]] || report "composer.json: $name $version is not an exact version"
  done < <(jq -r '[.require, ."require-dev"] | map(. // {}) | add
    | to_entries[] | "\(.key)\t\(.value)"' composer.json)
fi

while IFS= read -r line; do
  report "not pinned by commit SHA: $line"
done < <(grep -rnE '^\s*-?\s*uses:' .github 2>/dev/null | grep -vE 'uses:\s*\S+@[0-9a-f]{40}(\s|$)')

while IFS= read -r line; do
  report "image not pinned by digest: $line"
done < <(grep -rnE '^[A-Z_]*IMAGE=' scripts 2>/dev/null | grep -vE '@sha256:[0-9a-f]{64}$')

exit $failed
