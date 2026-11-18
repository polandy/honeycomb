<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** A count of photo files and whether the file cache may have missed some (ADR 0011). */
final readonly class PhotoCount {
	public function __construct(
		public int $files,
		public bool $approximate,
	) {
	}
}
