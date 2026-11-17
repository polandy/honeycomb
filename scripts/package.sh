#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Packs the built app in the current directory into build/artifacts/honeycomb-<version>.tar.gz.
# With HONEYCOMB_SIGNING_KEY and HONEYCOMB_SIGNING_CERT (file paths) it signs the code and the tarball.
set -euo pipefail

APP_ID=honeycomb
APP_FILES=(appinfo img js l10n lib templates CHANGELOG.md LICENSE README.md)
key=${HONEYCOMB_SIGNING_KEY:-}
cert=${HONEYCOMB_SIGNING_CERT:-}
sign_app=${HONEYCOMB_SIGN_APP:-$(dirname "$0")/sign-app.sh}

if { [ -n "$key" ] && [ -z "$cert" ]; } || { [ -z "$key" ] && [ -n "$cert" ]; }; then
  echo "Set both HONEYCOMB_SIGNING_KEY and HONEYCOMB_SIGNING_CERT, or neither." >&2
  exit 1
fi
[ -d js ] || {
  echo "js/ is missing: run npm ci and npm run build first." >&2
  exit 1
}
version=$(sed -n 's#.*<version>\(.*\)</version>.*#\1#p' appinfo/info.xml | head -n 1)
[ -n "$version" ] || {
  echo "appinfo/info.xml has no <version>." >&2
  exit 1
}

stage=build/package
tarball=build/artifacts/$APP_ID-$version.tar.gz
rm -rf "${stage:?}" "$tarball" "$tarball.sig"
mkdir -p "$stage/$APP_ID" build/artifacts
cp -R "${APP_FILES[@]}" "$stage/$APP_ID/"

if [ -n "$key" ]; then
  "$sign_app" "$stage/$APP_ID" "$key" "$cert"
fi
tar -czf "$tarball" -C "$stage" --owner=0 --group=0 "$APP_ID"
if [ -n "$key" ]; then
  # The App Store checks this signature of the tarball on upload.
  openssl dgst -sha512 -sign "$key" "$tarball" | openssl base64 -A >"$tarball.sig"
  echo "Signed $tarball and $tarball.sig"
else
  echo "Packed $tarball, unsigned: set HONEYCOMB_SIGNING_KEY and HONEYCOMB_SIGNING_CERT to sign."
fi
