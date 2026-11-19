#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Test for scripts/verify-steps.sh: result lines carry the duration, a failing step shows its output.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

work=$(mktemp -d)
trap 'rm -rf "${work:?}"' EXIT

# A fake clock: each reading returns the next second from the list, so no test waits.
cat >"$work/clock.sh" <<'CLOCK'
#!/usr/bin/env bash
ticks=$1
read -r now <"$ticks"
echo $((now + 1)) >"$ticks"
case $now in
  0) echo 100 ;; 1) echo 100 ;; 2) echo 107 ;; 3) echo 107 ;; 4) echo 109 ;; 5) echo 150 ;; *) echo 200 ;;
esac
CLOCK
chmod +x "$work/clock.sh"
echo 0 >"$work/ticks"

got=$(
  VERIFY_CLOCK="$work/clock.sh $work/ticks"
  export VERIFY_CLOCK
  source scripts/verify-steps.sh
  step good true
  step bad sh -c 'echo boom-output; exit 1'
  verify_total
  exit $failed
)
status=$?

failed=0
expect() {
  if ! grep -qxF -- "$1" <<<"$got"; then
    echo "FAIL missing line '$1' in:"
    echo "$got"
    failed=1
  fi
}

expect "ok   good (7s)"
expect "FAIL bad (2s)"
expect "boom-output"
expect "total 50s"
if [ "$status" -ne 1 ]; then
  echo "FAIL a failing step must make the caller exit 1, got $status"
  failed=1
fi

exit $failed
