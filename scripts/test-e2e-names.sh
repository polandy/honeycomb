#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Test for scripts/e2e-names.sh and e2e-server.sh: two ports share no name and no run removes the other's container.
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
check upgrade-default-port 8190 "$(env -u HONEYCOMB_UPGRADE_PORT bash -c "source scripts/e2e-names.sh; upgrade_port")"
check e2e-port-from-env 8380 "$(HONEYCOMB_E2E_PORT=8380 e2e_port)"
check e2e-oldest-default-port 9180 "$(env -u HONEYCOMB_E2E_PORT -u HONEYCOMB_E2E_OLDEST_PORT bash -c "source scripts/e2e-names.sh; e2e_oldest_port")"
check e2e-oldest-port-follows-e2e-port 9380 "$(HONEYCOMB_E2E_PORT=8380 e2e_oldest_port)"
check e2e-oldest-port-from-env 8381 "$(HONEYCOMB_E2E_PORT=8380 HONEYCOMB_E2E_OLDEST_PORT=8381 e2e_oldest_port)"
check upgrade-port-from-env 8390 "$(HONEYCOMB_UPGRADE_PORT=8390 upgrade_port)"
check e2e-names-differ no "$([ "$(e2e_container 8180)" = "$(e2e_container 8380)" ] && echo yes || echo no)"
check upgrade-names-differ no "$([ "$(upgrade_container 8190)" = "$(upgrade_container 8390)" ] && echo yes || echo no)"
check e2e-upgrade-names-differ no "$([ "$(e2e_container 8180)" = "$(upgrade_container 8180)" ] && echo yes || echo no)"

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
printf '#!/bin/sh\n' >"$work/bin/sha256sum"
printf '#!/bin/sh\nmkdir -p "$4"\n' >"$work/bin/tar"
# flock records which lock guards the Team folders cache, so parallel runs never share a half download.
printf '#!/bin/sh\necho "$*" >>"$DOCKER_LOG"\n' >"$work/bin/flock"
chmod +x "$work/bin/"*

for port in 8180 8380; do
  PATH="$work/bin:$PATH" DOCKER_LOG="$work/docker-$port.log" XDG_CACHE_HOME="$work/cache" \
    scripts/e2e-server.sh "$port" admin secret
  removed=$(grep '^rm ' "$work/docker-$port.log")
  check "removes-own-container-$port" "rm --force honeycomb-e2e-$port" "$removed"
  check "locks-cache-$port" 1 "$(grep -c '^9$' "$work/docker-$port.log")"
  check "starts-own-container-$port" 1 "$(grep -c -- "--name honeycomb-e2e-$port -p 127.0.0.1:$port:80" "$work/docker-$port.log")"
done

exit $failed
