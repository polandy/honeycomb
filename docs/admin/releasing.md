# Releasing honeycomb

For the maintainer. How a release becomes a tarball on GitHub and in the Nextcloud App Store.

## What happens on a release

Merging the release pull request makes release-please tag the release and publish it on GitHub.
The `package and publish` job of `.github/workflows/release-please.yml` then:

1. builds the frontend (`npm ci`, `npm run build`) and runs `scripts/package.sh`, which packs
   `appinfo`, `img`, `js`, `l10n`, `lib`, `templates`, `CHANGELOG.md`, `LICENSE` and `README.md`
   into `build/artifacts/honeycomb-<version>.tar.gz`, with the single folder `honeycomb/`;
2. with the signing secrets, signs the code first (`appinfo/signature.json`, made by
   `occ integrity:sign-app` in a throwaway Nextcloud container, `scripts/sign-app.sh`) and then the
   tarball (`honeycomb-<version>.tar.gz.sig`, the SHA-512 signature the App Store checks);
3. attaches the tarball, and the signature if there is one, to the GitHub release;
4. with the App Store token, registers the release in the App Store, which downloads the tarball
   from GitHub. Without the token it stops after step 3 and says so.

Until the secrets exist, releases are unsigned tarballs on GitHub only.

## One-time steps for the owner

The certificate is personal to the app's owner, so only the owner can do these steps. Nothing
else in the repository has to change.

1. **Request the certificate.** Make a key and a certificate signing request, keep the key
   private and offline:

   ```sh
   openssl req -nodes -newkey rsa:4096 -keyout honeycomb.key -out honeycomb.csr -subj "/CN=honeycomb"
   ```

   Open a pull request against
   [`nextcloud/app-certificate-requests`](https://github.com/nextcloud/app-certificate-requests)
   that adds `honeycomb/honeycomb.csr`, as its README describes. Nextcloud answers with
   `honeycomb.crt`.
2. **Register the app.** Sign in to [apps.nextcloud.com](https://apps.nextcloud.com), open
   *Register app*, paste `honeycomb.crt` and the signature that command prints:

   ```sh
   echo -n "honeycomb" | openssl dgst -sha512 -sign honeycomb.key | openssl base64
   ```

3. **Add the repository secrets** in *Settings → Secrets and variables → Actions*:

   | Secret | Value |
   |---|---|
   | `APP_SIGNING_KEY` | the content of `honeycomb.key` |
   | `APP_SIGNING_CERT` | the content of `honeycomb.crt` |
   | `APPSTORE_TOKEN` | the API token from the App Store account page |

4. **Publish the latest release.** Rerun its `release-please` run in *Actions* (*Re-run all
   jobs*), or package it by hand (below) and upload it on the App Store's *Upload app release*
   page.

## Packaging by hand

From a checkout of the release tag, with Docker for the signing step:

```sh
npm ci && npm run build
HONEYCOMB_SIGNING_KEY=~/keys/honeycomb.key HONEYCOMB_SIGNING_CERT=~/keys/honeycomb.crt \
  scripts/package.sh
```

Without the two variables `scripts/package.sh` packs an unsigned tarball.
