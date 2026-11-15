#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Test for scripts/package.sh: a built app tree in, the release tarball and its signature out.
set -uo pipefail
cd "$(dirname "$0")" || exit 1

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
app=$work/app
keys=$work/keys
TARBALL=build/artifacts/honeycomb-1.2.3.tar.gz

mkdir -p "$keys"
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$keys/honeycomb.key" -out "$keys/honeycomb.crt" \
  -days 1 -subj /CN=honeycomb >/dev/null 2>&1 || exit 1
openssl x509 -in "$keys/honeycomb.crt" -pubkey -noout >"$keys/honeycomb.pub" || exit 1
# Stands in for scripts/sign-app.sh, which needs Docker: leaves the mark occ integrity:sign-app leaves.
printf '#!/bin/sh\necho "{}" >"$1/appinfo/signature.json"\n' >"$keys/sign-ok"
printf '#!/bin/sh\nexit 1\n' >"$keys/sign-fails"
chmod +x "$keys/sign-ok" "$keys/sign-fails"

failed=0
fail() {
  echo "FAIL $1"
  failed=1
}

# A built checkout: the app's own folders next to everything a release leaves out.
make_tree() {
  rm -rf "$app" && mkdir -p "$app"
  (
    cd "$app" || exit 1
    mkdir -p appinfo img js l10n lib/Service templates src tests/php node_modules/vue docs vendor/bin .git
    printf '<info>\n\t<id>honeycomb</id>\n\t<version>1.2.3</version>\n</info>\n' >appinfo/info.xml
    touch img/app.svg js/honeycomb-main.mjs l10n/de.json lib/Service/A.php templates/main.php \
      LICENSE README.md CHANGELOG.md src/main.ts tests/php/ATest.php node_modules/vue/index.js \
      docs/plan.md vendor/bin/psalm .git/HEAD package.json composer.json
  )
}

package() {
  (cd "$app" && "$OLDPWD/package.sh") >"$work/out" 2>&1
}

listing() {
  tar -tzf "$app/$TARBALL" | sed 's#/$##' | sort
}

make_tree
if ! package; then
  fail "unsigned: package.sh failed: $(cat "$work/out")"
elif [ ! -f "$app/$TARBALL" ]; then
  fail "unsigned: no $TARBALL"
else
  want=$(printf '%s\n' honeycomb honeycomb/CHANGELOG.md honeycomb/LICENSE honeycomb/README.md \
    honeycomb/appinfo honeycomb/appinfo/info.xml honeycomb/img honeycomb/img/app.svg honeycomb/js \
    honeycomb/js/honeycomb-main.mjs honeycomb/l10n honeycomb/l10n/de.json honeycomb/lib \
    honeycomb/lib/Service honeycomb/lib/Service/A.php honeycomb/templates honeycomb/templates/main.php | sort)
  [ "$(listing)" = "$want" ] || fail "unsigned: tarball holds $(listing | tr '\n' ' ')"
  [ ! -e "$app/$TARBALL.sig" ] || fail "unsigned: wrote a signature without a key"
fi

make_tree
rm -rf "$app/js"
package && fail "unbuilt: packaged a tree without js/"

make_tree
HONEYCOMB_SIGNING_KEY=$keys/honeycomb.key package && fail "key only: packaged without a certificate"
[ ! -e "$app/$TARBALL" ] || fail "key only: left a tarball"

make_tree
export HONEYCOMB_SIGNING_KEY=$keys/honeycomb.key HONEYCOMB_SIGNING_CERT=$keys/honeycomb.crt
if ! HONEYCOMB_SIGN_APP=$keys/sign-ok package; then
  fail "signed: package.sh failed: $(cat "$work/out")"
else
  listing | grep -qx honeycomb/appinfo/signature.json || fail "signed: no appinfo/signature.json in the tarball"
  base64 -d "$app/$TARBALL.sig" >"$work/sig" 2>/dev/null &&
    openssl dgst -sha512 -verify "$keys/honeycomb.pub" -signature "$work/sig" "$app/$TARBALL" >/dev/null ||
    fail "signed: $TARBALL.sig does not verify with the certificate"
fi

make_tree
HONEYCOMB_SIGN_APP=$keys/sign-fails package && fail "signing fails: packaged anyway"
[ ! -e "$app/$TARBALL" ] || fail "signing fails: left a tarball"

exit $failed
