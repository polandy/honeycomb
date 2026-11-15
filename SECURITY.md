# Security policy

## Reporting a vulnerability

Please report a vulnerability privately, not in a public issue, discussion or pull request.

Use GitHub's private reporting: open the
[Security tab](https://github.com/polandy/honeycomb/security/advisories/new) of the repository and
choose *Report a vulnerability*. Only the maintainers see the report.

Say what you found, which honeycomb and Nextcloud versions it affects, and how to reproduce it.
Do not include real photos, paths or credentials.

honeycomb is maintained by one owner and AI agents, so there is no guaranteed response time. A
report is read as soon as possible, and the fix and its advisory are published together once a
release is ready.

## Supported versions

Only the latest release is supported. honeycomb is pre-release (0.x): a fix ships in the next
release, not as a backport.

## Scope

In scope: honeycomb's PHP backend and its Vue frontend, for example reading or changing another
user's files or data, bypassing the Nextcloud trash bin or permissions, or injecting script.

Out of scope: vulnerabilities in Nextcloud itself or in other apps (report those to
[Nextcloud](https://nextcloud.com/security/)), and issues that need an admin account or a
modified server.
