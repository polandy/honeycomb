#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Test for scripts/e2e-names.sh and e2e-server.sh: two ports share no name and no run removes the other's container.
# Every container carries the owner label that lets verify.sh find its orphans, and only the e2e server joins
# Docker's bridge, under verify.sh kept until verify.sh removes it.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
source scripts/e2e-names.sh

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
failed=0
check() {
  if [ "$2" != "$3" ]; then
    echo "FAIL $1: want '$2' got '$3'"
    failed=1
  fi
}

check e2e-default-port 8180 "$(env -u HONEYCOMB_E2E_PORT bash -c "source scripts/e2e-names.sh; e2e_port")"
check e2e-port-from-env 8380 "$(HONEYCOMB_E2E_PORT=8380 e2e_port)"
check e2e-oldest-default-port 9180 "$(env -u HONEYCOMB_E2E_PORT -u HONEYCOMB_E2E_OLDEST_PORT bash -c "source scripts/e2e-names.sh; e2e_oldest_port")"
check e2e-oldest-port-follows-e2e-port 9380 "$(HONEYCOMB_E2E_PORT=8380 e2e_oldest_port)"
check e2e-oldest-port-from-env 8381 "$(HONEYCOMB_E2E_PORT=8380 HONEYCOMB_E2E_OLDEST_PORT=8381 e2e_oldest_port)"
check e2e-names-differ no "$([ "$(e2e_container 8180)" = "$(e2e_container 8380)" ] && echo yes || echo no)"

# Stubs stand in for the network and Docker; docker only records its arguments.
mkdir "$work/bin" "$work/cache"
cat >"$work/bin/docker" <<'STUB'
#!/bin/sh
echo "$*" >>"$DOCKER_LOG"
STUB
cat >"$work/bin/curl" <<'STUB'
#!/bin/sh
while [ $# -gt 0 ]; do [ "$1" = -o ] && : >"$2"; shift; done
STUB
# The stub reads its input: one that exits first breaks the pipe, and pipefail stops the script.
printf '#!/bin/sh\ncat >/dev/null\n' >"$work/bin/sha256sum"
printf '#!/bin/sh\nmkdir -p "$4"\n' >"$work/bin/tar"
# flock records which lock guards the Team folders cache, so parallel runs never share a half download.
printf '#!/bin/sh\necho "$*" >>"$DOCKER_LOG"\n' >"$work/bin/flock"
chmod +x "$work/bin/"*

for port in 8180 8380; do
  PATH="$work/bin:$PATH" DOCKER_LOG="$work/docker-$port.log" XDG_CACHE_HOME="$work/cache" \
    HONEYCOMB_E2E_OWNER="7@test-host" scripts/e2e-server.sh "$port" admin secret
  removed=$(grep '^rm ' "$work/docker-$port.log")
  check "removes-own-container-$port" "rm --force honeycomb-e2e-$port" "$removed"
  check "locks-cache-$port" 1 "$(grep -c '^9$' "$work/docker-$port.log")"
  check "starts-own-container-$port" 1 "$(grep -c -- "--name honeycomb-e2e-$port -p 127.0.0.1:$port:80" "$work/docker-$port.log")"
  check "labels-owner-$port" 1 "$(grep -c -- "--label honeycomb.e2e.owner=7@test-host" "$work/docker-$port.log")"
  check "stops-with-playwright-$port" 0 "$(grep -c -- "--sig-proxy=false" "$work/docker-$port.log")"
done

# Under verify.sh the container outlives Playwright, so one run's end leaves the host's network alone while the other tests.
PATH="$work/bin:$PATH" DOCKER_LOG="$work/docker-keep.log" XDG_CACHE_HOME="$work/cache" HONEYCOMB_E2E_KEEP=1 \
  scripts/e2e-server.sh 8580 admin secret
check outlives-playwright 1 "$(grep -c -- "--sig-proxy=false .*--name honeycomb-e2e-8580" "$work/docker-keep.log")"

# Without a verify.sh run as owner, the script's own process owns the container, which exec keeps.
PATH="$work/bin:$PATH" DOCKER_LOG="$work/docker-own.log" XDG_CACHE_HOME="$work/cache" \
  env -u HONEYCOMB_E2E_OWNER bash -c 'echo "pid $$" >>"$DOCKER_LOG"; exec scripts/e2e-server.sh 8480 admin secret'
own_pid=$(sed -n 's/^pid //p' "$work/docker-own.log")
check labels-own-process 1 "$(grep -c -- "--label honeycomb.e2e.owner=$own_pid@$(uname -n)" "$work/docker-own.log")"

# Every script that starts a Nextcloud container labels it with its owner.
for script in e2e-server php-db-tests database; do
  check "labels-every-run-$script" "$(grep -c 'docker run' "scripts/$script.sh")" \
    "$(grep -c -- '--label "$(e2e_owner_label)"' "scripts/$script.sh")"
done

# A container joining or leaving the bridge changes the host's addresses, which aborts Chromium's queued requests.
for script in php xmp-interop database; do
  check "off-the-bridge-$script" "$(grep -c 'docker run' "scripts/$script.sh")" \
    "$(grep -cE -- 'docker run .*--network (host|none) ' "scripts/$script.sh")"
done

exit $failed
