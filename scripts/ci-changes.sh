#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Reads changed paths on stdin, prints markdown, php, ts and app as true|false for the CI jobs.
# A path it does not know, and empty input, turn every group on so a job is never skipped by mistake.
set -uo pipefail

markdown=false php=false ts=false app=false
all() { markdown=true php=true ts=true app=true; }

seen=false
while IFS= read -r path; do
  [ -n "$path" ] || continue
  seen=true
  case $path in
    *.md | .markdownlint*) markdown=true ;;
    .github/workflows/ci.yml | .github/actions/* | scripts/verify.sh | scripts/ci-changes*) all ;;
    .github/workflows/* | .github/dependabot.yml | .claude/* | docs/* | LICENSES/* | REUSE.toml) ;;
    release-please-config.json | .release-please-manifest.json | .gitignore) ;;
    tests/e2e/* | playwright* | img/* | l10n/* | css/*) app=true ;;
    *.php | composer.* | appinfo/* | templates/* | lib/* | tests/php/* | psalm* | .php-cs-fixer* | phpunit*) php=true app=true ;;
    *.ts | *.vue | src/* | package*.json | tsconfig* | vite* | vitest* | eslint* | .eslintrc*)
      ts=true app=true ;;
    *) all ;;
  esac
done
$seen || all

echo "markdown=$markdown"
echo "php=$php"
echo "ts=$ts"
echo "app=$app"
