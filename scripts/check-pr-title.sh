#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Checks that PULL_REQUEST_TITLE is a Conventional Commit subject (docs/02-workflow.md §2.5).
set -euo pipefail

title=${PULL_REQUEST_TITLE:?PULL_REQUEST_TITLE is not set}
types='build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test'
pattern="^($types)(\([a-z0-9-]+\))?!?: [^ ].{0,99}$"

if [[ ! $title =~ $pattern ]]; then
  echo "PR title is not a Conventional Commit subject: $title" >&2
  echo "Expected: <type>(<scope>)?: <summary>, type one of ${types//|/, }, at most 100 characters after the colon." >&2
  exit 1
fi
if [[ $title =~ \.$ ]]; then
  echo "PR title must not end with a full stop: $title" >&2
  exit 1
fi
echo "ok: $title"
