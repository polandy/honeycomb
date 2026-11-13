#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Fails when behaviour and spec change apart without a trailer saying why (docs/specs/README.md).
set -uo pipefail

SPECS=${SPECS_DIR:-docs/specs}
# Release pull requests (release-please) carry no spec by design; the workflow leaves this empty for forks.
# It drains stdin first so the producer of the file list is not killed by SIGPIPE (exit 141).
case ${SPEC_HEAD_REF-} in release-please--branches--*) cat >/dev/null; exit 0 ;; esac
message=${SPEC_MESSAGE-}
message=${message//$'\r'/}

behaviour=false spec_changed=false implemented_spec=false code_or_tests=false
while IFS= read -r path; do
  [ -n "$path" ] || continue
  case $path in
    lib/* | src/* | appinfo/* | templates/* | css/*) behaviour=true code_or_tests=true ;;
    tests/*) code_or_tests=true ;;
    "$SPECS"/README.md) ;;
    "$SPECS"/*.md)
      spec_changed=true
      # A deleted spec counts as implemented, so removing one needs code or a reason too.
      if [ ! -f "$path" ] || grep -qE '^- Status: implemented$' "$path"; then implemented_spec=true; fi
      ;;
  esac
done

trailer() { grep -qE "^$1: *[^ ]" <<<"$message"; }

failed=0
if $behaviour && ! $spec_changed && ! trailer Spec-Unchanged; then
  echo "Behaviour code changed but no spec in $SPECS/ did."
  echo "Update the spec in this pull request, or add 'Spec-Unchanged: <reason>' to its description."
  failed=1
fi
if $implemented_spec && ! $code_or_tests && ! trailer Spec-Only; then
  echo "An implemented spec in $SPECS/ changed but no code or test did."
  echo "Change the code and tests with it, or add 'Spec-Only: <reason>' to the description."
  failed=1
fi
exit $failed
