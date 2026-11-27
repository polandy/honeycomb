#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Writes the pinned Immich schema: the upstream OpenAPI file of one release, cut to the routes honeycomb calls (ADR 0044).
# Usage: gh api "repos/immich-app/immich/contents/open-api/immich-openapi-specs.json?ref=v3.4.2" \
#          -H "Accept: application/vnd.github.raw" | scripts/immich-schema.sh > tests/fixtures/immich/openapi.json
set -euo pipefail

ROUTES='["/albums", "/assets", "/assets/{id}", "/assets/{id}/thumbnail", "/search/metadata", "/search/statistics", "/search/suggestions", "/server/version", "/users/me"]'

upstream=$(cat)
names=$(jq --argjson routes "$ROUTES" '
  def refs: [.. | objects | .["$ref"]? // empty | ltrimstr("#/components/schemas/")] | unique;
  .components.schemas as $all
  | (.paths | with_entries(select(.key as $k | $routes | index($k))) | refs) as $start
  | {done: [], todo: $start}
  | until(.todo == []; .done += .todo | .todo = ([.todo[] | $all[.] | refs[]] | unique) - .done)
  | .done | sort
' <<<"$upstream")
jq --argjson routes "$ROUTES" --argjson names "$names" '{
  openapi, info,
  paths: (.paths | with_entries(select(.key as $k | $routes | index($k)))),
  components: {schemas: (.components.schemas | with_entries(select(.key as $k | $names | index($k))))}
}' <<<"$upstream"
