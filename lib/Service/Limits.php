<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The sizes every package checks a request against. */
final class Limits {
	/** The most entries one folder set lists: 20,000 pictures of a RAW, a JPEG and a sidecar each (`docs/dev/plan.md` Multiple folders). */
	public const int ENTRIES = 60_000;

	/** The most files one move or trash request carries, so it ends well inside a timeout (ADR 0029). */
	public const int REQUEST_FILES = 500;
}
