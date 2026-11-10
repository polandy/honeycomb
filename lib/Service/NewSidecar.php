<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** A sidecar to create beside its image, at a path below the user's files (ADR 0017). */
final readonly class NewSidecar {
	/** @param non-empty-string $path */
	public function __construct(
		public string $path,
		public string $bytes,
	) {
	}
}
