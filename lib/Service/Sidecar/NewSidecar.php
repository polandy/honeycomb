<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Sidecar;

use OCA\Honeycomb\Service\Stats\StatsCount;

/** A sidecar to create beside its image, at a path below the user's files (ADR 0017). */
final readonly class NewSidecar {
	/**
	 * @param non-empty-string $path
	 * @param list<StatsCount> $counts what the browser counts once the save succeeds (STATS-001.36)
	 */
	public function __construct(
		public string $path,
		public string $bytes,
		public array $counts = [],
	) {
	}
}
